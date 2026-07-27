const COMMUNITY_ID = 'community';
const EMOJIS = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
    '😊', '🙂', '🙃', '😉', '😍', '🥰', '😘', '😎',
    '🤩', '🥳', '😇', '🤔', '🤗', '🤭', '🫢', '🫡',
    '😴', '😢', '😭', '😤', '😡', '🤯', '😱', '🥺',
    '👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '👋',
    '👌', '✌️', '🤞', '🫶', '❤️', '💚', '💙', '💜',
    '🔥', '✨', '🎉', '🎂', '🎁', '🏆', '✅', '🚀',
    '☕', '🍕', '🍔', '🍫', '⚽', '🎮', '📸', '💬',
];

const state = {
    mode: 'login',
    token: localStorage.getItem('chegouzap_token') || '',
    user: null,
    users: [],
    onlineUserIds: new Set(),
    socket: null,
    activeConversation: {
        id: COMMUNITY_ID,
        type: 'community',
        recipientId: '',
        name: 'Comunidade ChegouZap',
    },
    selectedMessageId: null,
    selectedMessageIsMine: false,
    uploadObjectUrl: '',
    toastTimer: null,
};

const elements = {
    authScreen: document.getElementById('authScreen'),
    chatApp: document.getElementById('chatApp'),
    authForm: document.getElementById('authForm'),
    authTitle: document.getElementById('authTitle'),
    authSubtitle: document.getElementById('authSubtitle'),
    authSubmit: document.getElementById('authSubmit'),
    authError: document.getElementById('authError'),
    authModeToggle: document.getElementById('authModeToggle'),
    switchPrompt: document.getElementById('switchPrompt'),
    nameField: document.getElementById('nameField'),
    nameInput: document.getElementById('nameInput'),
    emailInput: document.getElementById('emailInput'),
    passwordInput: document.getElementById('passwordInput'),
    passwordToggle: document.getElementById('passwordToggle'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileAvatarButton: document.getElementById('profileAvatarButton'),
    profileAvatarInput: document.getElementById('profileAvatarInput'),
    logoutButton: document.getElementById('logoutButton'),
    communityConversation: document.getElementById('communityConversation'),
    directConversations: document.getElementById('directConversations'),
    conversationEmpty: document.getElementById('conversationEmpty'),
    conversationCount: document.getElementById('conversationCount'),
    directCount: document.getElementById('directCount'),
    chatAvatar: document.getElementById('chatAvatar'),
    chatName: document.getElementById('chatName'),
    mobileBack: document.getElementById('mobileBack'),
    messages: document.getElementById('messages'),
    welcomeCard: document.getElementById('welcomeCard'),
    welcomeTitle: document.getElementById('welcomeTitle'),
    welcomeText: document.getElementById('welcomeText'),
    messageForm: document.getElementById('messageForm'),
    messageInput: document.getElementById('messageInput'),
    attachmentButton: document.getElementById('attachmentButton'),
    attachmentMenu: document.getElementById('attachmentMenu'),
    mediaInput: document.getElementById('mediaInput'),
    documentInput: document.getElementById('documentInput'),
    uploadProgress: document.getElementById('uploadProgress'),
    uploadPreview: document.getElementById('uploadPreview'),
    uploadFileName: document.getElementById('uploadFileName'),
    deleteModal: document.getElementById('deleteModal'),
    deleteForMeButton: document.getElementById('deleteForMeButton'),
    deleteForEveryoneButton: document.getElementById('deleteForEveryoneButton'),
    cancelDeleteButton: document.getElementById('cancelDeleteButton'),
    presenceText: document.getElementById('presenceText'),
    conversationPreview: document.getElementById('conversationPreview'),
    conversationTime: document.getElementById('conversationTime'),
    searchInput: document.getElementById('searchInput'),
    chatSearchButton: document.getElementById('chatSearchButton'),
    chatSearch: document.getElementById('chatSearch'),
    messageSearchInput: document.getElementById('messageSearchInput'),
    closeChatSearch: document.getElementById('closeChatSearch'),
    emojiButton: document.getElementById('emojiButton'),
    emojiMenu: document.getElementById('emojiMenu'),
    emojiGrid: document.getElementById('emojiGrid'),
    toast: document.getElementById('toast'),
};

function initials(name = '') {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'CZ';
}

function inferR2Key(value = '') {
    const match = decodeURIComponent(String(value || '')).match(/(?:^|\/)((?:mensagens|avatares)\/[^?#]+)/);
    return match?.[1] || '';
}

function protectedFileUrl(file) {
    const publicUrl = file?.url || file?.avatar || '';
    if (/^https?:\/\//i.test(publicUrl)) return publicUrl;

    const key = file?.key || file?.avatarKey || inferR2Key(file?.url || file?.avatar);
    if (key) {
        const encodedKey = key.split('/').map(encodeURIComponent).join('/');
        return `/api/files/${encodedKey}?token=${encodeURIComponent(state.token)}`;
    }

    return '';
}

function setAvatar(element, name, userOrUrl = '') {
    const url = typeof userOrUrl === 'string'
        ? (/^https?:\/\//i.test(userOrUrl) ? userOrUrl : '')
        : protectedFileUrl(userOrUrl);
    element.textContent = '';
    element.style.backgroundImage = '';
    element.classList.toggle('has-photo', Boolean(url));
    if (url) element.style.backgroundImage = `url("${encodeURI(url)}")`;
    else element.textContent = initials(name);
}

function showToast(message, type = 'info') {
    clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.dataset.type = type;
    elements.toast.classList.remove('is-hidden');
    state.toastTimer = setTimeout(() => elements.toast.classList.add('is-hidden'), 3200);
}

function setLoading(button, loading, label) {
    button.disabled = loading;
    if (loading) {
        button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = `<span class="button-spinner"></span><span>${label}</span>`;
    } else if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
    }
}

async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (state.token) headers.Authorization = `Bearer ${state.token}`;

    const response = await fetch(path, { ...options, headers });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json().catch(() => ({})) : {};
    if (!response.ok) {
        const outdatedServer = response.status === 404 && path.startsWith('/api/');
        throw new Error(
            payload.erro
            || (outdatedServer
                ? 'O servidor está desatualizado. Reinicie o ChegouZap e tente novamente.'
                : 'Não foi possível concluir a operação.'),
        );
    }
    return payload;
}

function updateAuthMode() {
    const registering = state.mode === 'register';
    elements.nameField.classList.toggle('is-hidden', !registering);
    elements.nameInput.required = registering;
    elements.passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
    elements.authTitle.textContent = registering ? 'Crie sua conta' : 'Que bom ter você aqui';
    elements.authSubtitle.textContent = registering
        ? 'Leva menos de um minuto para começar.'
        : 'Entre para continuar suas conversas.';
    elements.authSubmit.querySelector('span').textContent = registering ? 'Criar conta' : 'Entrar';
    elements.switchPrompt.textContent = registering ? 'Já possui uma conta?' : 'Ainda não tem uma conta?';
    elements.authModeToggle.textContent = registering ? 'Entrar' : 'Criar conta';
    elements.authError.textContent = '';
}

function showAuth() {
    elements.chatApp.classList.add('is-hidden');
    elements.authScreen.classList.remove('is-hidden');
    elements.emailInput.focus();
}

async function showChat() {
    elements.authScreen.classList.add('is-hidden');
    elements.chatApp.classList.remove('is-hidden');
    elements.profileName.textContent = state.user.nome;
    elements.profileEmail.textContent = state.user.email;
    setAvatar(elements.profileAvatar, state.user.nome, state.user);
    setActiveConversationHeader();
    if (window.matchMedia('(max-width: 780px)').matches) {
        elements.chatApp.classList.add('mobile-list-view');
    }
    await fetchUsers();
    connectSocket();
}

function saveSession(payload) {
    state.token = payload.token;
    state.user = payload.usuario;
    localStorage.setItem('chegouzap_token', state.token);
}

function logout(showMessage = true) {
    state.socket?.disconnect();
    state.socket = null;
    state.token = '';
    state.user = null;
    state.users = [];
    localStorage.removeItem('chegouzap_token');
    resetMessages();
    showAuth();
    if (showMessage) showToast('Você saiu da sua conta.');
}

function resetMessages() {
    elements.messages.querySelectorAll('.message').forEach((message) => message.remove());
    elements.welcomeCard.classList.remove('is-hidden');
    if (state.activeConversation.type === 'private') {
        elements.welcomeTitle.textContent = `Conversa com ${state.activeConversation.name}`;
        elements.welcomeText.textContent = 'Esta conversa é particular. Fotos, vídeos, documentos e mensagens ficam disponíveis por até 15 dias.';
    } else {
        elements.welcomeTitle.textContent = 'Bem-vindo à comunidade';
        elements.welcomeText.textContent = 'Converse com todos, envie mídias e compartilhe documentos com a comunidade.';
    }
}

function privateConversationId(userId) {
    return `private:${[state.user.id, userId].sort().join(':')}`;
}

function conversationPayload() {
    return {
        conversaId: state.activeConversation.id,
        destinatarioId: state.activeConversation.recipientId || '',
    };
}

function setActiveConversationHeader() {
    const conversation = state.activeConversation;
    elements.chatName.textContent = conversation.name;
    if (conversation.type === 'community') {
        elements.chatAvatar.classList.add('group-avatar');
        setAvatar(elements.chatAvatar, 'CZ');
    } else {
        elements.chatAvatar.classList.remove('group-avatar');
        setAvatar(elements.chatAvatar, conversation.name, conversation.user);
    }
    updatePresenceText();
}

function updatePresenceText() {
    if (state.activeConversation.type === 'community') {
        const count = state.onlineUserIds.size;
        elements.presenceText.textContent = count > 1 ? `${count} pessoas online` : 'comunidade';
    } else {
        elements.presenceText.textContent = state.onlineUserIds.has(state.activeConversation.recipientId)
            ? 'online'
            : 'offline';
    }
}

function openConversation(conversation) {
    state.activeConversation = conversation;
    document.querySelectorAll('.conversation').forEach((button) => {
        button.classList.toggle('active', button.dataset.conversationId === conversation.id);
    });
    const activeButton = document.querySelector(`[data-conversation-id="${CSS.escape(conversation.id)}"]`);
    activeButton?.querySelector('.unread-badge')?.classList.add('is-hidden');
    if (activeButton?.querySelector('.unread-badge')) activeButton.querySelector('.unread-badge').textContent = '0';
    elements.chatApp.classList.remove('mobile-list-view');
    setActiveConversationHeader();
    resetMessages();
    elements.chatSearch.classList.add('is-hidden');
    elements.messageSearchInput.value = '';
    if (state.socket?.connected) loadActiveConversation();
    setTimeout(() => elements.messageInput.focus(), 100);
}

function loadActiveConversation() {
    state.socket.emit('load conversation', conversationPayload(), (result) => {
        if (!result?.ok) showToast(result?.erro || 'Não foi possível abrir a conversa.', 'error');
    });
}

function buildDirectConversation(user) {
    const conversationId = privateConversationId(user.id);
    const button = document.createElement('button');
    button.className = 'conversation';
    button.type = 'button';
    button.dataset.conversationId = conversationId;
    button.dataset.conversationType = 'private';
    button.dataset.userId = user.id;
    button.dataset.searchable = `${user.nome} ${user.email}`.toLowerCase();

    const avatar = document.createElement('span');
    avatar.className = 'avatar direct-avatar';
    setAvatar(avatar, user.nome, user);

    const copy = document.createElement('span');
    copy.className = 'conversation-copy';
    const firstRow = document.createElement('span');
    firstRow.className = 'conversation-row';
    const name = document.createElement('strong');
    name.textContent = user.nome;
    const time = document.createElement('time');
    time.className = 'conversation-time';
    time.textContent = user.online ? 'online' : '';
    firstRow.append(name, time);

    const secondRow = document.createElement('span');
    secondRow.className = 'conversation-row';
    const preview = document.createElement('span');
    preview.className = 'conversation-preview';
    preview.textContent = user.email;
    const unread = document.createElement('span');
    unread.className = 'unread-badge is-hidden';
    unread.textContent = '0';
    secondRow.append(preview, unread);
    copy.append(firstRow, secondRow);
    button.append(avatar, copy);

    button.addEventListener('click', () => openConversation({
        id: conversationId,
        type: 'private',
        recipientId: user.id,
        name: user.nome,
        user,
    }));
    return button;
}

function renderUsers() {
    elements.directConversations.textContent = '';
    state.users.forEach((user) => elements.directConversations.appendChild(buildDirectConversation(user)));
    if (!state.users.length) {
        elements.conversationEmpty.textContent = 'Quando outra pessoa criar uma conta, ela aparecerá aqui.';
        elements.directConversations.appendChild(elements.conversationEmpty);
    }
    elements.directCount.textContent = String(state.users.length);
    elements.conversationCount.textContent = String(state.users.length + 1);
    document.querySelectorAll('.conversation').forEach((button) => {
        button.classList.toggle('active', button.dataset.conversationId === state.activeConversation.id);
    });
}

async function fetchUsers() {
    try {
        const payload = await api('/api/users');
        state.users = payload.usuarios || [];
        state.users.forEach((user) => {
            user.online = state.onlineUserIds.has(user.id) || user.online;
        });
        const activeUser = state.users.find((user) => user.id === state.activeConversation.recipientId);
        if (activeUser) {
            state.activeConversation.user = activeUser;
            state.activeConversation.name = activeUser.nome;
            setActiveConversationHeader();
        }
        renderUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

elements.authModeToggle.addEventListener('click', () => {
    state.mode = state.mode === 'login' ? 'register' : 'login';
    updateAuthMode();
});

elements.passwordToggle.addEventListener('click', () => {
    const showing = elements.passwordInput.type === 'text';
    elements.passwordInput.type = showing ? 'password' : 'text';
    elements.passwordToggle.textContent = showing ? 'Ver' : 'Ocultar';
    elements.passwordToggle.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
});

elements.authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    elements.authError.textContent = '';
    const endpoint = state.mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = {
        nome: elements.nameInput.value,
        email: elements.emailInput.value,
        senha: elements.passwordInput.value,
    };

    try {
        setLoading(elements.authSubmit, true, state.mode === 'register' ? 'Criando…' : 'Entrando…');
        saveSession(await api(endpoint, { method: 'POST', body: JSON.stringify(body) }));
        subscribeUserToPush();
        elements.authForm.reset();
        await showChat();
    } catch (error) {
        elements.authError.textContent = error.message;
    } finally {
        setLoading(elements.authSubmit, false);
    }
});

elements.logoutButton.addEventListener('click', () => logout());
elements.communityConversation.addEventListener('click', () => openConversation({
    id: COMMUNITY_ID,
    type: 'community',
    recipientId: '',
    name: 'Comunidade ChegouZap',
}));
elements.mobileBack.addEventListener('click', () => elements.chatApp.classList.add('mobile-list-view'));

function connectSocket() {
    state.socket?.disconnect();
    state.socket = io({ auth: { token: state.token } });

    state.socket.on('connect', () => {
        loadActiveConversation();
    });

    state.socket.on('connect_error', (error) => {
        elements.presenceText.textContent = 'sem conexão';
        if (/sessão|session|jwt|token/i.test(error.message)) logout(false);
        else showToast('Não foi possível conectar ao chat.', 'error');
    });

    state.socket.on('historico', (payload) => {
        const conversaId = Array.isArray(payload) ? COMMUNITY_ID : payload.conversaId;
        const history = Array.isArray(payload) ? payload : payload.mensagens;
        if (conversaId !== state.activeConversation.id) return;
        resetMessages();
        history.forEach(renderMessage);
        elements.welcomeCard.classList.toggle('is-hidden', history.length > 0);
        scrollToBottom();
    });

    state.socket.on('chat message', (message) => {
        updateConversationPreview(message);
        
        // --- AQUI ENTRA A NOTIFICAÇÃO ---
        showSystemNotification(message);

        if (message.conversaId !== state.activeConversation.id) {
            incrementUnread(message.conversaId);
            return;
        }
        if (!document.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`)) {
            renderMessage(message);
        }
        elements.welcomeCard.classList.add('is-hidden');
        scrollToBottom();
    });

    state.socket.on('message deleted', ({ messageId, conversaId, scope }) => {
        if (conversaId !== state.activeConversation.id) return;
        const message = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
        if (!message) return;
        if (scope === 'mim') {
            message.remove();
        } else {
            message.classList.add('deleted');
            message.querySelector('.message-content').innerHTML = '<p class="deleted-copy">⊘ Esta mensagem foi apagada</p>';
            message.querySelector('.message-menu-button')?.remove();
        }
    });

    state.socket.on('profile updated', (user) => {
        document.querySelectorAll(`[data-sender-id="${CSS.escape(user.id)}"] .message-avatar`).forEach((avatar) => {
            setAvatar(avatar, user.nome, user);
        });
        if (user.id === state.user.id) {
            state.user = user;
            setAvatar(elements.profileAvatar, user.nome, user);
        }
        fetchUsers();
    });

    state.socket.on('users changed', fetchUsers);

    state.socket.on('presence', ({ userIds = [] }) => {
        state.onlineUserIds = new Set(userIds);
        state.users.forEach((user) => {
            user.online = state.onlineUserIds.has(user.id);
        });
        renderUsers();
        updatePresenceText();
    });
}

function formatTime(value) {
    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function formatSize(bytes = 0) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function mediaErrorCard(message) {
    const error = document.createElement('div');
    error.className = 'media-error';
    error.textContent = message;
    return error;
}

function createAttachment(attachment) {
    if (!attachment) return null;
    const url = protectedFileUrl(attachment);
    if (!url) return mediaErrorCard('Arquivo indisponível');

    // --- PLAYER DE ÁUDIO ---
    if (attachment.categoria === 'audio' || attachment.tipo?.startsWith('audio/')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'audio-attachment';

        const playButton = document.createElement('button');
        playButton.className = 'audio-play-button';
        playButton.type = 'button';
        playButton.innerHTML = '▶'; // Ícone de Play

        const progressContainer = document.createElement('div');
        progressContainer.className = 'audio-progress-container';

        const progressBar = document.createElement('input');
        progressBar.type = 'range';
        progressBar.className = 'audio-progress';
        progressBar.value = 0;
        progressBar.min = 0;
        progressBar.max = 100;

        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'audio-time';
        timeDisplay.textContent = '0:00';

        const audio = document.createElement('audio');
        audio.src = url;
        audio.preload = 'metadata';
        audio.className = 'is-hidden';

        progressContainer.append(progressBar, timeDisplay);
        wrapper.append(playButton, progressContainer, audio);

        // Lógica de Play/Pause e controle de tempo
        let isPlaying = false;

        audio.addEventListener('loadedmetadata', () => {
            const mins = Math.floor(audio.duration / 60) || 0;
            const secs = Math.floor(audio.duration % 60).toString().padStart(2, '0') || '00';
            timeDisplay.textContent = `${mins}:${secs}`;
            progressBar.max = audio.duration;
        });

        audio.addEventListener('timeupdate', () => {
            progressBar.value = audio.currentTime;
            const mins = Math.floor(audio.currentTime / 60) || 0;
            const secs = Math.floor(audio.currentTime % 60).toString().padStart(2, '0') || '00';
            timeDisplay.textContent = `${mins}:${secs}`;
        });

        audio.addEventListener('ended', () => {
            isPlaying = false;
            playButton.innerHTML = '▶';
            progressBar.value = 0;
            const mins = Math.floor(audio.duration / 60) || 0;
            const secs = Math.floor(audio.duration % 60).toString().padStart(2, '0') || '00';
            timeDisplay.textContent = `${mins}:${secs}`;
        });

        playButton.addEventListener('click', () => {
            if (isPlaying) {
                audio.pause();
                playButton.innerHTML = '▶';
            } else {
                audio.play();
                playButton.innerHTML = '⏸'; // Ícone de Pause
            }
            isPlaying = !isPlaying;
        });

        progressBar.addEventListener('input', () => {
            audio.currentTime = progressBar.value;
        });

        return wrapper;
    }

    // --- IMAGEM ---
    if (attachment.categoria === 'imagem' || attachment.tipo?.startsWith('image/')) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'image-attachment';
        const image = document.createElement('img');
        image.src = url;
        image.alt = attachment.nome || 'Imagem enviada';
        image.loading = 'lazy';
        image.addEventListener('error', () => {
            link.replaceWith(mediaErrorCard('Não foi possível abrir esta imagem.'));
        }, { once: true });
        link.appendChild(image);
        return link;
    }

    // --- VÍDEO ---
    if (attachment.categoria === 'video' || attachment.tipo?.startsWith('video/')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrap';
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.className = 'video-attachment';
        video.addEventListener('error', () => {
            wrapper.replaceWith(mediaErrorCard('Não foi possível reproduzir este vídeo.'));
        }, { once: true });
        wrapper.appendChild(video);
        return wrapper;
    }

    // --- DOCUMENTOS GERAIS ---
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'document-attachment';
    link.innerHTML = `
        <span class="document-symbol" aria-hidden="true">▤</span>
        <span><strong></strong><small>${formatSize(attachment.tamanho)}</small></span>
        <span class="download-symbol" aria-hidden="true">↓</span>
    `;
    link.querySelector('strong').textContent = attachment.nome || 'Documento';
    return link;
}

function renderMessage(message) {
    const mine = message.remetente?.id === state.user?.id;
    const item = document.createElement('li');
    item.className = `message ${mine ? 'mine' : 'theirs'}${message.excluidaParaTodos ? ' deleted' : ''}`;
    item.dataset.messageId = message.id;
    item.dataset.senderId = message.remetente?.id || '';
    item.dataset.searchable = `${message.remetente?.nome || ''} ${message.texto || ''} ${message.anexo?.nome || ''}`.toLowerCase();

    const avatar = document.createElement('span');
    avatar.className = 'avatar message-avatar';
    setAvatar(avatar, message.remetente?.nome, message.remetente);

    const bubble = document.createElement('article');
    bubble.className = 'message-bubble';
    const heading = document.createElement('div');
    heading.className = 'message-heading';
    const sender = document.createElement('strong');
    sender.textContent = mine ? 'Você' : (message.remetente?.nome || 'Usuário');
    const menuButton = document.createElement('button');
    menuButton.className = 'message-menu-button';
    menuButton.type = 'button';
    menuButton.setAttribute('aria-label', 'Opções da mensagem');
    menuButton.textContent = '⌄';
    menuButton.addEventListener('click', () => openDeleteModal(message.id, mine));
    heading.append(sender, menuButton);

    const content = document.createElement('div');
    content.className = 'message-content';
    if (message.excluidaParaTodos) {
        content.innerHTML = '<p class="deleted-copy">⊘ Esta mensagem foi apagada</p>';
        menuButton.remove();
    } else {
        const attachment = createAttachment(message.anexo);
        if (attachment) content.appendChild(attachment);
        if (message.texto) {
            const paragraph = document.createElement('p');
            paragraph.textContent = message.texto;
            content.appendChild(paragraph);
        }
    }

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const time = document.createElement('time');
    time.dateTime = message.createdAt;
    time.textContent = formatTime(message.createdAt);
    meta.appendChild(time);
    if (mine && !message.excluidaParaTodos) {
        const checks = document.createElement('span');
        checks.className = 'checks';
        checks.textContent = '✓✓';
        checks.setAttribute('aria-label', 'Entregue');
        meta.appendChild(checks);
    }

    bubble.append(heading, content, meta);
    item.append(avatar, bubble);
    elements.messages.appendChild(item);
}

function conversationButton(conversationId) {
    return document.querySelector(`[data-conversation-id="${CSS.escape(conversationId)}"]`);
}

function updateConversationPreview(message) {
    const button = conversationButton(message.conversaId || COMMUNITY_ID);
    if (!button) return;
    const preview = button.querySelector('.conversation-preview');
    const time = button.querySelector('.conversation-time');
    preview.textContent = message.excluidaParaTodos
        ? 'Mensagem apagada'
        : message.texto || message.anexo?.nome || 'Novo arquivo';
    time.textContent = formatTime(message.createdAt);
}

function incrementUnread(conversationId) {
    const badge = conversationButton(conversationId)?.querySelector('.unread-badge');
    if (!badge) return;
    badge.textContent = String(Number(badge.textContent || 0) + 1);
    badge.classList.remove('is-hidden');
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        elements.messages.scrollTop = elements.messages.scrollHeight;
    });
}

elements.messageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const texto = elements.messageInput.value.trim();
    if (!texto || !state.socket?.connected) return;

    elements.messageInput.value = '';
    resizeComposer();
    state.socket.emit('chat message', { texto, ...conversationPayload() }, (result) => {
        if (!result?.ok) {
            elements.messageInput.value = texto;
            resizeComposer();
            showToast(result?.erro || 'Não foi possível enviar.', 'error');
        }
    });
});

function resizeComposer() {
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 120)}px`;
}

elements.messageInput.addEventListener('input', resizeComposer);
elements.messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        elements.messageForm.requestSubmit();
    }
});

function insertEmoji(emoji) {
    const start = elements.messageInput.selectionStart;
    const end = elements.messageInput.selectionEnd;
    const value = elements.messageInput.value;
    elements.messageInput.value = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    elements.messageInput.focus();
    elements.messageInput.selectionStart = elements.messageInput.selectionEnd = start + emoji.length;
    resizeComposer();
}

function renderEmojiPicker() {
    EMOJIS.forEach((emoji) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = emoji;
        button.setAttribute('aria-label', `Adicionar ${emoji}`);
        button.addEventListener('click', () => insertEmoji(emoji));
        elements.emojiGrid.appendChild(button);
    });
}

function toggleEmojiMenu(force) {
    const willOpen = typeof force === 'boolean'
        ? force
        : elements.emojiMenu.classList.contains('is-hidden');
    elements.emojiMenu.classList.toggle('is-hidden', !willOpen);
    elements.emojiButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) toggleAttachmentMenu(false);
}

elements.emojiButton.addEventListener('click', () => toggleEmojiMenu());

function toggleAttachmentMenu(force) {
    const willOpen = typeof force === 'boolean'
        ? force
        : elements.attachmentMenu.classList.contains('is-hidden');
    elements.attachmentMenu.classList.toggle('is-hidden', !willOpen);
    elements.attachmentButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) toggleEmojiMenu(false);
}

elements.attachmentButton.addEventListener('click', () => toggleAttachmentMenu());
elements.attachmentMenu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-attachment]');
    if (!button) return;
    toggleAttachmentMenu(false);
    (button.dataset.attachment === 'media' ? elements.mediaInput : elements.documentInput).click();
});

