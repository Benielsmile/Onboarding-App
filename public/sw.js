/**
 * PIGA STUDIO — Service Worker & Web Push Notification Handler
 */

const CACHE_NAME = 'piga-arsenal-v2'; // v2 : set d'icônes régénéré depuis le logo PIGA officiel
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Native Web Push Notification handler
self.addEventListener('push', (event) => {
  let data = {
    title: 'PIGA STUDIO · Nouvelle Inscription',
    body: 'Un participant vient de soumettre un paiement Orange Money ($20 USD).',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: '/#admin' }
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    data: data.data || { url: '/#admin' },
    actions: [
      { action: 'open_admin', title: 'Ouvrir l\'Admin' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Client postMessage triggered notification (for instant in-app event dispatching)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data } = event.data;
    self.registration.showNotification(title || 'PIGA STUDIO Notification', {
      body: body || 'Nouvelle action enregistrée',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: tag || 'piga-notification',
      vibrate: [150, 80, 150],
      data: data || { url: '/#admin' }
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/#admin';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
