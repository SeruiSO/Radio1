const CACHE_NAME = 'radio-cache-v277524';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/script.js',
        '/stations.json',
        '/manifest.json',
        '/ping.txt'
      ]);
    }).catch((error) => {
      console.error('Failed to open cache or add resources:', error);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (event.request.url.endsWith('stations.json')) {
        return fetch(event.request, { cache: 'no-store', signal: new AbortController().signal })
          .then((networkResponse) => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          })
          .catch(() => response || caches.match('/stations.json'));
      }
      return response || fetch(event.request).catch(() => caches.match('/index.html'));
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
    }).catch((error) => {
      console.error('Failed to clean up old caches:', error);
    }).finally(() => {
      stopNetworkCheck();
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
let checkInterval = null;

function startNetworkCheck() {
  if (!checkInterval) {
    checkInterval = setInterval(() => {
      fetch("/ping.txt", { method: "HEAD", cache: "no-store" })
        .then(() => {
          if (!wasOnline) {
            wasOnline = true;
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({ type: "NETWORK_STATUS", online: true });
              });
            });
            stopNetworkCheck();
          }
        })
        .catch(error => {
          console.error('Network check failed:', error);
          if (wasOnline) {
            wasOnline = false;
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({ type: "NETWORK_STATUS", online: false });
              });
            });
          }
        });
    }, 5000);
  }
}

function stopNetworkCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

self.addEventListener('online', () => {
  if (!wasOnline) {
    wasOnline = true;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: true });
      });
    });
    stopNetworkCheck();
  }
});

self.addEventListener('offline', () => {
  if (wasOnline) {
    wasOnline = false;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: false });
      });
    });
    startNetworkCheck();
  }
});

// Start initial check if already offline
if (!navigator.onLine && wasOnline) {
  wasOnline = false;
  startNetworkCheck();
}