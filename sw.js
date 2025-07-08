const CACHE_NAME = 'radio-so-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/stations.json',
  '/favicon.ico',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
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

function checkNetworkStatus() {
  fetch('https://www.google.com', { method: 'HEAD', cache: 'no-store' })
    .then(() => {
      if (!isOnline) {
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
        }
      }
      lastStatus = isOnline;
    })
    .catch(() => {
      if (isOnline) {
        isOnline = false;
        if (lastStatus !== isOnline) {
          console.log('SW: Network lost');
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

// Check network status every 1 second
setInterval(checkNetworkStatus, 1000);

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_NETWORK') {
    checkNetworkStatus();
  }
});