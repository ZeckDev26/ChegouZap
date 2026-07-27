const CACHE_NAME = 'chegouzap-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

// Instala o Service Worker e faz o cache dos arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Intercepta as requisições para servir do cache caso esteja offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
// Ouve o evento 'push' vindo do servidor
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Nova mensagem no ChegouZap';
    
    const options = {
        body: data.body || 'Você tem uma nova mensagem.',
        icon: '/icon-192.svg',
        badge: '/icon-192.svg', // Ícone pequeno para a barra de status do Android
        vibrate: [200, 100, 200], // Vibração personalizada
        data: {
            url: data.url || '/' // Onde abrir quando clicar
        }
    };

    // Mostra a notificação nativa
    event.waitUntil(self.registration.showNotification(title, options));
});

// Ouve o clique na notificação
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // Fecha a notificação visualmente

    // Tenta focar na aba do app se já estiver aberta, ou abre uma nova
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === self.registration.scope && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});