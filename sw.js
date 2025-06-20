const CACHE_NAME = 'radio-cache-v44.1.20250620';

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
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (event.request.url.endsWith('stations.json')) {
        return fetch(event.request, { cache: 'no-store', signal: new AbortController().signal }).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => caches.match(event.request));
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
let networkCheckInterval = null;

function checkNetwork() {
  const isOnline = navigator.onLine;
  if (isOnline && !wasOnline) {
    wasOnline = true;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: true });
      });
    });
    clearInterval(networkCheckInterval);
    networkCheckInterval = null;
    console.log("Мережа відновлена, перевірка припинена");
  } else if (!isOnline && wasOnline) {
    wasOnline = false;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: false });
      });
    });
    if (!networkCheckInterval) {
      let elapsed = 0;
      networkCheckInterval = setInterval(() => {
        elapsed += 1000;
        if (elapsed < 10000) {
          checkNetwork();
        } else if (elapsed < 30000) {
          clearInterval(networkCheckInterval);
          networkCheckInterval = setInterval(checkNetwork, 2000);
        } else {
          clearInterval(networkCheckInterval);
          networkCheckInterval = setInterval(checkNetwork, Math.min(4000 * Math.pow(2, Math.floor((elapsed - 30000) / 1000)), 32000));
        }
        if (elapsed >= 20 * 60 * 1000) {
          clearInterval(networkCheckInterval);
          networkCheckInterval = null;
          console.log("Досягнуто ліміт перевірки мережі (20 хвилин)");
        }
      }, 1000);
      console.log("Мережа втрачена, початок перевірки");
    }
  }
}

if (!wasOnline && !networkCheckInterval) {
  let elapsed = 0;
  networkCheckInterval = setInterval(() => {
    elapsed += 1000;
    if (elapsed < 10000) {
      checkNetwork();
    } else if (elapsed < 30000) {
      clearInterval(networkCheckInterval);
      networkCheckInterval = setInterval(checkNetwork, 2000);
    } else {
      clearInterval(networkCheckInterval);
      networkCheckInterval = setInterval(checkNetwork, Math.min(4000 * Math.pow(2, Math.floor((elapsed - 30000) / 1000)), 32000));
    }
    if (elapsed >= 20 * 60 * 1000) {
      clearInterval(networkCheckInterval);
      networkCheckInterval = null;
      console.log("Досягнуто ліміт перевірки мережі (20 хвилин)");
    }
  }, 1000);
  console.log("Початок перевірки мережі");
}