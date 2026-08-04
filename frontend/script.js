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
    conversations: [],
    searchResults: [],
    groupSelectedUsers: new Map(),
    groupMode: 'create',
    searchTimer: null,
    groupSearchTimer: null,
    conversationFilter: 'all',
    selectedMessage: null,
    replyingTo: null,
    editingMessage: null,
    typingTimer: null,
    typingStopTimer: null,
    deepLinkConversationId: new URLSearchParams(window.location.search).get('conversation') || '',
    messages: new Map(),
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
    profileAvatar: document.getElementById('profileAvatar'),
    profileAvatarButton: document.getElementById('profileAvatarButton'),
    profileAvatarInput: document.getElementById('profileAvatarInput'),
    logoutButton: document.getElementById('logoutButton'),
    settingsButton: document.getElementById('settingsButton'),
    chatFilters: document.getElementById('chatFilters'),
    communityConversation: document.getElementById('communityConversation'),
    directConversations: document.getElementById('directConversations'),
    groupConversations: document.getElementById('groupConversations'),
    conversationEmpty: document.getElementById('conversationEmpty'),
    groupEmpty: document.getElementById('groupEmpty'),
    conversationCount: document.getElementById('conversationCount'),
    directCount: document.getElementById('directCount'),
    groupCount: document.getElementById('groupCount'),
    newGroupButton: document.getElementById('newGroupButton'),
    userSearchResults: document.getElementById('userSearchResults'),
    chatAvatar: document.getElementById('chatAvatar'),
    chatName: document.getElementById('chatName'),
    mobileBack: document.getElementById('mobileBack'),
    messages: document.getElementById('messages'),
    welcomeCard: document.getElementById('welcomeCard'),
    welcomeTitle: document.getElementById('welcomeTitle'),
    welcomeText: document.getElementById('welcomeText'),
    messageForm: document.getElementById('messageForm'),
    messageInput: document.getElementById('messageInput'),
    sendButton: document.getElementById('sendButton'),
    micButton: document.getElementById('micButton'),
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
    groupModal: document.getElementById('groupModal'),
    groupModalTitle: document.getElementById('groupModalTitle'),
    groupModalDescription: document.getElementById('groupModalDescription'),
    groupNameField: document.getElementById('groupNameField'),
    groupNameInput: document.getElementById('groupNameInput'),
    groupUserSearch: document.getElementById('groupUserSearch'),
    groupSearchResults: document.getElementById('groupSearchResults'),
    selectedMembers: document.getElementById('selectedMembers'),
    groupError: document.getElementById('groupError'),
    saveGroupButton: document.getElementById('saveGroupButton'),
    cancelGroupButton: document.getElementById('cancelGroupButton'),
    presenceText: document.getElementById('presenceText'),
    conversationPreview: document.getElementById('conversationPreview'),
    conversationTime: document.getElementById('conversationTime'),
    searchInput: document.getElementById('searchInput'),
    chatSearchButton: document.getElementById('chatSearchButton'),
    chatMenuButton: document.getElementById('chatMenuButton'),
    chatSearch: document.getElementById('chatSearch'),
    messageSearchInput: document.getElementById('messageSearchInput'),
    closeChatSearch: document.getElementById('closeChatSearch'),
    emojiButton: document.getElementById('emojiButton'),
    emojiMenu: document.getElementById('emojiMenu'),
    emojiGrid: document.getElementById('emojiGrid'),
    toast: document.getElementById('toast'),
    pinnedMessageBanner: document.getElementById('pinnedMessageBanner'),
    pinnedMessageText: document.getElementById('pinnedMessageText'),
    requestBanner: document.getElementById('requestBanner'),
    acceptRequestButton: document.getElementById('acceptRequestButton'),
    blockRequestButton: document.getElementById('blockRequestButton'),
    replyComposerBar: document.getElementById('replyComposerBar'),
    replyComposerTitle: document.getElementById('replyComposerTitle'),
    replyComposerText: document.getElementById('replyComposerText'),
    cancelReplyButton: document.getElementById('cancelReplyButton'),
    messageActionsModal: document.getElementById('messageActionsModal'),
    quickReactions: document.getElementById('quickReactions'),
    replyMessageButton: document.getElementById('replyMessageButton'),
    editMessageButton: document.getElementById('editMessageButton'),
    pinMessageButton: document.getElementById('pinMessageButton'),
    openDeleteButton: document.getElementById('openDeleteButton'),
    cancelMessageActionsButton: document.getElementById('cancelMessageActionsButton'),
    chatInfoModal: document.getElementById('chatInfoModal'),
    infoAvatar: document.getElementById('infoAvatar'),
    chatInfoTitle: document.getElementById('chatInfoTitle'),
    chatInfoSubtitle: document.getElementById('chatInfoSubtitle'),
    togglePinConversationButton: document.getElementById('togglePinConversationButton'),
    toggleMuteButton: document.getElementById('toggleMuteButton'),
    toggleArchiveButton: document.getElementById('toggleArchiveButton'),
    openMediaButton: document.getElementById('openMediaButton'),
    groupAdminPanel: document.getElementById('groupAdminPanel'),
    editGroupNameInput: document.getElementById('editGroupNameInput'),
    saveGroupNameButton: document.getElementById('saveGroupNameButton'),
    groupAvatarInput: document.getElementById('groupAvatarInput'),
    inviteLinkButton: document.getElementById('inviteLinkButton'),
    memberManagement: document.getElementById('memberManagement'),
    leaveGroupButton: document.getElementById('leaveGroupButton'),
    privateSafetyPanel: document.getElementById('privateSafetyPanel'),
    blockUserButton: document.getElementById('blockUserButton'),
    reportUserButton: document.getElementById('reportUserButton'),
    closeChatInfoButton: document.getElementById('closeChatInfoButton'),
    privacyModal: document.getElementById('privacyModal'),
    allowEmailSearchToggle: document.getElementById('allowEmailSearchToggle'),
    showOnlineToggle: document.getElementById('showOnlineToggle'),
    readReceiptsToggle: document.getElementById('readReceiptsToggle'),
    savePrivacyButton: document.getElementById('savePrivacyButton'),
    closePrivacyButton: document.getElementById('closePrivacyButton'),
    mediaModal: document.getElementById('mediaModal'),
    mediaGallery: document.getElementById('mediaGallery'),
    closeMediaButton: document.getElementById('closeMediaButton'),
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
    setAvatar(elements.profileAvatar, state.user.nome, state.user);
    setActiveConversationHeader();
    if (window.matchMedia('(max-width: 780px)').matches) {
        elements.chatApp.classList.add('mobile-list-view');
    }
    await joinInviteFromUrl();
    await fetchConversations();
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
    state.conversations = [];
    state.searchResults = [];
    localStorage.removeItem('chegouzap_token');
    resetMessages();
    showAuth();
    if (showMessage) showToast('Você saiu da sua conta.');
}

