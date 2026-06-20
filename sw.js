const CACHE_NAME = 'radio-cache-v11375642';

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
  // Примусове оновлення SW
  self.skipWaiting();
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
    }).then(() => {
      return self.clients.claim();
    })
  );
  
  // Повідомляємо клієнтів про оновлення кешу
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ 
        type: 'CACHE_UPDATED', 
        cacheVersion: CACHE_NAME,
        timestamp: Date.now()
      });
    });
  });
});

// Кешування запитів та підтримка автономного режиму
self.addEventListener('fetch', (event) => {
  // Обробка API запитів до радіобраузера
  if (event.request.url.includes('api.radio-browser.info')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Кешуємо відповіді API для офлайн доступу
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return new Response(JSON.stringify({ error: 'Network error' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Обробка аудіо потоків
  if (event.request.url.match(/\.(mp3|aac|ogg|m3u8|pls)$/i) || 
      event.request.url.includes('listen') || 
      event.request.url.includes('stream')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Кешуємо аудіо для швидшого доступу
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Обробка звичайних запитів
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Для stations.json використовуємо мережу з оновленням кешу
      if (event.request.url.endsWith('stations.json')) {
        return fetch(event.request, { 
          cache: 'no-store', 
          signal: new AbortController().signal 
        }).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => caches.match('/index.html'));
      }
      
      // Відповідь з кешу або мережі
      return response || fetch(event.request).then((networkResponse) => {
        // Кешуємо ресурси для офлайн доступу
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {
        // Якщо запит на HTML, показуємо index.html
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
        return new Response('Network error', { status: 503 });
      });
    })
  );
});

// Моніторинг стану мережі
let wasOnline = navigator.onLine;
let checkInterval = null;
let networkRetryCount = 0;
const MAX_RETRY_COUNT = 3;

function startNetworkCheck() {
  if (!checkInterval) {
    checkInterval = setInterval(() => {
      fetch("/ping.txt", { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(5000) })
        .then(() => {
          if (!wasOnline) {
            wasOnline = true;
            networkRetryCount = 0;
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({ 
                  type: "NETWORK_STATUS", 
                  online: true,
                  timestamp: Date.now()
                });
              });
            });
            stopNetworkCheck();
          }
        })
        .catch(() => {
          networkRetryCount++;
          if (wasOnline && networkRetryCount >= MAX_RETRY_COUNT) {
            wasOnline = false;
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({ 
                  type: "NETWORK_STATUS", 
                  online: false,
                  timestamp: Date.now()
                });
              });
            });
          }
        });
    }, 2000);
  }
}

function stopNetworkCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    networkRetryCount = 0;
  }
}

self.addEventListener('online', () => {
  if (!wasOnline) {
    wasOnline = true;
    networkRetryCount = 0;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ 
          type: "NETWORK_STATUS", 
          online: true,
          timestamp: Date.now()
        });
      });
    });
    stopNetworkCheck();
    // Оновлюємо кеш при поверненні онлайн
    updateCache();
  }
});

self.addEventListener('offline', () => {
  if (wasOnline) {
    wasOnline = false;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ 
          type: "NETWORK_STATUS", 
          online: false,
          timestamp: Date.now()
        });
      });
    });
    startNetworkCheck();
  }
});

// Функція оновлення кешу
async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const urlsToUpdate = ['/stations.json'];
    await Promise.all(
      urlsToUpdate.map(async (url) => {
        try {
          const response = await fetch(url, { cache: 'no-store' });
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (error) {
          console.error(`Failed to update cache for ${url}:`, error);
        }
      })
    );
  } catch (error) {
    console.error('Cache update failed:', error);
  }
}

// Запускаємо перевірку мережі якщо вже офлайн
if (!navigator.onLine && wasOnline) {
  wasOnline = false;
  startNetworkCheck();
}

// Обробка помилок
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
});

// Обробка повідомлень від клієнтів
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'UPDATE_CACHE') {
    updateCache();
  }
});