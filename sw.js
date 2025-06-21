const CACHE_NAME = 'radio-cache-v100.1.20250618';
let wasOnline = navigator.onLine;
let networkCheckInterval = null;
let isCheckingNetwork = false;

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
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
      });
    })
  );
});

// Покращена функція перевірки мережі
async function checkNetworkWithRetry() {
  if (isCheckingNetwork) return;
  isCheckingNetwork = true;
  
  try {
    const response = await fetch('https://www.google.com', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(2000)
    });
    
    if (!wasOnline) {
      wasOnline = true;
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'NETWORK_STATUS', online: true });
        });
      });
      clearInterval(networkCheckInterval);
      networkCheckInterval = null;
    }
  } catch (error) {
    if (wasOnline) {
      wasOnline = false;
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
  }
  
  // Перші 3 хвилини - перевірка кожні 2 секунди
  networkCheckInterval = setInterval(checkNetworkWithRetry, 2000);
  
  // Після 3 хвилин переходимо на перевірку кожні 5 секунд
  setTimeout(() => {
    if (networkCheckInterval && !wasOnline) {
      clearInterval(networkCheckInterval);
      networkCheckInterval = setInterval(checkNetworkWithRetry, 5000);
    }
  }, 3 * 60 * 1000); // 3 хвилини
}

self.addEventListener('message', (event) => {
  if (event.data.type === 'START_NETWORK_MONITORING') {
    if (!wasOnline && !networkCheckInterval) {
      startNetworkMonitoring();
    }
  }
});

// Початок моніторингу при активації Service Worker
if (!wasOnline && !networkCheckInterval) {
  startNetworkMonitoring();
}