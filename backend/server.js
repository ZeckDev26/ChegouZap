require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const http = require('http');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mongoose = require('mongoose');
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_DURATION = '7d';
const R2_BUCKET = process.env.R2_BUCKET || 'chegouzap-arquivos';
const PUBLIC_URL_R2 = /^https?:\/\//i.test(process.env.R2_PUBLIC_URL || '')
    ? process.env.R2_PUBLIC_URL.replace(/\/$/, '')
    : '';
const COMMUNITY_ID = 'community';
const onlineUsers = new Map();
const messageRateLimits = new Map();

if (!process.env.JWT_SECRET) {
    console.warn('Aviso: defina JWT_SECRET no .env antes de publicar; as sessões atuais serão temporárias.');
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const allowedDocumentTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        const permitido = file.mimetype.startsWith('image/')
            || file.mimetype.startsWith('video/')
            || file.mimetype.startsWith('audio/')
            || allowedDocumentTypes.has(file.mimetype);
        callback(permitido ? null : new Error('Tipo de arquivo não permitido.'), permitido);
    },
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Conectado ao MongoDB com sucesso.'))
    .catch((error) => console.error('Erro ao conectar no MongoDB:', error.message));

const userSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senhaHash: { type: String, required: true, select: false },
    avatar: { type: String, default: '' },
    avatarKey: { type: String, default: '' },
    pushSubscription: { type: Object, default: null },
    permitirBuscaEmail: { type: Boolean, default: true },
    mostrarOnline: { type: Boolean, default: true },
    confirmarLeitura: { type: Boolean, default: true },
    bloqueados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comunidadeNaoLidas: { type: Number, default: 0, min: 0 },
    comunidadeUltimaLeituraEm: { type: Date, default: null },
}, { timestamps: true });

const reactionSchema = new mongoose.Schema({
    emoji: { type: String, required: true, maxlength: 8 },
    usuarios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: false });

const messageSchema = new mongoose.Schema({
    texto: { type: String, trim: true, maxlength: 4000, default: '' },
    anexo: { type: mongoose.Schema.Types.Mixed, default: null },
    remetente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    remetenteNome: { type: String, required: true },
    remetenteAvatar: { type: String, default: '' },
    remetenteAvatarKey: { type: String, default: '' },
    conversaId: { type: String, default: COMMUNITY_ID, index: true },
    tipoConversa: { type: String, enum: ['community', 'private', 'group'], default: 'community' },
    participantes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    destinatario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    excluidaPara: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    excluidaParaTodos: { type: Boolean, default: false },
    resposta: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
        texto: { type: String, maxlength: 180, default: '' },
        remetenteNome: { type: String, maxlength: 60, default: '' },
    },
    reacoes: { type: [reactionSchema], default: [] },
    editadaEm: { type: Date, default: null },
    entreguePara: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lidaPor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now, expires: '15d' },
}, { versionKey: false });

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

const conversationStateSchema = new mongoose.Schema({
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fixada: { type: Boolean, default: false },
    arquivada: { type: Boolean, default: false },
    silenciada: { type: Boolean, default: false },
    aceita: { type: Boolean, default: true },
    naoLidas: { type: Number, default: 0, min: 0 },
    ultimaLeituraEm: { type: Date, default: null },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
    conversaId: { type: String, required: true, unique: true, index: true },
    tipo: { type: String, enum: ['private', 'group'], required: true },
    nome: { type: String, trim: true, maxlength: 60, default: '' },
    criador: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    membros: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    administradores: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    estados: { type: [conversationStateSchema], default: [] },
    avatar: { type: String, default: '' },
    avatarKey: { type: String, default: '' },
    conviteToken: { type: String, default: '', index: true },
    mensagemFixada: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    ultimaMensagem: { type: String, trim: true, maxlength: 180, default: '' },
    ultimaMensagemEm: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

conversationSchema.index({ membros: 1, ultimaMensagemEm: -1 });
const Conversation = mongoose.model('Conversation', conversationSchema);

const reportSchema = new mongoose.Schema({
    denunciante: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    denunciado: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conversaId: { type: String, required: true },
    motivo: { type: String, trim: true, maxlength: 300, default: 'Conteúdo indesejado' },
}, { timestamps: true, versionKey: false });
const Report = mongoose.model('Report', reportSchema);

const webpush = require('web-push');

webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);
function createToken(user) {
    return jwt.sign({ sub: user._id.toString() }, JWT_SECRET, { expiresIn: TOKEN_DURATION });
}
// Rota para salvar a inscrição de Push Notification
app.post('/api/notifications/subscribe', authenticateRequest, async (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription?.endpoint) {
            return res.status(400).json({ erro: 'Assinatura de notificação inválida.' });
        }
        
        await User.updateMany(
            { _id: { $ne: req.user._id }, 'pushSubscription.endpoint': subscription.endpoint },
            { $set: { pushSubscription: null } },
        );
        await User.findByIdAndUpdate(req.user._id, { pushSubscription: subscription });
        
        res.status(200).json({ message: 'Inscrição salva com sucesso!' });
    } catch (error) {
        console.error('Erro no push:', error);
        res.status(500).json({ erro: 'Erro ao salvar inscrição de notificação.' });
    }
});
function inferR2Key(value = '') {
    if (!value) return '';
    const decoded = decodeURIComponent(String(value));
    const match = decoded.match(/(?:^|\/)((?:mensagens|avatares)\/[^?#]+)/);
    return match?.[1] || '';
}

function publicUser(user, { includeEmail = false } = {}) {
    const result = {
        id: user._id.toString(),
        nome: user.nome,
        avatar: user.avatar || '',
        avatarKey: user.avatarKey || inferR2Key(user.avatar),
        online: user.mostrarOnline !== false && onlineUsers.has(user._id.toString()),
    };
    if (includeEmail) {
        result.email = user.email;
        result.privacy = {
            allowEmailSearch: user.permitirBuscaEmail !== false,
            showOnline: user.mostrarOnline !== false,
            readReceipts: user.confirmarLeitura !== false,
        };
        result.communityUnread = Math.max(0, Number(user.comunidadeNaoLidas || 0));
    }
    return result;
}

function normalizeAttachment(attachment) {
    if (!attachment) return null;
    if (typeof attachment === 'string') {
        const key = inferR2Key(attachment);
        return {
            url: key ? '' : attachment,
            key,
            nome: 'Imagem',
            tipo: 'image/*',
            categoria: 'imagem',
        };
    }
    return {
        ...attachment,
        key: attachment.key || inferR2Key(attachment.url),
        url: '',
    };
}

function publicMessage(message) {
    const data = typeof message.toObject === 'function' ? message.toObject() : message;
    const remetenteId = data.remetente?._id || data.remetente;

    return {
        id: data._id.toString(),
        texto: data.excluidaParaTodos ? '' : data.texto,
        anexo: data.excluidaParaTodos ? null : normalizeAttachment(data.anexo),
        conversaId: data.conversaId || COMMUNITY_ID,
        tipoConversa: data.tipoConversa || 'community',
        participantes: (data.participantes || []).map((id) => id.toString()),
        remetente: {
            id: remetenteId?.toString(),
            nome: data.remetenteNome,
            avatar: data.remetenteAvatar || '',
            avatarKey: data.remetenteAvatarKey || inferR2Key(data.remetenteAvatar),
        },
        excluidaParaTodos: Boolean(data.excluidaParaTodos),
        replyTo: data.resposta?.id ? {
            id: data.resposta.id.toString(),
            text: data.resposta.texto || '',
            senderName: data.resposta.remetenteNome || '',
        } : null,
        reactions: (data.reacoes || []).map((reaction) => ({
            emoji: reaction.emoji,
            userIds: (reaction.usuarios || []).map((id) => id.toString()),
        })),
        editedAt: data.editadaEm || null,
        deliveredTo: (data.entreguePara || []).map((id) => id.toString()),
        readBy: (data.lidaPor || []).map((id) => id.toString()),
        createdAt: data.createdAt,
    };
}

async function userFromToken(token) {
    const payload = jwt.verify(token, JWT_SECRET);
    return User.findById(payload.sub);
}

async function authenticateRequest(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ erro: 'Faça login para continuar.' });

    try {
        const user = await userFromToken(token);
        if (!user) return res.status(401).json({ erro: 'Usuário não encontrado.' });
        req.user = user;
        return next();
    } catch (_error) {
        return res.status(401).json({ erro: 'Sua sessão expirou. Entre novamente.' });
    }
}

async function authenticateFileRequest(req, res, next) {
    const token = req.query.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).end();

    try {
        const user = await userFromToken(token);
        if (!user) return res.status(401).end();
        req.user = user;
        return next();
    } catch (_error) {
        return res.status(401).end();
    }
}

