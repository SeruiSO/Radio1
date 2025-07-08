const CACHE_NAME = 'radio-so-cache-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/stations.json',
  '/favicon.ico',
  '/manifest.json',
  '/ping.txt'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Opened cache');
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
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/stations.json') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, response.clone());
            });
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'CACHE_UPDATED',
                  cacheVersion: CACHE_NAME
                });
              });
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request).catch(() => {
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
        })
    );
  }
});

// Network status checking
let isOnline = navigator.onLine;
let lastStatus = isOnline;
let networkCheckInterval = null;

function checkNetworkStatus() {
  fetch('/ping.txt', { method: 'HEAD', cache: 'no-store' })
    .then(response => {
      if (response.ok && !isOnline) {
        isOnline = true;
        if (lastStatus !== isOnline) {
          console.log('SW: Network restored');
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'NETWORK_STATUS',
                online: true
              });
            });
          });
          // Stop checking after network is restored
          clearInterval(networkCheckInterval);
          networkCheckInterval = null;
        }
      }
      lastStatus = isOnline;
    })
    .catch(error => {
      if (isOnline) {
        isOnline = false;
        if (lastStatus !== isOnline) {
          console.log('SW: Network lost', error);
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'NETWORK_STATUS',
                online: false
              });
            });
          });
        }
      }
      lastStatus = isOnline;
    });
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_NETWORK') {
    if (!isOnline && !networkCheckInterval) {
      console.log('SW: Starting network check on demand');
      checkNetworkStatus();
      networkCheckInterval = setInterval(checkNetworkStatus, 1000);
    }
  }
});

// Start network check on offline event
self.addEventListener('offline', () => {
  if (isOnline) {
    isOnline = false;
    console.log('SW: Offline event triggered');
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NETWORK_STATUS',
          online: false
        });
      });
    });
    if (!networkCheckInterval) {
      console.log('SW: Starting network check after offline event');
      networkCheckInterval = setInterval(checkNetworkStatus, 1000);
    }
  }
  lastStatus = isOnline;
});

// Stop network check on online event
self.addEventListener('online', () => {
  if (!isOnline) {
    isOnline = true;
    console.log('SW: Online event triggered');
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NETWORK_STATUS',
          online: true
        });
      });
    });
    if (networkCheckInterval) {
      console.log('SW: Stopping network check after online event');
      clearInterval(networkCheckInterval);
      networkCheckInterval = null;
    }
  }
  lastStatus = isOnline;
});