function resetMessages() {
    elements.messages.querySelectorAll('.message').forEach((message) => message.remove());
    state.messages.clear();
    elements.welcomeCard.classList.remove('is-hidden');
    if (state.activeConversation.type === 'private') {
        elements.welcomeTitle.textContent = `Conversa com ${state.activeConversation.name}`;
        elements.welcomeText.textContent = 'Esta conversa é particular. Fotos, vídeos, documentos e mensagens ficam disponíveis por até 15 dias.';
    } else if (state.activeConversation.type === 'group') {
        elements.welcomeTitle.textContent = state.activeConversation.name;
        elements.welcomeText.textContent = 'Grupo fechado: somente os participantes adicionados podem ver e enviar mensagens.';
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
    if (conversation.type === 'community' || conversation.type === 'group') {
        elements.chatAvatar.classList.add('group-avatar');
        setAvatar(elements.chatAvatar, conversation.type === 'community' ? 'CZ' : conversation.name, conversation);
    } else {
        elements.chatAvatar.classList.remove('group-avatar');
        setAvatar(elements.chatAvatar, conversation.name, conversation.user);
    }
    updatePresenceText();
    updateConversationChrome();
}

function updateConversationChrome() {
    const conversation = state.activeConversation;
    const composerDisabled = Boolean(conversation.request);
    elements.requestBanner.classList.toggle('is-hidden', !conversation.request);
    elements.messageForm.classList.toggle('composer-disabled', composerDisabled);
    elements.messageInput.disabled = composerDisabled;
    elements.sendButton.disabled = composerDisabled;
    elements.micButton.disabled = composerDisabled;
    elements.attachmentButton.disabled = composerDisabled;
    elements.emojiButton.disabled = composerDisabled;
    elements.messageInput.placeholder = conversation.request ? 'Aceite a solicitação para responder' : 'Digite uma mensagem';
    elements.pinnedMessageBanner.classList.toggle('is-hidden', !conversation.pinnedMessageId);
    elements.pinnedMessageText.textContent = conversation.pinnedMessageId ? 'Toque para localizar na conversa' : '';
}

function draftKey(conversationId) {
    return `chegouzap_draft_${state.user?.id || 'guest'}_${conversationId}`;
}

function saveCurrentDraft() {
    if (!state.activeConversation?.id) return;
    const text = elements.messageInput.value;
    if (text) localStorage.setItem(draftKey(state.activeConversation.id), text);
    else localStorage.removeItem(draftKey(state.activeConversation.id));
}

function updatePresenceText() {
    if (state.activeConversation.type === 'community') {
        const count = state.onlineUserIds.size;
        elements.presenceText.textContent = count > 1 ? `${count} pessoas online` : 'comunidade';
    } else if (state.activeConversation.type === 'group') {
        const count = state.activeConversation.memberCount || state.activeConversation.members?.length || 0;
        elements.presenceText.textContent = `${count} ${count === 1 ? 'participante' : 'participantes'}`;
    } else {
        elements.presenceText.textContent = state.onlineUserIds.has(state.activeConversation.recipientId)
            ? 'online'
            : 'offline';
    }
}

function openConversation(conversation) {
    saveCurrentDraft();
    state.activeConversation = conversation;
    document.querySelectorAll('.conversation').forEach((button) => {
        button.classList.toggle('active', button.dataset.conversationId === conversation.id);
    });
    const activeButton = document.querySelector(`[data-conversation-id="${CSS.escape(conversation.id)}"]`);
    activeButton?.querySelector('.unread-badge')?.classList.add('is-hidden');
    if (activeButton?.querySelector('.unread-badge')) activeButton.querySelector('.unread-badge').textContent = '0';
    if (conversation.type === 'community' && state.user) state.user.communityUnread = 0;
    elements.chatApp.classList.remove('mobile-list-view');
    setActiveConversationHeader();
    resetMessages();
    elements.chatSearch.classList.add('is-hidden');
    elements.messageSearchInput.value = '';
    elements.messageInput.value = localStorage.getItem(draftKey(conversation.id)) || '';
    resizeComposer();
    if (state.socket?.connected) loadActiveConversation();
    setTimeout(() => elements.messageInput.focus(), 100);
}

function loadActiveConversation() {
    state.socket.emit('load conversation', conversationPayload(), (result) => {
        if (!result?.ok) showToast(result?.erro || 'Não foi possível abrir a conversa.', 'error');
    });
}

function formatConversationTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return formatTime(date);
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}

