const cacheVersion = 'v1';
const cacheFiles = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icon-192x192.png',
  '/stations.json'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(cacheVersion).then((cache) => {
      console.log('[Service Worker] Caching files');
      return cache.addAll(cacheFiles);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== cacheVersion) {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Sending CACHE_UPDATED message to clients');
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'CACHE_UPDATED',
            cacheVersion: cacheVersion
          });
        });
      });
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  console.log('[Service Worker] Fetch:', url.pathname);

  if (url.pathname === '/stations.json') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (!networkResponse.ok) {
          console.error('[Service Worker] Network fetch failed for stations.json:', networkResponse.status);
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[Service Worker] Serving stations.json from cache');
              return cachedResponse;
            }
            return networkResponse;
          });
        }
        console.log('[Service Worker] Updating cache for stations.json');
        return caches.open(cacheVersion).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch((error) => {
        console.error('[Service Worker] Fetch error for stations.json:', error);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[Service Worker] Serving stations.json from cache due to fetch error');
            return cachedResponse;
          }
          return new Response(JSON.stringify({ error: 'Offline and no cache available' }), {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          console.log('[Service Worker] Serving from cache:', url.pathname);
          return response;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse.ok) {
            console.error('[Service Worker] Network fetch failed:', networkResponse.status);
            return networkResponse;
          }
          return caches.open(cacheVersion).then((cache) => {
            console.log('[Service Worker] Caching:', url.pathname);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }).catch((error) => {
          console.error('[Service Worker] Fetch error:', error);
          return new Response('Offline and no cache available', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_NETWORK') {
    const isOnline = navigator.onLine;
    console.log('[Service Worker] Network status:', isOnline);
    event.ports[0].postMessage({
      type: 'NETWORK_STATUS',
      online: isOnline
    });
  }
});