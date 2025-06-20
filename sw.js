const CACHE_NAME = 'radio-cache-v60.1.20250618';

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
        return caches.keys().then((cacheNames) => {
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
    }).then(() => self.clients.claim())
  );
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
    });
  });
});

// Моніторинг стану мережі
let wasOnline = navigator.onLine;
let networkCheckInterval = null;
let networkStatus = { online: wasOnline, lastChecked: Date.now() };
let reconnectionInterval = null;
const RECONNECTION_LIMIT = 20 * 60 * 1000; // 20 хвилин

function checkNetwork() {
  fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
    .then(() => {
      if (!wasOnline) {
        wasOnline = true;
        networkStatus = { online: true, lastChecked: Date.now() };
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "NETWORK_STATUS", online: true, lastChecked: networkStatus.lastChecked });
          });
        });
        clearInterval(networkCheckInterval);
        networkCheckInterval = null;
        console.log("Мережа відновлена, перевірка припинена");
      }
    })
    .catch(error => {
      console.error("Помилка перевірки мережі:", error);
      if (wasOnline) {
        wasOnline = false;
        networkStatus = { online: false, lastChecked: Date.now() };
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "NETWORK_STATUS", online: false, lastChecked: networkStatus.lastChecked });
          });
        });
        if (!networkCheckInterval) {
          networkCheckInterval = setInterval(checkNetwork, 2000);
          console.log("Мережа втрачена, початок перевірки кожні 2 секунди");
        }
      }
    });
}

// Запуск повторних спроб відтворення
function scheduleReconnection() {
  if (reconnectionInterval) return; // Запобігаємо множинним інтервалам
  reconnectionInterval = setInterval(() => {
    if (wasOnline) {
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "TRY_RECONNECT", lastChecked: Date.now() });
        });
      });
    }
  }, 2000);
}

// Зупинка повторних спроб
function stopReconnection() {
  if (reconnectionInterval) {
    clearInterval(reconnectionInterval);
    reconnectionInterval = null;
    console.log("Повторні спроби відтворення припинено");
  }
}

// Ініціалізація перевірки мережі
if (!wasOnline && !networkCheckInterval) {
  networkCheckInterval = setInterval(checkNetwork, 2000);
  console.log("Початок перевірки мережі кожні 2 секунди");
}

// Обробка повідомлень від клієнтів
self.addEventListener('message', (event) => {
  if (event.data.type === 'GET_NETWORK_STATUS') {
    event.source.postMessage({ type: 'NETWORK_STATUS', ...networkStatus });
  } else if (event.data.type === 'START_RECONNECTION') {
    scheduleReconnection();
  } else if (event.data.type === 'STOP_RECONNECTION') {
    stopReconnection();
  }
});