document.addEventListener('click', (event) => {
    if (!elements.attachmentMenu.contains(event.target) && !elements.attachmentButton.contains(event.target)) {
        toggleAttachmentMenu(false);
    }
    if (!elements.emojiMenu.contains(event.target) && !elements.emojiButton.contains(event.target)) {
        toggleEmojiMenu(false);
    }
});

function showUploadPreview(file) {
    if (state.uploadObjectUrl) URL.revokeObjectURL(state.uploadObjectUrl);
    state.uploadObjectUrl = URL.createObjectURL(file);
    elements.uploadPreview.textContent = '';

    if (file.type.startsWith('image/')) {
        const image = document.createElement('img');
        image.src = state.uploadObjectUrl;
        image.alt = `Prévia de ${file.name}`;
        elements.uploadPreview.appendChild(image);
    } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = state.uploadObjectUrl;
        video.controls = true;
        video.muted = true;
        video.playsInline = true;
        elements.uploadPreview.appendChild(video);
    } else {
        const documentPreview = document.createElement('div');
        documentPreview.className = 'upload-document-preview';
        documentPreview.innerHTML = '<span aria-hidden="true">▤</span><strong></strong>';
        documentPreview.querySelector('strong').textContent = file.name;
        elements.uploadPreview.appendChild(documentPreview);
    }
}

