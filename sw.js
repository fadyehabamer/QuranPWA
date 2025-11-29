const CACHE_NAME = 'quran-app-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/quran',
  '/quran.html',
  '/azkar',
  '/azkar.html',
  '/masbaha',
  '/masbaha.html',
  '/settings',
  '/settings.html',
  '/bookmarks',
  '/bookmarks.html',
  '/sunan',
  '/sunan.html',
  '/bio',
  '/bio.html',
  '/styles.css',
  '/common.js',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('Cache addAll error:', err);
      })
  );
  // Force the waiting service worker to become active
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip caching for chrome-extension and other unsupported schemes
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Try matching with .html extension for clean URLs
        const urlPath = url.pathname;
        if (!urlPath.endsWith('.html') && !urlPath.includes('.')) {
          const htmlRequest = new Request(urlPath + '.html');
          return caches.match(htmlRequest).then(htmlResponse => {
            if (htmlResponse) {
              return htmlResponse;
            }
            return fetchAndCache(event.request);
          });
        }

        return fetchAndCache(event.request);
      })
  );
});

function fetchAndCache(request) {
  return fetch(request).then(response => {
    // Check if we received a valid response
    if (!response || response.status !== 200 || response.type !== 'basic') {
      return response;
    }

    // Clone the response
    const responseToCache = response.clone();

    caches.open(CACHE_NAME).then(cache => {
      cache.put(request, responseToCache);
    });

    return response;
  }).catch(() => {
    // Return a fallback response if fetch fails
    return new Response('Network error', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  });
}

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
