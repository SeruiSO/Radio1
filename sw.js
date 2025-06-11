```javascript
const CACHE_NAME = 'radio-pwa-cache-v13';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/stations.json'
];

// Встановлення Service Worker
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

// Активація Service Worker
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

// Обробка запитів
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Для stations.json використовуємо стратегію "network-first"
  if (url.pathname === '/stations.json') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          // Кешуємо нову версію
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // Якщо мережа недоступна, повертаємо кеш
          return caches.match(event.request);
        })
    );
  } else {
    // Для інших ресурсів використовуємо "cache-first"
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request).then(networkResponse => {
            if (!networkResponse || !networkResponse.ok) {
              return networkResponse;
            }
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          });
        })
    );
  }
});

// Повідомлення про статус мережі
self.addEventListener('message', event => {
  if (event.data.type === 'CHECK_NETWORK') {
    const isOnline = navigator.onLine;
    event.source.postMessage({ type: 'NETWORK_STATUS', online: isOnline });
  }
});
```