function clearUploadPreview() {
    if (state.uploadObjectUrl) URL.revokeObjectURL(state.uploadObjectUrl);
    state.uploadObjectUrl = '';
    elements.uploadPreview.textContent = '';
}

async function uploadFile(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('texto', elements.messageInput.value.trim());
    formData.append('conversaId', state.activeConversation.id);
    if (state.activeConversation.recipientId) {
        formData.append('destinatarioId', state.activeConversation.recipientId);
    }
    elements.uploadFileName.textContent = `${file.name} · ${formatSize(file.size)}`;
    showUploadPreview(file);
    elements.uploadProgress.classList.remove('is-hidden');
    elements.messageInput.value = '';
    resizeComposer();

    try {
        await api('/api/messages/upload', { method: 'POST', body: formData });
        showToast('Arquivo enviado com sucesso.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        elements.uploadProgress.classList.add('is-hidden');
        clearUploadPreview();
        elements.mediaInput.value = '';
        elements.documentInput.value = '';
    }
}

elements.mediaInput.addEventListener('change', () => uploadFile(elements.mediaInput.files[0]));
elements.documentInput.addEventListener('change', () => uploadFile(elements.documentInput.files[0]));

elements.profileAvatarButton.addEventListener('click', () => elements.profileAvatarInput.click());
elements.profileAvatarInput.addEventListener('change', async () => {
    const file = elements.profileAvatarInput.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('arquivo', file);
    elements.profileAvatarButton.classList.add('is-loading');
    try {
        const payload = await api('/api/profile/avatar', { method: 'POST', body: formData });
        state.user = payload.usuario;
        setAvatar(elements.profileAvatar, state.user.nome, state.user);
        showToast('Foto de perfil atualizada.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        elements.profileAvatarButton.classList.remove('is-loading');
        elements.profileAvatarInput.value = '';
    }
});

function openDeleteModal(messageId, mine) {
    state.selectedMessageId = messageId;
    state.selectedMessageIsMine = mine;
    elements.deleteForEveryoneButton.classList.toggle('is-hidden', !mine);
    elements.deleteModal.classList.remove('is-hidden');
    elements.deleteForMeButton.focus();
}

function closeDeleteModal() {
    elements.deleteModal.classList.add('is-hidden');
    state.selectedMessageId = null;
}

function deleteMessage(scope) {
    if (!state.selectedMessageId) return;
    const messageId = state.selectedMessageId;
    state.socket.emit('delete message', { messageId, scope }, (result) => {
        if (!result?.ok) showToast(result?.erro || 'Não foi possível excluir.', 'error');
        else showToast(scope === 'todos' ? 'Mensagem excluída para todos.' : 'Mensagem excluída para você.');
    });
    closeDeleteModal();
}

elements.deleteForMeButton.addEventListener('click', () => deleteMessage('mim'));
elements.deleteForEveryoneButton.addEventListener('click', () => deleteMessage('todos'));
elements.cancelDeleteButton.addEventListener('click', closeDeleteModal);
elements.deleteModal.addEventListener('click', (event) => {
    if (event.target === elements.deleteModal) closeDeleteModal();
});

elements.chatSearchButton.addEventListener('click', () => {
    elements.chatSearch.classList.remove('is-hidden');
    elements.messageSearchInput.focus();
});

elements.closeChatSearch.addEventListener('click', () => {
    elements.chatSearch.classList.add('is-hidden');
    elements.messageSearchInput.value = '';
    filterMessages('');
});

function filterMessages(term) {
    const normalized = term.trim().toLowerCase();
    elements.messages.querySelectorAll('.message').forEach((message) => {
        message.classList.toggle('is-hidden', normalized && !message.dataset.searchable.includes(normalized));
    });
}

elements.messageSearchInput.addEventListener('input', () => filterMessages(elements.messageSearchInput.value));
elements.searchInput.addEventListener('input', () => {
    const normalized = elements.searchInput.value.trim().toLowerCase();
    document.querySelectorAll('.conversation').forEach((conversation) => {
        const searchable = conversation.dataset.searchable
            || conversation.textContent.toLowerCase();
        conversation.classList.toggle('is-hidden', normalized && !searchable.includes(normalized));
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeDeleteModal();
        toggleAttachmentMenu(false);
        toggleEmojiMenu(false);
    }
});

async function initialize() {
    renderEmojiPicker();
    updateAuthMode();
    if (!state.token) return showAuth();
    try {
        const payload = await api('/api/auth/me');
        state.user = payload.usuario;
        subscribeUserToPush();
        await showChat();
    } catch (_error) {
        logout(false);
    }
}
// =======================================================
// --- SISTEMA DE ASSINATURA PARA PUSH NOTIFICATION ---
// =======================================================

// Converter a chave pública VAPID (do .env) de Base64 para UInt8Array (exigência do navegador)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Função principal que gera a assinatura e manda pro backend
async function subscribeUserToPush() {
    // 1. Verifica se o navegador suporta notificações e service worker
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications não são suportadas neste navegador.');
        return;
    }

    try {
        // 2. Aguarda o Service Worker estar pronto
        const registration = await navigator.serviceWorker.ready;

        // 3. Verifica se o usuário já está inscrito
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
            console.log('Usuário já está inscrito para Push.');
            return; // Já está inscrito, não faz nada
        }

        const VAPID_PUBLIC_KEY = 'BMFKvUpP3kWfPYcgCx7LT49VBjHQpMoHaQC-Tw8gBqZAlAZvotO1sEl6FJPepOudl3_42R1X8ZgGV0k9gfKBhr4';
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true, // Obrigatório: a notificação sempre mostrará algo pro usuário
            applicationServerKey: convertedVapidKey
        });

        console.log('Nova assinatura de Push gerada:', subscription);

        // 5. Envia a assinatura e o ID do usuário logado para o backend
        await api('/api/notifications/subscribe', {
            method: 'POST',
            body: JSON.stringify({
                subscription: subscription,
                userId: state.user.id // Pega o ID do usuário que acabou de logar
            })
        });

        console.log('Assinatura enviada para o backend com sucesso!');

    } catch (error) {
        console.error('Falha ao inscrever o usuário para Push Notifications:', error);
    }
}