function buildConversationButton(conversation) {
    const user = conversation.user;
    const button = document.createElement('button');
    button.className = 'conversation';
    button.type = 'button';
    button.dataset.conversationId = conversation.id;
    button.dataset.conversationType = conversation.type;
    button.dataset.userId = conversation.recipientId || '';
    button.dataset.searchable = conversation.name.toLowerCase();

    const avatar = document.createElement('span');
    avatar.className = 'avatar direct-avatar';
    if (conversation.type === 'group') avatar.classList.add('group-avatar');
    setAvatar(avatar, conversation.name, user || conversation);

    const copy = document.createElement('span');
    copy.className = 'conversation-copy';
    const firstRow = document.createElement('span');
    firstRow.className = 'conversation-row';
    const name = document.createElement('strong');
    name.textContent = `${conversation.pinned ? '📌 ' : ''}${conversation.name}`;
    const time = document.createElement('time');
    time.className = 'conversation-time';
    time.textContent = formatConversationTime(conversation.lastMessageAt);
    firstRow.append(name, time);

    const secondRow = document.createElement('span');
    secondRow.className = 'conversation-row';
    const preview = document.createElement('span');
    preview.className = 'conversation-preview';
    preview.textContent = `${conversation.muted ? '🔕 ' : ''}${conversation.request ? 'Solicitação de mensagem' : (conversation.lastMessage || (conversation.type === 'group' ? 'Grupo fechado' : 'Conversa particular'))}`;
    const unread = document.createElement('span');
    unread.className = `unread-badge${conversation.unreadCount ? '' : ' is-hidden'}`;
    unread.textContent = String(conversation.unreadCount || 0);
    secondRow.append(preview, unread);
    copy.append(firstRow, secondRow);
    button.append(avatar, copy);

    button.addEventListener('click', () => openConversation(conversation));
    return button;
}

function renderConversations() {
    const filter = state.conversationFilter;
    const matches = (conversation) => {
        if (filter === 'archived') return conversation.archived;
        if (conversation.archived) return false;
        if (filter === 'unread') return conversation.unreadCount > 0;
        if (filter === 'direct') return conversation.type === 'private' && !conversation.request;
        if (filter === 'groups') return conversation.type === 'group';
        if (filter === 'requests') return conversation.request;
        return !conversation.request;
    };
    const visible = state.conversations.filter(matches);
    const direct = visible.filter((conversation) => conversation.type === 'private');
    const groups = visible.filter((conversation) => conversation.type === 'group');
    const showDirectSection = !['groups'].includes(filter);
    const showGroupSection = !['direct', 'requests'].includes(filter);
    elements.directConversations.classList.toggle('is-hidden', !showDirectSection);
    elements.directConversations.previousElementSibling?.classList.toggle('is-hidden', !showDirectSection);
    elements.groupConversations.classList.toggle('is-hidden', !showGroupSection);
    elements.groupConversations.previousElementSibling?.classList.toggle('is-hidden', !showGroupSection);
    elements.directConversations.textContent = '';
    direct.forEach((conversation) => elements.directConversations.appendChild(buildConversationButton(conversation)));
    if (!direct.length) {
        elements.conversationEmpty.textContent = 'Pesquise uma pessoa para iniciar uma conversa.';
        elements.directConversations.appendChild(elements.conversationEmpty);
    }

    elements.groupConversations.textContent = '';
    groups.forEach((conversation) => elements.groupConversations.appendChild(buildConversationButton(conversation)));
    if (!groups.length) elements.groupConversations.appendChild(elements.groupEmpty);

    elements.directCount.textContent = String(direct.length);
    elements.groupCount.textContent = String(groups.length);
    elements.conversationCount.textContent = String(state.conversations.length + 1);
    const showCommunity = ['all', 'unread'].includes(filter)
        && (filter !== 'unread' || Number(state.user?.communityUnread || 0) > 0);
    elements.communityConversation.classList.toggle('is-hidden', !showCommunity);
    const communityBadge = elements.communityConversation.querySelector('.unread-badge');
    if (communityBadge) {
        communityBadge.textContent = String(state.user?.communityUnread || 0);
        communityBadge.classList.toggle('is-hidden', !state.user?.communityUnread);
    }
    document.querySelectorAll('.conversation').forEach((button) => {
        button.classList.toggle('active', button.dataset.conversationId === state.activeConversation.id);
    });
}

