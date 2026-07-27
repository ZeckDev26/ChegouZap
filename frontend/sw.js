const CACHE_NAME = 'chegouzap-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

// Instala o Service Worker e faz o cache
self.addEventListener('install', (event) => {
  self.skipWaiting(); // 🔥 MATA O SW ANTIGO E FORÇA A ATUALIZAÇÃO IMEDIATA
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 🔥 NOVO: Faz o SW assumir o controle de todas as abas/apps abertos instantaneamente
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Intercepta as requisições (Cache First)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Ouve o evento 'push' vindo do servidor
self.addEventListener('push', (event) => {
    let data = {};
    
    // 🔥 Proteção contra quebra de JSON
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { body: event.data.text() }; // Se não for JSON, pega como texto puro
        }
    }
    
    const title = data.title || 'ChegouZap';
    
    const options = {
        body: data.body || 'Você tem uma nova mensagem.',
        icon: '/icon-192.svg',
        badge: '/icon-192.svg', // Ícone pequeno para a barra de status
        vibrate: [200, 100, 200], // Vibração
        data: {
            url: data.url || '/' // Onde abrir quando clicar
        }
    };

    // Mostra a notificação nativa
    event.waitUntil(self.registration.showNotification(title, options));
});

// Ouve o clique na notificação
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

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