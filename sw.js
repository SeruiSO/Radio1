const CACHE_NAME = 'radio-cache-v25.2.20250619';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/script.js',
        '/stations.json',
        '/manifest.json'
      ]).then(() => {
        caches.keys().then((cacheNames) => {
          return Promise.all(cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          }));
        });
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Виключення аудіопотоків із кешу
  if (
    url.pathname.includes('stream') ||
    url.pathname.includes('radio') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.aac') ||
    url.searchParams.has('t')
  ) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' }
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (event.request.url.endsWith('stations.json')) {
        return fetch(event.request, { cache: 'no-store', signal: new AbortController().signal }).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => caches.match('/index.html'));
      }
      return response || fetch(event.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
    });
  });
});

// Моніторинг стану мережі
let wasOnline = navigator.onLine;

setInterval(() => {
  fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
    .then(() => {
      if (!wasOnline) {
        wasOnline = true;
        setTimeout(() => {
          self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: "NETWORK_STATUS", online: true });
            });
          });
        }, 500); // Затримка для стабілізації мережі
      }
    })
    .catch(error => {
      console.error("Помилка перевірки мережі:", error);
      if (wasOnline) {
        wasOnline = false;
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "NETWORK_STATUS", online: false });
          });
        });
      }
    });
}, 1000);