initialize();

// --- SISTEMA DE GRAVAÇÃO DE ÁUDIO ---

let mediaRecorder;
let audioChunks = [];
let recordTimerInterval;
let recordStartTime;

const micButton = document.getElementById('micButton');
const recordingUI = document.getElementById('recordingUI');
const recordingTimer = document.getElementById('recordingTimer');
const cancelRecord = document.getElementById('cancelRecord');
const sendRecord = document.getElementById('sendRecord');
const messageInputWrap = document.getElementById('messageInputWrap');
const sendButton = document.getElementById('sendButton');

// Iniciar Gravação
micButton.addEventListener('click', async () => {
    try {
        // Pede permissão para usar o microfone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.addEventListener('dataavailable', event => {
            if (event.data.size > 0) audioChunks.push(event.data);
        });

        mediaRecorder.start();

        // Altera a interface: Esconde o texto e mostra a gravação
        micButton.classList.add('is-hidden');
        messageInputWrap.classList.add('is-hidden');
        sendButton.classList.add('is-hidden');
        recordingUI.classList.remove('is-hidden');

        // Inicia o cronômetro
        recordStartTime = Date.now();
        recordingTimer.textContent = '00:00';
        recordTimerInterval = setInterval(() => {
            const diff = Math.floor((Date.now() - recordStartTime) / 1000);
            const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
            const seconds = String(diff % 60).padStart(2, '0');
            recordingTimer.textContent = `${minutes}:${seconds}`;
        }, 1000);

    } catch (err) {
        showToast('Permissão de microfone negada ou indisponível.', 'error');
    }
});

