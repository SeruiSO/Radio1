const CACHE_NAME = 'radio-so-cache-v11';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/stations.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      self.clients.claim();
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({
          type: 'CACHE_UPDATED',
          cacheVersion: CACHE_NAME
        }));
      });
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/stations.json') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          return caches.match(event.request).then(response => {
            return response || new Response('Offline', { status: 503 });
          });
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request).then(networkResponse => {
            if (!networkResponse.ok) {
              throw new Error('Network response was not ok');
            }
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          });
        })
        .catch(() => {
          return caches.match(event.request).then(response => {
            return response || new Response('Offline', { status: 503 });
          });
        })
    );
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_NETWORK') {
    const isOnline = navigator.onLine;
    event.ports[0].postMessage({
      type: 'NETWORK_STATUS',
      online: isOnline
    });
  }
});