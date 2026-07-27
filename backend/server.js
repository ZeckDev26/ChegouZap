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
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
    texto: { type: String, trim: true, maxlength: 4000, default: '' },
    anexo: { type: mongoose.Schema.Types.Mixed, default: null },
    remetente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    remetenteNome: { type: String, required: true },
    remetenteAvatar: { type: String, default: '' },
    remetenteAvatarKey: { type: String, default: '' },
    conversaId: { type: String, default: COMMUNITY_ID, index: true },
    tipoConversa: { type: String, enum: ['community', 'private'], default: 'community' },
    participantes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    destinatario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    excluidaPara: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    excluidaParaTodos: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: '15d' },
}, { versionKey: false });

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

function createToken(user) {
    return jwt.sign({ sub: user._id.toString() }, JWT_SECRET, { expiresIn: TOKEN_DURATION });
}

function inferR2Key(value = '') {
    if (!value) return '';
    const decoded = decodeURIComponent(String(value));
    const match = decoded.match(/(?:^|\/)((?:mensagens|avatares)\/[^?#]+)/);
    return match?.[1] || '';
}

function publicUser(user) {
    return {
        id: user._id.toString(),
        nome: user.nome,
        email: user.email,
        avatar: user.avatar || '',
        avatarKey: user.avatarKey || inferR2Key(user.avatar),
        online: onlineUsers.has(user._id.toString()),
    };
}

function normalizeAttachment(attachment) {
    if (!attachment) return null;
    if (typeof attachment === 'string') {
        return {
            url: attachment,
            key: inferR2Key(attachment),
            nome: 'Imagem',
            tipo: 'image/*',
            categoria: 'imagem',
        };
    }
    return {
        ...attachment,
        key: attachment.key || inferR2Key(attachment.url),
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

async function resolveConversation(user, payload = {}) {
    if (!payload.destinatarioId && (!payload.conversaId || payload.conversaId === COMMUNITY_ID)) {
        return {
            id: COMMUNITY_ID,
            type: 'community',
            participants: [],
            recipient: null,
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

    return {
        id: privateConversationId(user._id, recipient._id),
        type: 'private',
        participants: [user._id, recipient._id],
        recipient,
    };
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
    if (conversationId === COMMUNITY_ID || message.tipoConversa !== 'private') {
        io.to(COMMUNITY_ID).emit(eventName, payload);
        return;
    }

    const participants = (message.participantes || []).map((id) => id.toString());
    const target = participants.reduce((emitter, id) => emitter.to(`user:${id}`), io);
    target.emit(eventName, payload);
}

function emitPresence() {
    io.emit('presence', {
        online: onlineUsers.size,
        userIds: [...onlineUsers.keys()],
    });
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

        io.emit('users changed');
        return res.status(201).json({ token: createToken(user), usuario: publicUser(user) });
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

        return res.json({ token: createToken(user), usuario: publicUser(user) });
    } catch (error) {
        console.error('Erro ao entrar:', error);
        return res.status(500).json({ erro: 'Não foi possível entrar agora.' });
    }
});

app.get('/api/auth/me', authenticateRequest, (req, res) => {
    res.json({ usuario: publicUser(req.user) });
});

app.get('/api/users', authenticateRequest, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user._id } })
            .select('nome email avatar avatarKey')
            .sort({ nome: 1 });
        return res.json({ usuarios: users.map(publicUser) });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        return res.status(500).json({ erro: 'Não foi possível carregar as conversas.' });
    }
});

app.get('/api/files/{*key}', authenticateFileRequest, async (req, res) => {
    try {
        const rawKey = Array.isArray(req.params.key) ? req.params.key.join('/') : req.params.key;
        const key = decodeURIComponent(rawKey || '');
        if (!key || (!key.startsWith('mensagens/') && !key.startsWith('avatares/'))) {
            return res.status(400).end();
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

        const conversation = await resolveConversation(req.user, req.body);
        const result = await uploadToR2(req.file, 'mensagens');
        const message = await Message.create({
            texto: String(req.body.texto || '').trim().slice(0, 4000),
            anexo: {
                ...result,
                nome: req.file.originalname,
                tipo: req.file.mimetype,
                tamanho: req.file.size,
                categoria: attachmentCategory(req.file.mimetype),
            },
            remetente: req.user._id,
            remetenteNome: req.user.nome,
            remetenteAvatar: req.user.avatar,
            remetenteAvatarKey: req.user.avatarKey,
            conversaId: conversation.id,
            tipoConversa: conversation.type,
            participantes: conversation.participants,
            destinatario: conversation.recipient?._id || null,
        });

        const payload = publicMessage(message);
        emitToConversation(message, 'chat message', payload);
        return res.status(201).json({ mensagem: payload });
    } catch (error) {
        console.error('Erro no upload:', error);
        return res.status(500).json({ erro: error.message || 'Erro ao enviar o arquivo.' });
    }
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
            socket.emit('historico', {
                conversaId: conversation.id,
                mensagens: history.map(publicMessage),
            });
            return acknowledge?.({ ok: true, conversaId: conversation.id });
        } catch (error) {
            return acknowledge?.({ ok: false, erro: error.message || 'Não foi possível abrir a conversa.' });
        }
    });

    socket.on('chat message', async (payload, acknowledge) => {
        try {
            const texto = String(payload?.texto || '').trim().slice(0, 4000);
            if (!texto) return acknowledge?.({ ok: false, erro: 'Digite uma mensagem.' });

            const conversation = await resolveConversation(socket.user, payload);
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
            });
            const publicPayload = publicMessage(message);
            emitToConversation(message, 'chat message', publicPayload);
            return acknowledge?.({ ok: true, mensagem: publicPayload });
        } catch (error) {
            console.error('Erro ao salvar mensagem:', error);
            return acknowledge?.({ ok: false, erro: error.message || 'Não foi possível enviar.' });
        }
    });

    socket.on('delete message', async (payload, acknowledge) => {
        try {
            const message = await Message.findById(payload?.messageId);
            if (!message) return acknowledge?.({ ok: false, erro: 'Mensagem não encontrada.' });

            const isPrivate = message.tipoConversa === 'private';
            const canAccess = !isPrivate
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