// Função para resetar a interface e parar o microfone
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop()); // Desliga o led do mic
    }
    clearInterval(recordTimerInterval);
    recordingUI.classList.add('is-hidden');
    micButton.classList.remove('is-hidden');
    messageInputWrap.classList.remove('is-hidden');
    sendButton.classList.remove('is-hidden');
}

// Cancelar Gravação
cancelRecord.addEventListener('click', () => {
    stopRecording();
    audioChunks = []; // Descarta o áudio
});

// Enviar Gravação
sendRecord.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        // Quando a gravação parar totalmente, gera o arquivo e envia
        mediaRecorder.addEventListener('stop', () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // Transforma o Blob em um File simulando um anexo padrão do sistema
            const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { 
                type: 'audio/webm' 
            });
            
            // Usa a sua função de upload existente!
            uploadFile(audioFile);
        }, { once: true });
        
        stopRecording();
    }
});

// Registra o Service Worker para transformar em PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('Service Worker registrado com sucesso!', registration.scope);
            })
            .catch((error) => {
                console.error('Falha ao registrar o Service Worker:', error);
            });
    });
}

// ==========================================
// --- SISTEMA DE PWA (INSTALAÇÃO) ---
// ==========================================
let deferredPrompt;
const installPopup = document.getElementById('installPopup');
const installAppButton = document.getElementById('installAppButton');
const closeInstallPopupButton = document.getElementById('closeInstallPopupButton');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Impede que o aviso padrão do navegador apareça
    deferredPrompt = e; // Guarda o evento para usarmos no botão
    
    // Só mostra o popup se o usuário estiver logado e se o HTML do popup existir
    if (state.token && installPopup) {
        installPopup.classList.remove('is-hidden');
    }
});