async function fetchConversations() {
    try {
        const payload = await api('/api/conversations');
        state.conversations = (payload.conversas || []).sort((a, b) => (
            Number(b.pinned) - Number(a.pinned)
            || new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
        ));
        const activeConversation = state.conversations.find((conversation) => conversation.id === state.activeConversation.id);
        if (activeConversation) {
            state.activeConversation = activeConversation;
            setActiveConversationHeader();
        }
        renderConversations();
        if (state.deepLinkConversationId) {
            const linked = state.conversations.find((conversation) => conversation.id === state.deepLinkConversationId);
            if (linked) openConversation(linked);
            state.deepLinkConversationId = '';
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function searchUsers(query) {
    const normalized = query.trim();
    if (normalized.length < 2) return [];
    const payload = await api(`/api/users/search?q=${encodeURIComponent(normalized)}`);
    return payload.usuarios || [];
}

function searchResultRow(user, actionLabel, onSelect) {
    const row = document.createElement('button');
    row.className = 'user-search-result';
    row.type = 'button';

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    setAvatar(avatar, user.nome, user);
    const copy = document.createElement('span');
    copy.className = 'user-search-copy';
    const name = document.createElement('strong');
    name.textContent = user.nome;
    const hint = document.createElement('small');
    hint.textContent = actionLabel;
    copy.append(name, hint);
    row.append(avatar, copy);
    row.addEventListener('click', () => onSelect(user));
    return row;
}

function openUserConversation(user) {
    const conversationId = privateConversationId(user.id);
    let conversation = state.conversations.find((item) => item.id === conversationId);
    if (!conversation) {
        conversation = {
            id: conversationId,
            type: 'private',
            recipientId: user.id,
            name: user.nome,
            user,
            lastMessage: 'Nova conversa',
            lastMessageAt: null,
            memberCount: 2,
            canManage: false,
        };
        state.conversations.unshift(conversation);
        renderConversations();
    }
    elements.searchInput.value = '';
    elements.userSearchResults.classList.add('is-hidden');
    elements.userSearchResults.textContent = '';
    openConversation(conversation);
}

function renderUserSearchResults(users, query) {
    elements.userSearchResults.textContent = '';
    if (!query || query.length < 2) {
        elements.userSearchResults.classList.add('is-hidden');
        return;
    }
    if (!users.length) {
        const empty = document.createElement('p');
        empty.className = 'search-result-empty';
        empty.textContent = 'Nenhuma pessoa encontrada.';
        elements.userSearchResults.appendChild(empty);
    } else {
        users.forEach((user) => {
            elements.userSearchResults.appendChild(searchResultRow(user, 'Iniciar conversa', openUserConversation));
        });
    }
    elements.userSearchResults.classList.remove('is-hidden');
}

function renderSelectedMembers() {
    elements.selectedMembers.textContent = '';
    state.groupSelectedUsers.forEach((user) => {
        const chip = document.createElement('span');
        chip.className = 'member-chip';
        chip.textContent = user.nome;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Remover ${user.nome}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
            state.groupSelectedUsers.delete(user.id);
            renderSelectedMembers();
        });
        chip.appendChild(remove);
        elements.selectedMembers.appendChild(chip);
    });
}

function closeGroupModal() {
    elements.groupModal.classList.add('is-hidden');
    elements.groupError.textContent = '';
    elements.groupUserSearch.value = '';
    elements.groupSearchResults.textContent = '';
    state.groupSelectedUsers.clear();
}

function openGroupModal(mode = 'create') {
    const conversation = state.activeConversation;
    state.groupMode = mode;
    state.groupSelectedUsers.clear();
    elements.groupError.textContent = '';
    elements.groupUserSearch.value = '';
    elements.groupSearchResults.textContent = '';
    elements.groupNameField.classList.toggle('is-hidden', mode === 'manage');
    elements.groupNameInput.value = '';
    elements.groupModalTitle.textContent = mode === 'create' ? 'Novo grupo fechado' : `Adicionar ao grupo ${conversation.name}`;
    elements.groupModalDescription.textContent = mode === 'create'
        ? 'Somente as pessoas adicionadas poderão ver e enviar mensagens.'
        : `Participantes atuais: ${(conversation.members || []).map((member) => member.nome).join(', ')}.`;
    elements.saveGroupButton.textContent = mode === 'create' ? 'Criar grupo' : 'Adicionar pessoas';
    renderSelectedMembers();
    elements.groupModal.classList.remove('is-hidden');
    (mode === 'create' ? elements.groupNameInput : elements.groupUserSearch).focus();
}

function renderGroupSearchResults(users, query) {
    elements.groupSearchResults.textContent = '';
    if (query.trim().length < 2) return;
    const currentMemberIds = new Set((state.activeConversation.members || []).map((member) => member.id));
    const available = users.filter((user) => (
        !state.groupSelectedUsers.has(user.id)
        && (state.groupMode !== 'manage' || !currentMemberIds.has(user.id))
    ));
    if (!available.length) {
        const empty = document.createElement('p');
        empty.className = 'search-result-empty';
        empty.textContent = 'Nenhuma pessoa nova encontrada.';
        elements.groupSearchResults.appendChild(empty);
        return;
    }
    available.forEach((user) => {
        elements.groupSearchResults.appendChild(searchResultRow(user, 'Adicionar', (selected) => {
            state.groupSelectedUsers.set(selected.id, selected);
            renderSelectedMembers();
            elements.groupUserSearch.value = '';
            elements.groupSearchResults.textContent = '';
            elements.groupUserSearch.focus();
        }));
    });
}

async function saveGroup() {
    elements.groupError.textContent = '';
    const memberIds = [...state.groupSelectedUsers.keys()];
    if (!memberIds.length) {
        elements.groupError.textContent = 'Selecione pelo menos uma pessoa.';
        return;
    }
    const creating = state.groupMode === 'create';
    const nome = elements.groupNameInput.value.trim();
    if (creating && nome.length < 3) {
        elements.groupError.textContent = 'Digite um nome com pelo menos 3 caracteres.';
        return;
    }

    try {
        setLoading(elements.saveGroupButton, true, creating ? 'Criando…' : 'Adicionando…');
        const path = creating
            ? '/api/groups'
            : `/api/groups/${encodeURIComponent(state.activeConversation.id)}/members`;
        const payload = await api(path, {
            method: creating ? 'POST' : 'PATCH',
            body: JSON.stringify({ nome, membroIds: memberIds }),
        });
        closeGroupModal();
        await fetchConversations();
        if (payload.conversa) openConversation(payload.conversa);
        showToast(creating ? 'Grupo criado com sucesso.' : 'Pessoas adicionadas ao grupo.', 'success');
    } catch (error) {
        elements.groupError.textContent = error.message;
    } finally {
        setLoading(elements.saveGroupButton, false);
    }
}

async function updateConversationPreference(field, value) {
    if (state.activeConversation.type === 'community') return false;
    try {
        await api(`/api/conversations/${encodeURIComponent(state.activeConversation.id)}/preferences`, {
            method: 'PATCH',
            body: JSON.stringify({ [field]: value }),
        });
        state.activeConversation[field] = value;
        await fetchConversations();
        return true;
    } catch (error) {
        showToast(error.message, 'error');
        return false;
    }
}

function closeChatInfo() {
    elements.chatInfoModal.classList.add('is-hidden');
}

function renderMemberManagement(conversation) {
    elements.memberManagement.textContent = '';
    if (conversation.canManage) {
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'add-member-action';
        add.textContent = '＋ Adicionar pessoas';
        add.addEventListener('click', () => {
            closeChatInfo();
            openGroupModal('manage');
        });
        elements.memberManagement.appendChild(add);
    }
    (conversation.members || []).forEach((member) => {
        const row = document.createElement('div');
        row.className = 'member-manage-row';
        const avatar = document.createElement('span');
        avatar.className = 'avatar';
        setAvatar(avatar, member.nome, member);
        const name = document.createElement('span');
        name.className = 'member-manage-name';
        name.innerHTML = '<strong></strong><small></small>';
        name.querySelector('strong').textContent = member.id === state.user.id ? `${member.nome} (você)` : member.nome;
        const isCreator = member.id === conversation.creatorId;
        const isAdmin = isCreator || conversation.adminIds?.includes(member.id);
        name.querySelector('small').textContent = isCreator ? 'Criador' : (isAdmin ? 'Administrador' : 'Participante');
        row.append(avatar, name);

        if (conversation.creatorId === state.user.id && member.id !== state.user.id) {
            const admin = document.createElement('button');
            admin.type = 'button';
            admin.textContent = isAdmin ? 'Remover admin' : 'Tornar admin';
            admin.addEventListener('click', async () => {
                await api(`/api/groups/${encodeURIComponent(conversation.id)}/admins`, {
                    method: 'PATCH', body: JSON.stringify({ userId: member.id, isAdmin: !isAdmin }),
                });
                await fetchConversations();
                openChatInfo();
            });
            const transfer = document.createElement('button');
            transfer.type = 'button';
            transfer.textContent = 'Transferir';
            transfer.addEventListener('click', async () => {
                await api(`/api/groups/${encodeURIComponent(conversation.id)}/transfer`, {
                    method: 'POST', body: JSON.stringify({ userId: member.id }),
                });
                await fetchConversations();
                openChatInfo();
            });
            row.append(admin, transfer);
        }
        if (conversation.canManage && !isCreator && member.id !== state.user.id) {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'danger-link';
            remove.textContent = 'Remover';
            remove.addEventListener('click', async () => {
                await api(`/api/groups/${encodeURIComponent(conversation.id)}/members/${encodeURIComponent(member.id)}`, { method: 'DELETE' });
                await fetchConversations();
                openChatInfo();
            });
            row.appendChild(remove);
        }
        elements.memberManagement.appendChild(row);
    });
}

function openChatInfo() {
    const conversation = state.activeConversation;
    elements.chatInfoTitle.textContent = conversation.name;
    elements.chatInfoSubtitle.textContent = conversation.type === 'community'
        ? 'Comunidade pública do ChegouZap'
        : conversation.type === 'group'
            ? `${conversation.memberCount || 0} participantes`
            : 'Conversa particular';
    setAvatar(elements.infoAvatar, conversation.name, conversation.user || conversation);
    const configurable = conversation.type !== 'community';
    [elements.togglePinConversationButton, elements.toggleMuteButton, elements.toggleArchiveButton]
        .forEach((button) => button.classList.toggle('is-hidden', !configurable));
    elements.togglePinConversationButton.textContent = conversation.pinned ? '📌 Desafixar conversa' : '📌 Fixar conversa';
    elements.toggleMuteButton.textContent = conversation.muted ? '🔔 Ativar notificações' : '🔕 Silenciar';
    elements.toggleArchiveButton.textContent = conversation.archived ? '📥 Desarquivar' : '🗄 Arquivar';
    elements.groupAdminPanel.classList.toggle('is-hidden', conversation.type !== 'group');
    elements.privateSafetyPanel.classList.toggle('is-hidden', conversation.type !== 'private');
    if (conversation.type === 'group') {
        elements.editGroupNameInput.value = conversation.name;
        elements.editGroupNameInput.disabled = !conversation.canManage;
        elements.saveGroupNameButton.classList.toggle('is-hidden', !conversation.canManage);
        elements.groupAvatarInput.previousElementSibling?.classList.toggle('is-hidden', !conversation.canManage);
        elements.inviteLinkButton.classList.toggle('is-hidden', !conversation.canManage);
        renderMemberManagement(conversation);
    }
    elements.chatInfoModal.classList.remove('is-hidden');
}

async function openMediaGallery() {
    elements.mediaGallery.innerHTML = '<p class="search-result-empty">Carregando arquivos…</p>';
    elements.mediaModal.classList.remove('is-hidden');
    try {
        const payload = await api(`/api/conversations/${encodeURIComponent(state.activeConversation.id)}/media`);
        elements.mediaGallery.textContent = '';
        if (!payload.items?.length) {
            elements.mediaGallery.innerHTML = '<p class="search-result-empty">Nenhuma mídia disponível.</p>';
            return;
        }
        payload.items.forEach((message) => {
            const card = document.createElement('article');
            card.className = 'media-gallery-card';
            const attachment = createAttachment(message.anexo);
            if (attachment) card.appendChild(attachment);
            const caption = document.createElement('small');
            caption.textContent = `${message.remetente?.nome || ''} · ${formatConversationTime(message.createdAt)}`;
            card.appendChild(caption);
            elements.mediaGallery.appendChild(card);
        });
    } catch (error) {
        elements.mediaGallery.innerHTML = '<p class="search-result-empty"></p>';
        elements.mediaGallery.querySelector('p').textContent = error.message;
    }
}

async function joinInviteFromUrl() {
    const token = new URLSearchParams(window.location.search).get('invite');
    if (!token) return;
    try {
        const payload = await api(`/api/groups/join/${encodeURIComponent(token)}`, { method: 'POST' });
        state.deepLinkConversationId = payload.conversa?.id || '';
        window.history.replaceState({}, '', '/');
        showToast('Você entrou no grupo.', 'success');
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
        state.socket.emit('mark read', conversationPayload());
    });

    state.socket.on('message edited', (message) => {
        state.messages.set(message.id, message);
        const item = document.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`);
        if (!item) return;
        const content = item.querySelector('.message-content');
        const paragraph = content?.querySelector('p:not(.deleted-copy)');
        if (paragraph) paragraph.textContent = message.texto;
        else if (message.texto && content) {
            const created = document.createElement('p');
            created.textContent = message.texto;
            content.appendChild(created);
        }
        if (!item.querySelector('.edited-label')) {
            const edited = document.createElement('span');
            edited.className = 'edited-label';
            edited.textContent = 'editada';
            item.querySelector('.message-meta time')?.after(edited);
        }
    });

    state.socket.on('message reacted', ({ messageId, reactions }) => {
        const message = state.messages.get(messageId);
        const bubble = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"] .message-bubble`);
        if (!message || !bubble) return;
        message.reactions = reactions;
        renderReactionBar(bubble, message);
    });

    state.socket.on('messages read', ({ conversaId, userId: readerId }) => {
        if (conversaId !== state.activeConversation.id || readerId === state.user.id) return;
        state.messages.forEach((message) => {
            if (message.remetente?.id !== state.user.id) return;
            if (!message.readBy?.includes(readerId)) message.readBy = [...(message.readBy || []), readerId];
            const checks = document.querySelector(`[data-message-id="${CSS.escape(message.id)}"] .checks`);
            if (checks) {
                checks.textContent = '✓✓';
                checks.classList.add('read');
                checks.setAttribute('aria-label', 'Lida');
            }
        });
    });

    state.socket.on('message pinned', ({ conversaId, messageId }) => {
        const conversation = state.conversations.find((item) => item.id === conversaId);
        if (conversation) conversation.pinnedMessageId = messageId;
        if (state.activeConversation.id === conversaId) {
            state.activeConversation.pinnedMessageId = messageId;
            updateConversationChrome();
            document.querySelectorAll('.message').forEach((item) => {
                item.classList.toggle('pinned', item.dataset.messageId === messageId);
            });
        }
    });

    state.socket.on('typing', ({ conversaId, userId: typingUserId, name, typing }) => {
        if (conversaId !== state.activeConversation.id || typingUserId === state.user.id) return;
        clearTimeout(state.typingStopTimer);
        if (typing) {
            elements.presenceText.textContent = `${name} está digitando…`;
            state.typingStopTimer = setTimeout(updatePresenceText, 1600);
        } else {
            updatePresenceText();
        }
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
            state.user = { ...state.user, ...user };
            setAvatar(elements.profileAvatar, user.nome, user);
        }
        fetchConversations();
    });

    state.socket.on('conversations changed', fetchConversations);

    state.socket.on('presence', ({ userIds = [] }) => {
        state.onlineUserIds = new Set(userIds);
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

function renderReactionBar(bubble, message) {
    bubble.querySelector('.message-reactions')?.remove();
    if (!message.reactions?.length) return;
    const reactions = document.createElement('div');
    reactions.className = 'message-reactions';
    message.reactions.forEach((reaction) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = reaction.userIds?.includes(state.user.id) ? 'mine' : '';
        button.textContent = `${reaction.emoji} ${reaction.userIds?.length || 0}`;
        button.addEventListener('click', () => reactToMessage(message.id, reaction.emoji));
        reactions.appendChild(button);
    });
    bubble.appendChild(reactions);
}

function messageReceipt(message) {
    const otherRead = (message.readBy || []).some((id) => id !== state.user.id);
    const otherDelivered = (message.deliveredTo || []).some((id) => id !== state.user.id);
    if (otherRead) return { text: '✓✓', label: 'Lida', className: 'checks read' };
    if (otherDelivered) return { text: '✓✓', label: 'Entregue', className: 'checks' };
    return { text: '✓', label: 'Enviada', className: 'checks' };
}

function renderMessage(message) {
    state.messages.set(message.id, message);
    const mine = message.remetente?.id === state.user?.id;
    const item = document.createElement('li');
    item.className = `message ${mine ? 'mine' : 'theirs'}${message.excluidaParaTodos ? ' deleted' : ''}${message.id === state.activeConversation.pinnedMessageId ? ' pinned' : ''}`;
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
    menuButton.addEventListener('click', () => openMessageActions(message));
    heading.append(sender, menuButton);

    const content = document.createElement('div');
    content.className = 'message-content';
    if (message.excluidaParaTodos) {
        content.innerHTML = '<p class="deleted-copy">⊘ Esta mensagem foi apagada</p>';
        menuButton.remove();
    } else {
        if (message.replyTo) {
            const reply = document.createElement('button');
            reply.type = 'button';
            reply.className = 'reply-reference';
            reply.innerHTML = '<strong></strong><span></span>';
            reply.querySelector('strong').textContent = message.replyTo.senderName || 'Mensagem';
            reply.querySelector('span').textContent = message.replyTo.text || 'Arquivo';
            reply.addEventListener('click', () => focusMessage(message.replyTo.id));
            content.appendChild(reply);
        }
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
    if (message.editedAt) {
        const edited = document.createElement('span');
        edited.className = 'edited-label';
        edited.textContent = 'editada';
        meta.appendChild(edited);
    }
    if (mine && !message.excluidaParaTodos) {
        const checks = document.createElement('span');
        const receipt = messageReceipt(message);
        checks.className = receipt.className;
        checks.textContent = receipt.text;
        checks.setAttribute('aria-label', receipt.label);
        meta.appendChild(checks);
    }

    bubble.append(heading, content, meta);
    renderReactionBar(bubble, message);
    bubble.addEventListener('dblclick', () => reactToMessage(message.id, '👍'));
    item.append(avatar, bubble);
    elements.messages.appendChild(item);
}

function focusMessage(messageId) {
    const item = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!item) return showToast('Esta mensagem não está mais no histórico.');
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.classList.add('message-highlight');
    setTimeout(() => item.classList.remove('message-highlight'), 1500);
}

function reactToMessage(messageId, emoji) {
    state.socket?.emit('react message', { messageId, emoji }, (result) => {
        if (!result?.ok) showToast(result?.erro || 'Não foi possível reagir.', 'error');
    });
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

    if (state.editingMessage) {
        const message = state.editingMessage;
        state.socket.emit('edit message', { messageId: message.id, text: texto }, (result) => {
            if (!result?.ok) return showToast(result?.erro || 'Não foi possível editar.', 'error');
            elements.messageInput.value = '';
            clearComposerContext();
            resizeComposer();
        });
        return;
    }

    elements.messageInput.value = '';
    localStorage.removeItem(draftKey(state.activeConversation.id));
    resizeComposer();
    state.socket.emit('chat message', {
        texto,
        replyToId: state.replyingTo?.id || '',
        ...conversationPayload(),
    }, (result) => {
        if (!result?.ok) {
            elements.messageInput.value = texto;
            resizeComposer();
            showToast(result?.erro || 'Não foi possível enviar.', 'error');
        } else {
            clearComposerContext();
        }
    });
});

