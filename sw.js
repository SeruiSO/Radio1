const CACHE_NAME = 'radio-cache-v102.2.20250621';
let wasOnline = navigator.onLine;
let networkCheckInterval = null;
let isCheckingNetwork = false;
const NETWORK_CHECK_ENDPOINT = 'https://de1.api.radio-browser.info/json/servers';
const FIRST_5_MINUTES = 5 * 60 * 1000; // 5 хвилин

self.addEventListener('install', (event) => {
  console.log('[SW] Установка Service Worker');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Кешування ресурсів');
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/script.js',
        '/stations.json',
        '/manifest.json',
        '/icons/icon-192x192.png',
        '/icons/icon-512x512.png'
      ]);
    }).then(() => {
      self.skipWaiting();
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (event.request.url.endsWith('stations.json')) {
        return fetch(event.request, { 
          cache: 'no-store', 
          signal: AbortSignal.timeout(5000) 
        }).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => caches.match('/index.html'));
      }
      return response || fetch(event.request).catch(() => caches.match('/index.html'));
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Активація Service Worker');
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Видалення старого кешу:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Перевірка дозволу перед реєстрацією Periodic Background Sync
      self.registration.permissions.query({ name: 'periodic-background-sync' }).then((status) => {
        if (status.state === 'granted') {
          return self.registration.periodicSync.register('network-check', {
            minInterval: 60 * 1000 // 60 секунд
          }).then(() => {
            console.log('[SW] Periodic Background Sync успішно зареєстровано');
          }).catch((error) => {
            console.error('[SW] Помилка реєстрації Periodic Background Sync:', error);
          });
        } else {
          console.log('[SW] Дозвіл на Periodic Background Sync не надано, пропускаємо реєстрацію');
        }
      }).catch((error) => {
        console.error('[SW] Помилка перевірки дозволу Periodic Background Sync:', error);
      })
    ]).then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
      });
    }).then(() => {
      self.clients.claim();
    })
  );
});

// Покращена функція перевірки мережі
async function checkNetworkWithRetry() {
  if (isCheckingNetwork) {
    console.log('[SW] Перевірка мережі вже виконується, пропускаємо');
    return;
  }
  isCheckingNetwork = true;
  
  try {
    console.log('[SW] Перевірка мережі:', NETWORK_CHECK_ENDPOINT);
    const response = await fetch(NETWORK_CHECK_ENDPOINT, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(2000)
    });
    
    if (!wasOnline) {
      wasOnline = true;
      console.log('[SW] Мережа відновлена, повідомляємо клієнтів');
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'NETWORK_STATUS', online: true });
        });
      });
      // Зупиняємо інтервал, якщо мережа відновлена
      if (networkCheckInterval) {
        clearInterval(networkCheckInterval);
        networkCheckInterval = null;
        console.log('[SW] Інтервал перевірки мережі зупинено');
      }
    }
  } catch (error) {
    if (wasOnline) {
      wasOnline = false;
      console.log('[SW] Мережа втрачена, повідомляємо клієнтів');
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'NETWORK_STATUS', online: false });
        });
      });
      if (!networkCheckInterval) {
        startNetworkMonitoring();
      }
    }
  } finally {
    isCheckingNetwork = false;
  }
}

function startNetworkMonitoring() {
  if (networkCheckInterval) {
    clearInterval(networkCheckInterval);
    console.log('[SW] Попередній інтервал перевірки мережі очищено');
  }
  
  // Перевірка кожну секунду в перші 5 хвилин
  networkCheckInterval = setInterval(checkNetworkWithRetry, 1000);
  console.log('[SW] Запущено моніторинг мережі кожну секунду');
  
  // Після 5 хвилин зупиняємо інтервал, Periodic Background Sync візьме на себе перевірки
  setTimeout(() => {
    if (networkCheckInterval && !wasOnline) {
      clearInterval(networkCheckInterval);
      networkCheckInterval = null;
      console.log('[SW] Перевірка мережі після 5 хвилин зупинена, переходимо на Periodic Background Sync');
    }
  }, FIRST_5_MINUTES);
}

// Обробка Periodic Background Sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'network-check') {
    console.log('[SW] Виконується Periodic Background Sync');
    event.waitUntil(checkNetworkWithRetry());
  }
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'START_NETWORK_MONITORING') {
    if (!wasOnline && !networkCheckInterval) {
      console.log('[SW] Отримано команду START_NETWORK_MONITORING');
      startNetworkMonitoring();
    }
  }
});

// Початок моніторингу при активації Service Worker
if (!wasOnline && !networkCheckInterval) {
  console.log('[SW] Початковий запуск моніторингу мережі');
  startNetworkMonitoring();
}