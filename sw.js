const CACHE_NAME = 'radio-pwa-cache-v90';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/stations.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кешування файлів:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Видалення старого кешу:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => {
      console.log('Активація нового Service Worker');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  console.log(`Обробка запиту: ${requestUrl.href}`); // Діагностичний лог

  if (!requestUrl.origin.includes(self.location.origin)) {
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          console.error(`Помилка запиту до ${requestUrl.href}:`, error);
          return new Response('Network error', { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (event.request.method === 'GET') {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then(cachedResponse => {
          return cachedResponse || new Response('Offline', { status: 503 });
        });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data.type === 'NETWORK_STATUS') {
    event.ports[0].postMessage({ online: navigator.onLine });
  }
});