function resizeComposer() {
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 120)}px`;
}

elements.messageInput.addEventListener('input', () => {
    resizeComposer();
    saveCurrentDraft();
    clearTimeout(state.typingTimer);
    state.socket?.emit('typing', { ...conversationPayload(), typing: true });
    state.typingTimer = setTimeout(() => {
        state.socket?.emit('typing', { ...conversationPayload(), typing: false });
    }, 1200);
});
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
    if (state.replyingTo?.id) formData.append('replyToId', state.replyingTo.id);
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
        clearComposerContext();
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

function clearComposerContext() {
    state.replyingTo = null;
    state.editingMessage = null;
    elements.replyComposerBar.classList.add('is-hidden');
    elements.replyComposerTitle.textContent = 'Respondendo';
    elements.replyComposerText.textContent = '';
}

function setReplyContext(message) {
    state.replyingTo = message;
    state.editingMessage = null;
    elements.replyComposerTitle.textContent = `Respondendo a ${message.remetente?.id === state.user.id ? 'você' : message.remetente?.nome}`;
    elements.replyComposerText.textContent = message.texto || message.anexo?.nome || 'Arquivo';
    elements.replyComposerBar.classList.remove('is-hidden');
    elements.messageInput.focus();
}

function openMessageActions(message) {
    state.selectedMessage = message;
    const mine = message.remetente?.id === state.user.id;
    const canEdit = mine && Date.now() - new Date(message.createdAt).getTime() <= 15 * 60 * 1000 && !message.excluidaParaTodos;
    elements.editMessageButton.classList.toggle('is-hidden', !canEdit);
    const canPin = state.activeConversation.type !== 'community'
        && (state.activeConversation.type === 'private' || state.activeConversation.isAdmin);
    elements.pinMessageButton.classList.toggle('is-hidden', !canPin);
    elements.pinMessageButton.textContent = state.activeConversation.pinnedMessageId === message.id ? '📌 Desafixar' : '📌 Fixar no topo';
    elements.quickReactions.textContent = '';
    ['👍', '❤️', '😂', '😮', '😢', '🙏'].forEach((emoji) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = emoji;
        button.addEventListener('click', () => {
            reactToMessage(message.id, emoji);
            closeMessageActions();
        });
        elements.quickReactions.appendChild(button);
    });
    elements.messageActionsModal.classList.remove('is-hidden');
}

function closeMessageActions() {
    elements.messageActionsModal.classList.add('is-hidden');
}

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

elements.cancelReplyButton.addEventListener('click', clearComposerContext);
elements.replyMessageButton.addEventListener('click', () => {
    if (state.selectedMessage) setReplyContext(state.selectedMessage);
    closeMessageActions();
});
elements.editMessageButton.addEventListener('click', () => {
    if (!state.selectedMessage) return;
    state.editingMessage = state.selectedMessage;
    state.replyingTo = null;
    elements.replyComposerTitle.textContent = 'Editando mensagem';
    elements.replyComposerText.textContent = state.selectedMessage.texto || '';
    elements.replyComposerBar.classList.remove('is-hidden');
    elements.messageInput.value = state.selectedMessage.texto || '';
    resizeComposer();
    elements.messageInput.focus();
    closeMessageActions();
});
elements.pinMessageButton.addEventListener('click', () => {
    if (!state.selectedMessage) return;
    const pinned = state.activeConversation.pinnedMessageId !== state.selectedMessage.id;
    state.socket.emit('pin message', { messageId: state.selectedMessage.id, pinned }, (result) => {
        if (!result?.ok) showToast(result?.erro || 'Não foi possível fixar.', 'error');
    });
    closeMessageActions();
});
elements.openDeleteButton.addEventListener('click', () => {
    if (!state.selectedMessage) return;
    const message = state.selectedMessage;
    closeMessageActions();
    openDeleteModal(message.id, message.remetente?.id === state.user.id);
});
elements.cancelMessageActionsButton.addEventListener('click', closeMessageActions);
elements.messageActionsModal.addEventListener('click', (event) => {
    if (event.target === elements.messageActionsModal) closeMessageActions();
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
    clearTimeout(state.searchTimer);
    const query = elements.searchInput.value.trim();
    if (query.length < 2) return renderUserSearchResults([], query);
    state.searchTimer = setTimeout(async () => {
        try {
            const users = await searchUsers(query);
            if (elements.searchInput.value.trim() === query) renderUserSearchResults(users, query);
        } catch (error) {
            showToast(error.message, 'error');
        }
    }, 300);
});

elements.chatFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.conversationFilter = button.dataset.filter;
    elements.chatFilters.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
    renderConversations();
});

elements.newGroupButton.addEventListener('click', () => openGroupModal('create'));
elements.chatMenuButton.addEventListener('click', openChatInfo);
elements.closeChatInfoButton.addEventListener('click', closeChatInfo);
elements.chatInfoModal.addEventListener('click', (event) => {
    if (event.target === elements.chatInfoModal) closeChatInfo();
});
elements.togglePinConversationButton.addEventListener('click', async () => {
    if (await updateConversationPreference('pinned', !state.activeConversation.pinned)) openChatInfo();
});
elements.toggleMuteButton.addEventListener('click', async () => {
    if (await updateConversationPreference('muted', !state.activeConversation.muted)) openChatInfo();
});
elements.toggleArchiveButton.addEventListener('click', async () => {
    const archived = !state.activeConversation.archived;
    if (!await updateConversationPreference('archived', archived)) return;
    closeChatInfo();
    if (archived) elements.communityConversation.click();
});
elements.openMediaButton.addEventListener('click', () => {
    closeChatInfo();
    openMediaGallery();
});
elements.closeMediaButton.addEventListener('click', () => elements.mediaModal.classList.add('is-hidden'));
elements.mediaModal.addEventListener('click', (event) => {
    if (event.target === elements.mediaModal) elements.mediaModal.classList.add('is-hidden');
});
elements.saveGroupNameButton.addEventListener('click', async () => {
    try {
        await api(`/api/groups/${encodeURIComponent(state.activeConversation.id)}`, {
            method: 'PATCH', body: JSON.stringify({ name: elements.editGroupNameInput.value }),
        });
        await fetchConversations();
        openChatInfo();
        showToast('Nome do grupo atualizado.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
});
elements.groupAvatarInput.addEventListener('change', async () => {
    const file = elements.groupAvatarInput.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('arquivo', file);
    try {
        await api(`/api/groups/${encodeURIComponent(state.activeConversation.id)}/avatar`, { method: 'POST', body: formData });
        await fetchConversations();
        openChatInfo();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        elements.groupAvatarInput.value = '';
    }
});
elements.inviteLinkButton.addEventListener('click', async () => {
    try {
        const payload = await api(`/api/groups/${encodeURIComponent(state.activeConversation.id)}/invite/reset`, { method: 'POST' });
        const token = payload.token;
        const link = `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
        await navigator.clipboard.writeText(link);
        showToast('Link de convite copiado.', 'success');
    } catch (error) {
        showToast('Não foi possível copiar o convite.', 'error');
    }
});
elements.leaveGroupButton.addEventListener('click', async () => {
    try {
        await api(`/api/groups/${encodeURIComponent(state.activeConversation.id)}/leave`, { method: 'POST' });
        closeChatInfo();
        await fetchConversations();
        elements.communityConversation.click();
        showToast('Você saiu do grupo.');
    } catch (error) {
        showToast(error.message, 'error');
    }
});
elements.blockUserButton.addEventListener('click', async () => {
    try {
        await api(`/api/privacy/block/${encodeURIComponent(state.activeConversation.recipientId)}`, { method: 'POST' });
        closeChatInfo();
        state.conversations = state.conversations.filter((item) => item.id !== state.activeConversation.id);
        renderConversations();
        elements.communityConversation.click();
        showToast('Usuário bloqueado.');
    } catch (error) {
        showToast(error.message, 'error');
    }
});
elements.reportUserButton.addEventListener('click', async () => {
    try {
        await api('/api/reports', {
            method: 'POST',
            body: JSON.stringify({ userId: state.activeConversation.recipientId, conversationId: state.activeConversation.id }),
        });
        showToast('Denúncia enviada para análise.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
});
elements.acceptRequestButton.addEventListener('click', async () => {
    try {
        await api(`/api/conversations/${encodeURIComponent(state.activeConversation.id)}/accept`, { method: 'POST' });
        state.activeConversation.request = false;
        updateConversationChrome();
        await fetchConversations();
        showToast('Solicitação aceita.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
});
elements.blockRequestButton.addEventListener('click', () => elements.blockUserButton.click());
elements.pinnedMessageBanner.addEventListener('click', () => focusMessage(state.activeConversation.pinnedMessageId));

elements.settingsButton.addEventListener('click', () => {
    const privacy = state.user.privacy || {};
    elements.allowEmailSearchToggle.checked = privacy.allowEmailSearch !== false;
    elements.showOnlineToggle.checked = privacy.showOnline !== false;
    elements.readReceiptsToggle.checked = privacy.readReceipts !== false;
    elements.privacyModal.classList.remove('is-hidden');
});
elements.closePrivacyButton.addEventListener('click', () => elements.privacyModal.classList.add('is-hidden'));
elements.privacyModal.addEventListener('click', (event) => {
    if (event.target === elements.privacyModal) elements.privacyModal.classList.add('is-hidden');
});
elements.savePrivacyButton.addEventListener('click', async () => {
    try {
        const payload = await api('/api/privacy', {
            method: 'PATCH',
            body: JSON.stringify({
                allowEmailSearch: elements.allowEmailSearchToggle.checked,
                showOnline: elements.showOnlineToggle.checked,
                readReceipts: elements.readReceiptsToggle.checked,
            }),
        });
        state.user = payload.usuario;
        elements.privacyModal.classList.add('is-hidden');
        showToast('Preferências salvas.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
});
elements.groupUserSearch.addEventListener('input', () => {
    clearTimeout(state.groupSearchTimer);
    const query = elements.groupUserSearch.value.trim();
    if (query.length < 2) {
        elements.groupSearchResults.textContent = '';
        return;
    }
    state.groupSearchTimer = setTimeout(async () => {
        try {
            const users = await searchUsers(query);
            if (elements.groupUserSearch.value.trim() === query) renderGroupSearchResults(users, query);
        } catch (error) {
            elements.groupError.textContent = error.message;
        }
    }, 300);
});
elements.saveGroupButton.addEventListener('click', saveGroup);
elements.cancelGroupButton.addEventListener('click', closeGroupModal);
elements.groupModal.addEventListener('click', (event) => {
    if (event.target === elements.groupModal) closeGroupModal();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeDeleteModal();
        closeMessageActions();
        closeGroupModal();
        closeChatInfo();
        elements.privacyModal.classList.add('is-hidden');
        elements.mediaModal.classList.add('is-hidden');
        elements.userSearchResults.classList.add('is-hidden');
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
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
        // 2. Aguarda o Service Worker estar pronto
        const registration = await navigator.serviceWorker.ready;

        // 3. Verifica se o usuário já está inscrito
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            const VAPID_PUBLIC_KEY = 'BMFKvUpP3kWfPYcgCx7LT49VBjHQpMoHaQC-Tw8gBqZAlAZvotO1sEl6FJPepOudl3_42R1X8ZgGV0k9gfKBhr4';
            const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }

        console.log('Nova assinatura de Push gerada:', subscription);

        // 5. Envia a assinatura e o ID do usuário logado para o backend
        await api('/api/notifications/subscribe', {
            method: 'POST',
            body: JSON.stringify({ subscription })
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
        navigator.serviceWorker.register('/sw.js?v=5')
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
                subscribeUserToPush();
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