if (installAppButton) {
    installAppButton.addEventListener('click', async () => {
        installPopup.classList.add('is-hidden');
        if (deferredPrompt) {
            deferredPrompt.prompt(); // Mostra a tela nativa de instalação do celular/PC
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('Aplicativo instalado com sucesso!');
            }
            deferredPrompt = null;
        }
    });
}

if (closeInstallPopupButton) {
    closeInstallPopupButton.addEventListener('click', () => {
        installPopup.classList.add('is-hidden');
    });
}


// ==========================================
// --- SISTEMA DE NOTIFICAÇÕES PUSH ---
// ==========================================
const notificationPopup = document.getElementById('notificationPopup');
const enableNotifButton = document.getElementById('enableNotifButton');
const closeNotifPopupButton = document.getElementById('closeNotifPopupButton');

function checkNotificationPermission() {
    if (!('Notification' in window)) return;
    
    // Se ainda não foi perguntado ('default') e o usuário está logado
    if (Notification.permission === 'default' && state.token && notificationPopup) {
        // Aguarda 3 segundos após o carregamento para não ser invasivo
        setTimeout(() => {
            notificationPopup.classList.remove('is-hidden');
        }, 3000);
    }
}

if (enableNotifButton) {
    enableNotifButton.addEventListener('click', () => {
        notificationPopup.classList.add('is-hidden');
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('Notificações ativadas!', 'success');
            }
        });
    });
}

if (closeNotifPopupButton) {
    closeNotifPopupButton.addEventListener('click', () => {
        notificationPopup.classList.add('is-hidden');
    });
}

// Executa a checagem sempre que a página carregar
window.addEventListener('load', checkNotificationPermission);

// Função que cria a notificação visual do sistema operacional
function showSystemNotification(message) {
    // Se não tem permissão ou o navegador não suporta, sai da função
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    // Não notifica se fui eu que mandei a mensagem
    if (message.remetente?.id === state.user?.id) return;
    
    // Só avisa se você estiver em outra aba do navegador, com a tela minimizada, 
    // ou se a mensagem chegou em uma conversa diferente da que está aberta.
    const isDifferentChat = message.conversaId !== state.activeConversation.id;
    const isPageHidden = document.hidden;

    if (isPageHidden || isDifferentChat) {
        const title = message.tipoConversa === 'community' 
            ? `Comunidade: ${message.remetente?.nome || 'Novo usuário'}` 
            : message.remetente?.nome;
        
        let bodyText = message.texto;
        if (!bodyText && message.anexo) bodyText = '📎 Arquivo de mídia';
        
        new Notification(title, {
            body: bodyText,
            icon: 'icon-192.svg' // Usa o ícone do projeto
        });
    }
}