function normalizeEmail(email = '') {
    return String(email).trim().toLowerCase();
}

function safeFileName(fileName = 'arquivo') {
    return fileName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(-120);
}

function attachmentCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'imagem';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'documento';
}

async function uploadToR2(file, folder) {
    const key = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.originalname)}`;

    await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: `inline; filename="${safeFileName(file.originalname)}"`,
    }));

    return {
        key,
        url: PUBLIC_URL_R2 ? `${PUBLIC_URL_R2}/${key}` : '',
    };
}

async function removeFromR2(key) {
    if (!key) return;
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } catch (error) {
        console.error('Não foi possível excluir o anexo do R2:', error.message);
    }
}

function privateConversationId(firstUserId, secondUserId) {
    return `private:${[firstUserId.toString(), secondUserId.toString()].sort().join(':')}`;
}

function memberId(member) {
    return (member?._id || member)?.toString();
}

function viewerConversationState(data, viewerId) {
    const viewer = viewerId.toString();
    const state = (data.estados || []).find((item) => memberId(item.usuario) === viewer);
    return {
        pinned: Boolean(state?.fixada),
        archived: Boolean(state?.arquivada),
        muted: Boolean(state?.silenciada),
        accepted: state?.aceita !== false,
        unreadCount: Math.max(0, Number(state?.naoLidas || 0)),
        lastReadAt: state?.ultimaLeituraEm || null,
    };
}

function publicConversation(conversation, viewerId) {
    const data = typeof conversation.toObject === 'function' ? conversation.toObject() : conversation;
    const members = data.membros || [];
    const viewer = viewerId.toString();
    const lastMessageAt = data.ultimaMensagemEm ? new Date(data.ultimaMensagemEm) : null;
    const summaryIsFresh = lastMessageAt
        && lastMessageAt.getTime() >= Date.now() - (15 * 24 * 60 * 60 * 1000);
    const viewerState = viewerConversationState(data, viewer);
    const adminIds = (data.administradores || []).map(memberId);

    if (data.tipo === 'private') {
        const recipient = members.find((member) => memberId(member) !== viewer);
        if (!recipient) return null;
        return {
            id: data.conversaId,
            type: 'private',
            name: recipient.nome || 'Usuário',
            recipientId: memberId(recipient),
            user: publicUser(recipient),
            lastMessage: summaryIsFresh && data.ultimaMensagem ? data.ultimaMensagem : 'Conversa particular',
            lastMessageAt: data.ultimaMensagemEm,
            memberCount: 2,
            canManage: false,
            isAdmin: false,
            request: !viewerState.accepted,
            pinnedMessageId: memberId(data.mensagemFixada) || '',
            ...viewerState,
        };
    }

    return {
        id: data.conversaId,
        type: 'group',
        name: data.nome,
        recipientId: '',
        members: members.map((member) => publicUser(member)),
        creatorId: memberId(data.criador),
        adminIds,
        lastMessage: summaryIsFresh && data.ultimaMensagem ? data.ultimaMensagem : 'Grupo fechado',
        lastMessageAt: data.ultimaMensagemEm,
        memberCount: members.length,
        canManage: memberId(data.criador) === viewer || adminIds.includes(viewer),
        isAdmin: memberId(data.criador) === viewer || adminIds.includes(viewer),
        avatar: data.avatar || '',
        avatarKey: data.avatarKey || inferR2Key(data.avatar),
        inviteToken: (memberId(data.criador) === viewer || adminIds.includes(viewer)) ? data.conviteToken || '' : '',
        pinnedMessageId: memberId(data.mensagemFixada) || '',
        request: false,
        ...viewerState,
    };
}

function ensureConversationStates(conversation, participantIds, senderId = '') {
    const existing = new Set((conversation.estados || []).map((item) => memberId(item.usuario)));
    participantIds.forEach((id) => {
        const value = id.toString();
        if (existing.has(value)) return;
        const requiresAcceptance = conversation.tipo === 'private' && senderId && value !== senderId.toString();
        conversation.estados.push({
            usuario: id,
            aceita: !requiresAcceptance,
            naoLidas: 0,
        });
        existing.add(value);
    });
}

function emitConversationsChanged(memberIds) {
    const ids = [...new Set((memberIds || []).map((id) => id.toString()))];
    const target = ids.reduce((emitter, id) => emitter.to(`user:${id}`), io);
    target.emit('conversations changed');
}

async function ensureLegacyPrivateConversations(userId) {
    const rows = await Message.aggregate([
        {
            $match: {
                tipoConversa: 'private',
                participantes: new mongoose.Types.ObjectId(userId),
                conversaId: { $regex: '^private:' },
            },
        },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$conversaId',
                membros: { $first: '$participantes' },
                texto: { $first: '$texto' },
                anexo: { $first: '$anexo.nome' },
                ultimaMensagemEm: { $first: '$createdAt' },
            },
        },
    ]);

    if (!rows.length) return;
    await Conversation.bulkWrite(rows.map((row) => ({
        updateOne: {
            filter: { conversaId: row._id },
            update: {
                $setOnInsert: {
                    tipo: 'private',
                    membros: row.membros,
                    estados: row.membros.map((id) => ({ usuario: id, aceita: true, naoLidas: 0 })),
                },
                $set: {
                    ultimaMensagem: row.texto || row.anexo || 'Arquivo',
                    ultimaMensagemEm: row.ultimaMensagemEm,
                },
            },
            upsert: true,
        },
    })));
}

async function touchConversation(conversation, message) {
    if (conversation.type === 'community') {
        await User.updateMany(
            { _id: { $ne: message.remetente } },
            { $inc: { comunidadeNaoLidas: 1 } },
        );
        return;
    }
    const summary = message.texto || message.anexo?.nome || 'Arquivo';
    let document;
    if (conversation.type === 'private') {
        document = await Conversation.findOne({ conversaId: conversation.id });
        if (!document) {
            document = new Conversation({
                conversaId: conversation.id,
                tipo: 'private',
                membros: conversation.participants,
            });
        }
    } else {
        document = await Conversation.findOne({ conversaId: conversation.id });
    }
    if (!document) return;

    const senderId = message.remetente.toString();
    ensureConversationStates(document, conversation.participants, senderId);
    document.ultimaMensagem = summary.slice(0, 180);
    document.ultimaMensagemEm = message.createdAt;
    document.estados.forEach((state) => {
        if (memberId(state.usuario) !== senderId) state.naoLidas = Number(state.naoLidas || 0) + 1;
    });
    await document.save();
    emitConversationsChanged(conversation.participants);
}

async function sendPushNotifications(conversation, message) {
    if (conversation.type === 'community') return;
    const document = await Conversation.findOne({ conversaId: conversation.id });
    const mutedIds = new Set((document?.estados || [])
        .filter((state) => state.silenciada)
        .map((state) => memberId(state.usuario)));
    const recipientIds = (conversation.participants || [])
        .map((id) => id.toString())
        .filter((id) => id !== message.remetente.toString() && !mutedIds.has(id));
    if (!recipientIds.length) return;
    const users = await User.find({ _id: { $in: recipientIds }, pushSubscription: { $ne: null } })
        .select('pushSubscription');
    const payload = JSON.stringify({
        title: conversation.type === 'group' ? document?.nome || 'Novo grupo' : message.remetenteNome,
        body: message.texto || (message.anexo ? '📎 Novo arquivo' : 'Nova mensagem'),
        url: `/?conversation=${encodeURIComponent(conversation.id)}`,
    });
    await Promise.allSettled(users.map(async (user) => {
        try {
            await webpush.sendNotification(user.pushSubscription, payload);
        } catch (error) {
            if ([404, 410].includes(error.statusCode)) {
                await User.findByIdAndUpdate(user._id, { pushSubscription: null });
            }
        }
    }));
}

function checkMessageRateLimit(userId) {
    const now = Date.now();
    const windowStart = now - 10_000;
    const recent = (messageRateLimits.get(userId) || []).filter((timestamp) => timestamp > windowStart);
    if (recent.length >= 25) return false;
    recent.push(now);
    messageRateLimits.set(userId, recent);
    return true;
}

async function resolveConversation(user, payload = {}) {
    if (!payload.destinatarioId && (!payload.conversaId || payload.conversaId === COMMUNITY_ID)) {
        return {
            id: COMMUNITY_ID,
            type: 'community',
            participants: [],
            recipient: null,
        };
    }

    if (String(payload.conversaId || '').startsWith('group:')) {
        const group = await Conversation.findOne({
            conversaId: String(payload.conversaId),
            tipo: 'group',
            membros: user._id,
        });
        if (!group) throw new Error('Grupo não encontrado ou acesso não permitido.');
        return {
            id: group.conversaId,
            type: 'group',
            participants: group.membros,
            recipient: null,
            group,
        };
    }

    let recipientId = String(payload.destinatarioId || '');
    if (!recipientId && String(payload.conversaId).startsWith('private:')) {
        const ids = String(payload.conversaId).split(':').slice(1);
        recipientId = ids.find((id) => id !== user._id.toString()) || '';
    }

    if (!mongoose.isValidObjectId(recipientId) || recipientId === user._id.toString()) {
        throw new Error('Conversa particular inválida.');
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) throw new Error('Este usuário não está mais disponível.');
    const requesterBlocked = (user.bloqueados || []).some((id) => id.toString() === recipientId);
    const recipientBlocked = (recipient.bloqueados || []).some((id) => id.toString() === user._id.toString());
    if (requesterBlocked || recipientBlocked) throw new Error('Esta conversa não está disponível.');

    const id = privateConversationId(user._id, recipient._id);
    const document = await Conversation.findOne({ conversaId: id });
    return {
        id,
        type: 'private',
        participants: [user._id, recipient._id],
        recipient,
        document,
    };
}

function assertCanSend(conversation, userId) {
    const document = conversation.document || conversation.group;
    if (!document) return;
    const state = (document.estados || []).find((item) => memberId(item.usuario) === userId.toString());
    if (state?.aceita === false) throw new Error('Aceite a solicitação antes de responder.');
}

async function replySnapshot(conversation, replyToId) {
    if (!replyToId || !mongoose.isValidObjectId(replyToId)) return undefined;
    const target = await Message.findById(replyToId);
    if (!target || target.excluidaParaTodos || (target.conversaId || COMMUNITY_ID) !== conversation.id) {
        throw new Error('A mensagem respondida não está mais disponível.');
    }
    return {
        id: target._id,
        texto: (target.texto || target.anexo?.nome || 'Arquivo').slice(0, 180),
        remetenteNome: target.remetenteNome,
    };
}

function deliveryRecipients(conversation, senderId) {
    const ids = new Set([senderId.toString()]);
    (conversation.participants || []).forEach((id) => {
        if (onlineUsers.has(id.toString())) ids.add(id.toString());
    });
    return [...ids];
}

function historyQuery(user, conversation) {
    const visibleToUser = { excluidaPara: { $ne: user._id } };
    if (conversation.type === 'community') {
        return {
            ...visibleToUser,
            $or: [
                { conversaId: COMMUNITY_ID },
                { conversaId: { $exists: false } },
                { conversaId: null },
            ],
        };
    }
    return {
        ...visibleToUser,
        conversaId: conversation.id,
        participantes: user._id,
    };
}

function emitToConversation(message, eventName, payload) {
    const conversationId = message.conversaId || COMMUNITY_ID;
    if (conversationId === COMMUNITY_ID || message.tipoConversa === 'community') {
        io.to(COMMUNITY_ID).emit(eventName, payload);
        return;
    }

    const participants = (message.participantes || []).map((id) => id.toString());
    const target = participants.reduce((emitter, id) => emitter.to(`user:${id}`), io);
    target.emit(eventName, payload);
}

async function emitPresence() {
    try {
        const connectedIds = [...onlineUsers.keys()];
        const visibleUsers = await User.find({
            _id: { $in: connectedIds },
            mostrarOnline: { $ne: false },
        }).select('_id');
        io.emit('presence', {
            online: visibleUsers.length,
            userIds: visibleUsers.map((user) => user._id.toString()),
        });
    } catch (_error) {
        io.emit('presence', { online: 0, userIds: [] });
    }
}

app.post('/api/auth/register', async (req, res) => {
    try {
        const nome = String(req.body.nome || '').trim();
        const email = normalizeEmail(req.body.email);
        const senha = String(req.body.senha || '');

        if (nome.length < 2) return res.status(400).json({ erro: 'Informe seu nome.' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ erro: 'Informe um e-mail válido.' });
        }
        if (senha.length < 6) {
            return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
        }
        if (await User.exists({ email })) {
            return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
        }

        const user = await User.create({
            nome,
            email,
            senhaHash: await bcrypt.hash(senha, 12),
        });

        return res.status(201).json({
            token: createToken(user),
            usuario: publicUser(user, { includeEmail: true }),
        });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        return res.status(500).json({ erro: 'Não foi possível criar a conta.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const senha = String(req.body.senha || '');
        const user = await User.findOne({ email }).select('+senhaHash');

        if (!user || !(await bcrypt.compare(senha, user.senhaHash))) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
        }

        return res.json({
            token: createToken(user),
            usuario: publicUser(user, { includeEmail: true }),
        });
    } catch (error) {
        console.error('Erro ao entrar:', error);
        return res.status(500).json({ erro: 'Não foi possível entrar agora.' });
    }
});

app.get('/api/auth/me', authenticateRequest, (req, res) => {
    res.json({ usuario: publicUser(req.user, { includeEmail: true }) });
});

app.patch('/api/privacy', authenticateRequest, async (req, res) => {
    const updates = {};
    if (typeof req.body.allowEmailSearch === 'boolean') updates.permitirBuscaEmail = req.body.allowEmailSearch;
    if (typeof req.body.showOnline === 'boolean') updates.mostrarOnline = req.body.showOnline;
    if (typeof req.body.readReceipts === 'boolean') updates.confirmarLeitura = req.body.readReceipts;
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    emitPresence();
    res.json({ usuario: publicUser(user, { includeEmail: true }) });
});

app.post('/api/privacy/block/:userId', authenticateRequest, async (req, res) => {
    const userId = String(req.params.userId || '');
    if (!mongoose.isValidObjectId(userId) || userId === req.user._id.toString()) {
        return res.status(400).json({ erro: 'Usuário inválido.' });
    }
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { bloqueados: userId } });
    return res.json({ ok: true });
});

app.delete('/api/privacy/block/:userId', authenticateRequest, async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $pull: { bloqueados: req.params.userId } });
    return res.json({ ok: true });
});

app.post('/api/reports', authenticateRequest, async (req, res) => {
    const reportedId = String(req.body.userId || '');
    if (!mongoose.isValidObjectId(reportedId) || reportedId === req.user._id.toString()) {
        return res.status(400).json({ erro: 'Usuário inválido.' });
    }
    await Report.create({
        denunciante: req.user._id,
        denunciado: reportedId,
        conversaId: String(req.body.conversationId || '').slice(0, 180),
        motivo: String(req.body.reason || 'Conteúdo indesejado').trim().slice(0, 300),
    });
    return res.status(201).json({ ok: true });
});

app.get('/api/users/search', authenticateRequest, async (req, res) => {
    try {
        const query = String(req.query.q || '').trim().slice(0, 80);
        if (query.length < 2) return res.json({ usuarios: [] });

        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matcher = new RegExp(escapedQuery, 'i');
        const blockedIds = req.user.bloqueados || [];
        const users = await User.find({
            _id: { $nin: [req.user._id, ...blockedIds] },
            bloqueados: { $ne: req.user._id },
            $or: [
                { nome: matcher },
                { email: matcher, permitirBuscaEmail: { $ne: false } },
            ],
        })
            .select('nome avatar avatarKey mostrarOnline')
            .sort({ nome: 1 })
            .limit(12);
        return res.json({ usuarios: users.map((user) => publicUser(user)) });
    } catch (error) {
        console.error('Erro ao pesquisar usuários:', error);
        return res.status(500).json({ erro: 'Não foi possível pesquisar agora.' });
    }
});

app.get('/api/conversations', authenticateRequest, async (req, res) => {
    try {
        await ensureLegacyPrivateConversations(req.user._id);
        const conversations = await Conversation.find({ membros: req.user._id })
            .populate('membros', 'nome avatar avatarKey mostrarOnline bloqueados')
            .sort({ ultimaMensagemEm: -1 });
        const blockedByViewer = new Set((req.user.bloqueados || []).map((id) => id.toString()));
        return res.json({
            conversas: conversations
                .filter((conversation) => {
                    if (conversation.tipo !== 'private') return true;
                    const other = conversation.membros.find((member) => memberId(member) !== req.user._id.toString());
                    return other
                        && !blockedByViewer.has(memberId(other))
                        && !(other.bloqueados || []).some((id) => id.toString() === req.user._id.toString());
                })
                .map((conversation) => publicConversation(conversation, req.user._id))
                .filter(Boolean),
        });
    } catch (error) {
        console.error('Erro ao listar conversas:', error);
        return res.status(500).json({ erro: 'Não foi possível carregar as conversas.' });
    }
});

app.patch('/api/conversations/:conversationId/preferences', authenticateRequest, async (req, res) => {
    try {
        const conversation = await Conversation.findOne({
            conversaId: req.params.conversationId,
            membros: req.user._id,
        });
        if (!conversation) return res.status(404).json({ erro: 'Conversa não encontrada.' });
        ensureConversationStates(conversation, conversation.membros);
        const state = conversation.estados.find((item) => memberId(item.usuario) === req.user._id.toString());
        if (typeof req.body.pinned === 'boolean') state.fixada = req.body.pinned;
        if (typeof req.body.archived === 'boolean') state.arquivada = req.body.archived;
        if (typeof req.body.muted === 'boolean') state.silenciada = req.body.muted;
        await conversation.save();
        emitConversationsChanged([req.user._id]);
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ erro: 'Não foi possível atualizar a conversa.' });
    }
});

app.post('/api/conversations/:conversationId/accept', authenticateRequest, async (req, res) => {
    const conversation = await Conversation.findOne({
        conversaId: req.params.conversationId,
        tipo: 'private',
        membros: req.user._id,
    });
    if (!conversation) return res.status(404).json({ erro: 'Solicitação não encontrada.' });
    ensureConversationStates(conversation, conversation.membros);
    const state = conversation.estados.find((item) => memberId(item.usuario) === req.user._id.toString());
    state.aceita = true;
    await conversation.save();
    emitConversationsChanged(conversation.membros);
    return res.json({ ok: true });
});

app.get('/api/conversations/:conversationId/media', authenticateRequest, async (req, res) => {
    try {
        const conversation = await resolveConversation(req.user, { conversaId: req.params.conversationId });
        const messages = await Message.find({
            ...historyQuery(req.user, conversation),
            anexo: { $ne: null },
            excluidaParaTodos: false,
        }).sort({ createdAt: -1 }).limit(120);
        return res.json({ items: messages.map(publicMessage) });
    } catch (error) {
        return res.status(403).json({ erro: error.message || 'Não foi possível abrir os arquivos.' });
    }
});

app.post('/api/groups', authenticateRequest, async (req, res) => {
    try {
        const nome = String(req.body.nome || '').trim().slice(0, 60);
        const requestedIds = Array.isArray(req.body.membroIds) ? req.body.membroIds : [];
        const uniqueIds = [...new Set(requestedIds.map(String))]
            .filter((id) => mongoose.isValidObjectId(id) && id !== req.user._id.toString())
            .slice(0, 49);

        if (nome.length < 3) {
            return res.status(400).json({ erro: 'O nome do grupo precisa ter pelo menos 3 caracteres.' });
        }
        if (!uniqueIds.length) {
            return res.status(400).json({ erro: 'Adicione pelo menos uma pessoa ao grupo.' });
        }

        const invitedUsers = await User.find({ _id: { $in: uniqueIds } }).select('_id');
        if (!invitedUsers.length) {
            return res.status(400).json({ erro: 'Nenhuma pessoa válida foi selecionada.' });
        }

        const groupId = new mongoose.Types.ObjectId();
        let conversation = await Conversation.create({
            _id: groupId,
            conversaId: `group:${groupId}`,
            tipo: 'group',
            nome,
            criador: req.user._id,
            membros: [req.user._id, ...invitedUsers.map((user) => user._id)],
            administradores: [req.user._id],
            estados: [req.user._id, ...invitedUsers.map((user) => user._id)]
                .map((userId) => ({ usuario: userId, aceita: true, naoLidas: 0 })),
            conviteToken: crypto.randomBytes(18).toString('hex'),
            ultimaMensagem: 'Grupo criado',
            ultimaMensagemEm: new Date(),
        });
        conversation = await conversation.populate('membros', 'nome avatar avatarKey mostrarOnline');
        emitConversationsChanged(conversation.membros.map(memberId));
        return res.status(201).json({
            conversa: publicConversation(conversation, req.user._id),
        });
    } catch (error) {
        console.error('Erro ao criar grupo:', error);
        return res.status(500).json({ erro: 'Não foi possível criar o grupo.' });
    }
});

app.patch('/api/groups/:conversationId/members', authenticateRequest, async (req, res) => {
    try {
        let conversation = await Conversation.findOne({
            conversaId: req.params.conversationId,
            tipo: 'group',
            $or: [{ criador: req.user._id }, { administradores: req.user._id }],
        });
        if (!conversation) {
            return res.status(403).json({ erro: 'Somente quem criou o grupo pode adicionar pessoas.' });
        }

        const existingIds = new Set(conversation.membros.map(memberId));
        const requestedIds = Array.isArray(req.body.membroIds) ? req.body.membroIds : [];
        const uniqueIds = [...new Set(requestedIds.map(String))]
            .filter((id) => mongoose.isValidObjectId(id) && !existingIds.has(id))
            .slice(0, Math.max(0, 50 - existingIds.size));
        if (!uniqueIds.length) {
            return res.status(400).json({ erro: 'Selecione pelo menos uma pessoa nova.' });
        }

        const invitedUsers = await User.find({ _id: { $in: uniqueIds } }).select('_id');
        if (!invitedUsers.length) {
            return res.status(400).json({ erro: 'Nenhuma pessoa válida foi selecionada.' });
        }

        conversation.membros.push(...invitedUsers.map((user) => user._id));
        ensureConversationStates(conversation, conversation.membros);
        conversation.ultimaMensagem = 'Novos participantes adicionados';
        conversation.ultimaMensagemEm = new Date();
        await conversation.save();
        conversation = await conversation.populate('membros', 'nome avatar avatarKey mostrarOnline');
        emitConversationsChanged(conversation.membros.map(memberId));
        return res.json({ conversa: publicConversation(conversation, req.user._id) });
    } catch (error) {
        console.error('Erro ao adicionar pessoas ao grupo:', error);
        return res.status(500).json({ erro: 'Não foi possível atualizar o grupo.' });
    }
});

app.patch('/api/groups/:conversationId', authenticateRequest, async (req, res) => {
    try {
        const conversation = await Conversation.findOne({
            conversaId: req.params.conversationId,
            tipo: 'group',
            $or: [{ criador: req.user._id }, { administradores: req.user._id }],
        });
        if (!conversation) return res.status(403).json({ erro: 'Você não pode editar este grupo.' });
        const nome = String(req.body.name || '').trim().slice(0, 60);
        if (nome.length < 3) return res.status(400).json({ erro: 'Informe um nome válido.' });
        conversation.nome = nome;
        await conversation.save();
        emitConversationsChanged(conversation.membros);
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ erro: 'Não foi possível editar o grupo.' });
    }
});

app.post('/api/groups/:conversationId/avatar', authenticateRequest, upload.single('arquivo'), async (req, res) => {
    try {
        const conversation = await Conversation.findOne({
            conversaId: req.params.conversationId,
            tipo: 'group',
            $or: [{ criador: req.user._id }, { administradores: req.user._id }],
        });
        if (!conversation) return res.status(403).json({ erro: 'Você não pode editar este grupo.' });
        if (!req.file?.mimetype.startsWith('image/')) {
            return res.status(400).json({ erro: 'Escolha uma imagem.' });
        }
        const oldKey = conversation.avatarKey;
        const uploaded = await uploadToR2(req.file, 'avatares');
        conversation.avatar = uploaded.url;
        conversation.avatarKey = uploaded.key;
        await conversation.save();
        await removeFromR2(oldKey);
        emitConversationsChanged(conversation.membros);
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ erro: 'Não foi possível atualizar a foto do grupo.' });
    }
});

app.delete('/api/groups/:conversationId/members/:userId', authenticateRequest, async (req, res) => {
    const conversation = await Conversation.findOne({
        conversaId: req.params.conversationId,
        tipo: 'group',
        $or: [{ criador: req.user._id }, { administradores: req.user._id }],
    });
    if (!conversation) return res.status(403).json({ erro: 'Você não pode remover participantes.' });
    const targetId = String(req.params.userId || '');
    if (targetId === memberId(conversation.criador)) {
        return res.status(400).json({ erro: 'Transfira a propriedade antes de remover o criador.' });
    }
    conversation.membros = conversation.membros.filter((id) => id.toString() !== targetId);
    conversation.administradores = conversation.administradores.filter((id) => id.toString() !== targetId);
    conversation.estados = conversation.estados.filter((item) => memberId(item.usuario) !== targetId);
    await conversation.save();
    emitConversationsChanged([...conversation.membros, targetId]);
    return res.json({ ok: true });
});

app.patch('/api/groups/:conversationId/admins', authenticateRequest, async (req, res) => {
    const conversation = await Conversation.findOne({
        conversaId: req.params.conversationId,
        tipo: 'group',
        criador: req.user._id,
    });
    if (!conversation) return res.status(403).json({ erro: 'Somente o criador pode definir administradores.' });
    const targetId = String(req.body.userId || '');
    if (!conversation.membros.some((id) => id.toString() === targetId)) {
        return res.status(400).json({ erro: 'Esta pessoa não participa do grupo.' });
    }
    if (req.body.isAdmin === false) conversation.administradores.pull(targetId);
    else conversation.administradores.addToSet(targetId);
    await conversation.save();
    emitConversationsChanged(conversation.membros);
    return res.json({ ok: true });
});

app.post('/api/groups/:conversationId/transfer', authenticateRequest, async (req, res) => {
    const conversation = await Conversation.findOne({
        conversaId: req.params.conversationId,
        tipo: 'group',
        criador: req.user._id,
    });
    if (!conversation) return res.status(403).json({ erro: 'Somente o criador pode transferir o grupo.' });
    const targetId = String(req.body.userId || '');
    if (!conversation.membros.some((id) => id.toString() === targetId)) {
        return res.status(400).json({ erro: 'Escolha um participante do grupo.' });
    }
    conversation.criador = targetId;
    conversation.administradores.addToSet(targetId);
    await conversation.save();
    emitConversationsChanged(conversation.membros);
    return res.json({ ok: true });
});

app.post('/api/groups/:conversationId/leave', authenticateRequest, async (req, res) => {
    const conversation = await Conversation.findOne({
        conversaId: req.params.conversationId,
        tipo: 'group',
        membros: req.user._id,
    });
    if (!conversation) return res.status(404).json({ erro: 'Grupo não encontrado.' });
    if (memberId(conversation.criador) === req.user._id.toString() && conversation.membros.length > 1) {
        return res.status(400).json({ erro: 'Transfira a propriedade antes de sair.' });
    }
    if (conversation.membros.length === 1) {
        await Conversation.deleteOne({ _id: conversation._id });
    } else {
        conversation.membros.pull(req.user._id);
        conversation.administradores.pull(req.user._id);
        conversation.estados = conversation.estados.filter((item) => memberId(item.usuario) !== req.user._id.toString());
        await conversation.save();
    }
    emitConversationsChanged(conversation.membros);
    return res.json({ ok: true });
});

app.post('/api/groups/:conversationId/invite/reset', authenticateRequest, async (req, res) => {
    const conversation = await Conversation.findOne({
        conversaId: req.params.conversationId,
        tipo: 'group',
        $or: [{ criador: req.user._id }, { administradores: req.user._id }],
    });
    if (!conversation) return res.status(403).json({ erro: 'Você não pode gerar convites.' });
    conversation.conviteToken = crypto.randomBytes(18).toString('hex');
    await conversation.save();
    return res.json({ token: conversation.conviteToken });
});

app.post('/api/groups/join/:token', authenticateRequest, async (req, res) => {
    let conversation = await Conversation.findOne({ tipo: 'group', conviteToken: req.params.token });
    if (!conversation) return res.status(404).json({ erro: 'Este convite expirou ou foi revogado.' });
    if (!conversation.membros.some((id) => id.toString() === req.user._id.toString())) {
        if (conversation.membros.length >= 50) return res.status(400).json({ erro: 'Este grupo está cheio.' });
        conversation.membros.push(req.user._id);
        ensureConversationStates(conversation, conversation.membros);
        await conversation.save();
        emitConversationsChanged(conversation.membros);
    }
    conversation = await conversation.populate('membros', 'nome avatar avatarKey mostrarOnline');
    return res.json({ conversa: publicConversation(conversation, req.user._id) });
});

app.get('/api/files/{*key}', authenticateFileRequest, async (req, res) => {
    try {
        const rawKey = Array.isArray(req.params.key) ? req.params.key.join('/') : req.params.key;
        const key = decodeURIComponent(rawKey || '');
        if (!key || (!key.startsWith('mensagens/') && !key.startsWith('avatares/'))) {
            return res.status(400).end();
        }

        if (key.startsWith('mensagens/')) {
            const message = await Message.findOne({ 'anexo.key': key })
                .select('tipoConversa participantes excluidaPara excluidaParaTodos');
            if (!message || message.excluidaParaTodos) return res.status(404).end();
            const userId = req.user._id.toString();
            if (message.excluidaPara.some((id) => id.toString() === userId)) {
                return res.status(404).end();
            }
            if (message.tipoConversa !== 'community'
                && !message.participantes.some((id) => id.toString() === userId)) {
                return res.status(403).end();
            }
        }

        const input = { Bucket: R2_BUCKET, Key: key };
        if (req.headers.range) input.Range = req.headers.range;
        const object = await s3.send(new GetObjectCommand(input));

        res.status(object.ContentRange ? 206 : 200);
        res.setHeader('Content-Type', object.ContentType || 'application/octet-stream');
        res.setHeader('Accept-Ranges', object.AcceptRanges || 'bytes');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        if (object.ContentLength != null) res.setHeader('Content-Length', String(object.ContentLength));
        if (object.ContentRange) res.setHeader('Content-Range', object.ContentRange);
        if (object.ETag) res.setHeader('ETag', object.ETag);
        if (object.ContentDisposition) res.setHeader('Content-Disposition', object.ContentDisposition);

        object.Body.on('error', (error) => {
            console.error('Erro durante leitura do R2:', error.message);
            if (!res.headersSent) res.status(500).end();
            else res.destroy(error);
        });
        return object.Body.pipe(res);
    } catch (error) {
        console.error('Erro ao abrir arquivo do R2:', error.message);
        return res.status(error?.$metadata?.httpStatusCode === 404 ? 404 : 502).end();
    }
});

app.post('/api/profile/avatar', authenticateRequest, upload.single('arquivo'), async (req, res) => {
    try {
        if (!req.file?.mimetype.startsWith('image/')) {
            return res.status(400).json({ erro: 'Escolha uma imagem para o perfil.' });
        }

        const oldKey = req.user.avatarKey;
        const result = await uploadToR2(req.file, 'avatares');
        req.user.avatar = result.url;
        req.user.avatarKey = result.key;
        await req.user.save();
        await Message.updateMany(
            { remetente: req.user._id },
            {
                remetenteAvatar: result.url,
                remetenteAvatarKey: result.key,
            },
        );
        await removeFromR2(oldKey);

        const user = publicUser(req.user);
        io.emit('profile updated', user);
        return res.json({ usuario: user });
    } catch (error) {
        console.error('Erro ao atualizar foto:', error);
        return res.status(500).json({ erro: 'Não foi possível atualizar sua foto.' });
    }
});

app.post('/api/messages/upload', authenticateRequest, upload.single('arquivo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ erro: 'Escolha um arquivo.' });
        if (!checkMessageRateLimit(req.user._id.toString())) {
            return res.status(429).json({ erro: 'Muitas mensagens em sequência. Aguarde alguns segundos.' });
        }

        const conversation = await resolveConversation(req.user, req.body);
        assertCanSend(conversation, req.user._id);
        const resposta = await replySnapshot(conversation, req.body.replyToId);
        const result = await uploadToR2(req.file, 'mensagens');
        const message = await Message.create({
            texto: String(req.body.texto || '').trim().slice(0, 4000),
            anexo: {
                ...result,
                nome: req.file.originalname,
                tipo: req.file.mimetype,
                tamanho: req.file.size,
                categoria: attachmentCategory(req.file.mimetype),
                visualizacaoUnica: req.body.viewOnce === 'true',
            },
            remetente: req.user._id,
            remetenteNome: req.user.nome,
            remetenteAvatar: req.user.avatar,
            remetenteAvatarKey: req.user.avatarKey,
            conversaId: conversation.id,
            tipoConversa: conversation.type,
            participantes: conversation.participants,
            destinatario: conversation.recipient?._id || null,
            resposta,
            entreguePara: deliveryRecipients(conversation, req.user._id),
            lidaPor: [req.user._id],
        });

        const payload = publicMessage(message);
        await touchConversation(conversation, message);
        sendPushNotifications(conversation, message).catch(() => {});
        emitToConversation(message, 'chat message', payload);
        return res.status(201).json({ mensagem: payload });
    } catch (error) {
        console.error('Erro no upload:', error);
        return res.status(500).json({ erro: error.message || 'Erro ao enviar o arquivo.' });
    }
});

app.get('/api/health', (_req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    res.status(databaseReady ? 200 : 503).json({
        status: databaseReady ? 'ok' : 'starting',
        database: databaseReady ? 'connected' : 'connecting',
    });
});

app.all('/api/{*splat}', (_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

io.use(async (socket, next) => {
    try {
        const user = await userFromToken(socket.handshake.auth?.token);
        if (!user) return next(new Error('Sessão inválida.'));
        socket.user = user;
        return next();
    } catch (_error) {
        return next(new Error('Sessão expirada.'));
    }
});

io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`Usuário conectado: ${socket.user.nome}`);
    socket.join(COMMUNITY_ID);
    socket.join(`user:${userId}`);
    onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
    emitPresence();

    socket.on('load conversation', async (payload, acknowledge) => {
        try {
            const conversation = await resolveConversation(socket.user, payload);
            const history = await Message.find(historyQuery(socket.user, conversation))
                .sort({ createdAt: 1 })
                .limit(250);
            const messageIds = history.map((message) => message._id);
            if (messageIds.length) {
                const receiptUpdate = socket.user.confirmarLeitura === false
                    ? { $addToSet: { entreguePara: socket.user._id } }
                    : { $addToSet: { entreguePara: socket.user._id, lidaPor: socket.user._id } };
                await Message.updateMany(
                    { _id: { $in: messageIds } },
                    receiptUpdate,
                );
            }
            if (conversation.type !== 'community') {
                const document = conversation.document || conversation.group
                    || await Conversation.findOne({ conversaId: conversation.id });
                if (document) {
                    ensureConversationStates(document, conversation.participants);
                    const state = document.estados.find((item) => memberId(item.usuario) === userId);
                    if (state) {
                        state.naoLidas = 0;
                        state.ultimaLeituraEm = new Date();
                        await document.save();
                    }
                    emitConversationsChanged([socket.user._id]);
                }
            } else {
                await User.findByIdAndUpdate(socket.user._id, {
                    comunidadeNaoLidas: 0,
                    comunidadeUltimaLeituraEm: new Date(),
                });
            }
            socket.emit('historico', {
                conversaId: conversation.id,
                mensagens: history.map((message) => {
                    if (!message.entreguePara.some((id) => id.toString() === userId)) message.entreguePara.push(socket.user._id);
                    if (socket.user.confirmarLeitura !== false
                        && !message.lidaPor.some((id) => id.toString() === userId)) message.lidaPor.push(socket.user._id);
                    return publicMessage(message);
                }),
            });
            if (conversation.type !== 'community' && socket.user.confirmarLeitura !== false) {
                const eventPayload = { conversaId: conversation.id, userId, readAt: new Date() };
                const target = conversation.participants.reduce((emitter, id) => emitter.to(`user:${id}`), io);
                target.emit('messages read', eventPayload);
            }
            return acknowledge?.({ ok: true, conversaId: conversation.id });
        } catch (error) {
            return acknowledge?.({ ok: false, erro: error.message || 'Não foi possível abrir a conversa.' });
        }
    });

    socket.on('mark read', async (payload) => {
        try {
            const conversation = await resolveConversation(socket.user, payload);
            const receiptUpdate = socket.user.confirmarLeitura === false
                ? { $addToSet: { entreguePara: socket.user._id } }
                : { $addToSet: { entreguePara: socket.user._id, lidaPor: socket.user._id } };
            await Message.updateMany(
                { ...historyQuery(socket.user, conversation), remetente: { $ne: socket.user._id } },
                receiptUpdate,
            );
            if (conversation.type === 'community') {
                await User.findByIdAndUpdate(socket.user._id, {
                    comunidadeNaoLidas: 0,
                    comunidadeUltimaLeituraEm: new Date(),
                });
            } else {
                const document = conversation.document || conversation.group
                    || await Conversation.findOne({ conversaId: conversation.id });
                if (document) {
                    ensureConversationStates(document, conversation.participants);
                    const state = document.estados.find((item) => memberId(item.usuario) === userId);
                    if (state) {
                        state.naoLidas = 0;
                        state.ultimaLeituraEm = new Date();
                        await document.save();
                    }
                    emitConversationsChanged([socket.user._id]);
                }
                if (socket.user.confirmarLeitura !== false) {
                    const eventPayload = { conversaId: conversation.id, userId, readAt: new Date() };
                    conversation.participants.forEach((id) => io.to(`user:${id}`).emit('messages read', eventPayload));
                }
            }
        } catch (_error) {
            // A leitura será sincronizada novamente ao abrir a conversa.
        }
    });

    socket.on('chat message', async (payload, acknowledge) => {
        try {
            const texto = String(payload?.texto || '').trim().slice(0, 4000);
            if (!texto) return acknowledge?.({ ok: false, erro: 'Digite uma mensagem.' });
            if (!checkMessageRateLimit(userId)) {
                return acknowledge?.({ ok: false, erro: 'Muitas mensagens em sequência. Aguarde alguns segundos.' });
            }

            const conversation = await resolveConversation(socket.user, payload);
            assertCanSend(conversation, socket.user._id);
            const resposta = await replySnapshot(conversation, payload?.replyToId);
            const message = await Message.create({
                texto,
                remetente: socket.user._id,
                remetenteNome: socket.user.nome,
                remetenteAvatar: socket.user.avatar,
                remetenteAvatarKey: socket.user.avatarKey,
                conversaId: conversation.id,
                tipoConversa: conversation.type,
                participantes: conversation.participants,
                destinatario: conversation.recipient?._id || null,
                resposta,
                entreguePara: deliveryRecipients(conversation, socket.user._id),
                lidaPor: [socket.user._id],
            });
            const publicPayload = publicMessage(message);
            await touchConversation(conversation, message);
            sendPushNotifications(conversation, message).catch(() => {});
            emitToConversation(message, 'chat message', publicPayload);
            return acknowledge?.({ ok: true, mensagem: publicPayload });
        } catch (error) {
            console.error('Erro ao salvar mensagem:', error);
            return acknowledge?.({ ok: false, erro: error.message || 'Não foi possível enviar.' });
        }
    });

    socket.on('typing', async (payload) => {
        try {
            const conversation = await resolveConversation(socket.user, payload);
            const typingPayload = {
                conversaId: conversation.id,
                userId,
                name: socket.user.nome,
                typing: Boolean(payload?.typing),
            };
            if (conversation.type === 'community') {
                socket.to(COMMUNITY_ID).emit('typing', typingPayload);
            } else {
                conversation.participants
                    .filter((id) => id.toString() !== userId)
                    .forEach((id) => io.to(`user:${id}`).emit('typing', typingPayload));
            }
        } catch (_error) {
            // Eventos de digitação são efêmeros e podem ser ignorados.
        }
    });

    socket.on('edit message', async (payload, acknowledge) => {
        try {
            const texto = String(payload?.text || '').trim().slice(0, 4000);
            const message = await Message.findById(payload?.messageId);
            if (!message || message.remetente.toString() !== userId || message.excluidaParaTodos) {
                return acknowledge?.({ ok: false, erro: 'Mensagem não encontrada.' });
            }
            if (Date.now() - message.createdAt.getTime() > 15 * 60 * 1000) {
                return acknowledge?.({ ok: false, erro: 'O prazo de 15 minutos para editar terminou.' });
            }
            if (!texto) return acknowledge?.({ ok: false, erro: 'A mensagem não pode ficar vazia.' });
            message.texto = texto;
            message.editadaEm = new Date();
            await message.save();
            const updated = publicMessage(message);
            emitToConversation(message, 'message edited', updated);
            return acknowledge?.({ ok: true, mensagem: updated });
        } catch (error) {
            return acknowledge?.({ ok: false, erro: 'Não foi possível editar a mensagem.' });
        }
    });

    socket.on('react message', async (payload, acknowledge) => {
        try {
            const emoji = String(payload?.emoji || '').slice(0, 8);
            if (!['👍', '❤️', '😂', '😮', '😢', '🙏'].includes(emoji)) {
                return acknowledge?.({ ok: false, erro: 'Reação inválida.' });
            }
            const message = await Message.findById(payload?.messageId);
            if (!message || message.excluidaParaTodos) {
                return acknowledge?.({ ok: false, erro: 'Mensagem não encontrada.' });
            }
            const canAccess = message.tipoConversa === 'community'
                || message.participantes.some((id) => id.toString() === userId);
            if (!canAccess) return acknowledge?.({ ok: false, erro: 'Acesso não permitido.' });
            let reaction = message.reacoes.find((item) => item.emoji === emoji);
            if (!reaction) {
                message.reacoes.push({ emoji, usuarios: [socket.user._id] });
            } else if (reaction.usuarios.some((id) => id.toString() === userId)) {
                reaction.usuarios = reaction.usuarios.filter((id) => id.toString() !== userId);
                if (!reaction.usuarios.length) message.reacoes = message.reacoes.filter((item) => item.emoji !== emoji);
            } else {
                reaction.usuarios.push(socket.user._id);
            }
            await message.save();
            const updated = publicMessage(message);
            emitToConversation(message, 'message reacted', {
                messageId: updated.id,
                conversaId: updated.conversaId,
                reactions: updated.reactions,
            });
            return acknowledge?.({ ok: true });
        } catch (error) {
            return acknowledge?.({ ok: false, erro: 'Não foi possível reagir.' });
        }
    });

    socket.on('pin message', async (payload, acknowledge) => {
        try {
            const message = await Message.findById(payload?.messageId);
            if (!message || message.excluidaParaTodos || message.tipoConversa === 'community') {
                return acknowledge?.({ ok: false, erro: 'Esta mensagem não pode ser fixada.' });
            }
            const conversation = await Conversation.findOne({
                conversaId: message.conversaId,
                membros: socket.user._id,
            });
            if (!conversation) return acknowledge?.({ ok: false, erro: 'Conversa não encontrada.' });
            const isGroupAdmin = conversation.tipo !== 'group'
                || memberId(conversation.criador) === userId
                || conversation.administradores.some((id) => id.toString() === userId);
            if (!isGroupAdmin) return acknowledge?.({ ok: false, erro: 'Somente administradores podem fixar.' });
            conversation.mensagemFixada = payload?.pinned === false ? null : message._id;
            await conversation.save();
            emitConversationsChanged(conversation.membros);
            const eventPayload = {
                conversaId: conversation.conversaId,
                messageId: payload?.pinned === false ? '' : message._id.toString(),
            };
            conversation.membros.forEach((id) => io.to(`user:${id}`).emit('message pinned', eventPayload));
            return acknowledge?.({ ok: true });
        } catch (error) {
            return acknowledge?.({ ok: false, erro: 'Não foi possível fixar.' });
        }
    });

    socket.on('delete message', async (payload, acknowledge) => {
        try {
            const message = await Message.findById(payload?.messageId);
            if (!message) return acknowledge?.({ ok: false, erro: 'Mensagem não encontrada.' });

            const isRestricted = message.tipoConversa !== 'community';
            const canAccess = !isRestricted
                || message.participantes.some((id) => id.toString() === userId);
            if (!canAccess) return acknowledge?.({ ok: false, erro: 'Você não participa desta conversa.' });

            if (payload.scope === 'todos') {
                if (message.remetente.toString() !== userId) {
                    return acknowledge?.({ ok: false, erro: 'Você só pode apagar suas mensagens para todos.' });
                }
                await removeFromR2(message.anexo?.key);
                message.excluidaParaTodos = true;
                message.texto = '';
                message.anexo = null;
                await message.save();
                emitToConversation(message, 'message deleted', {
                    messageId: message._id.toString(),
                    conversaId: message.conversaId || COMMUNITY_ID,
                    scope: 'todos',
                });
            } else {
                if (!message.excluidaPara.some((id) => id.toString() === userId)) {
                    message.excluidaPara.push(socket.user._id);
                    await message.save();
                }
                io.to(`user:${userId}`).emit('message deleted', {
                    messageId: message._id.toString(),
                    conversaId: message.conversaId || COMMUNITY_ID,
                    scope: 'mim',
                });
            }
            return acknowledge?.({ ok: true });
        } catch (error) {
            console.error('Erro ao excluir mensagem:', error);
            return acknowledge?.({ ok: false, erro: 'Não foi possível excluir.' });
        }
    });

    socket.on('disconnect', () => {
        const remaining = (onlineUsers.get(userId) || 1) - 1;
        if (remaining > 0) onlineUsers.set(userId, remaining);
        else onlineUsers.delete(userId);
        emitPresence();
    });
});

app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ erro: 'O arquivo deve ter no máximo 50 MB.' });
    }
    return res.status(400).json({ erro: error.message || 'Não foi possível concluir a operação.' });
});

server.listen(PORT, () => {
    console.log(`ChegouZap disponível em http://localhost:${PORT}`);
});
