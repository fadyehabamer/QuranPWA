const CACHE_NAME = 'quran-app-v12';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/quran.html',
  '/azkar.html',
  '/masbaha.html',
  '/settings.html',
  '/bookmarks.html',
  '/sunan.html',
  '/prayer-times.html',
  '/bio.html',
  '/styles.css',
  '/common.js',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

const QURAN_API_HOST = 'api.alquran.cloud';
const STREAM_HOST_BLOCKLIST = [
  'mp3quran.net',
  'radiojar.com',
  'qurango.net',
  'radio.co'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Cache each URL independently so one failing request does not abort installation.
      await Promise.allSettled(
        APP_SHELL_URLS.map(async (url) => {
          try {
            const request = new Request(url, { cache: 'reload' });
            const response = await fetch(request);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            await cache.put(request, response.clone());
          } catch (error) {
            console.warn('[SW] Precache skip:', url, error && error.message ? error.message : error);
          }
        })
      );
    })()
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  if (url.pathname.includes('radio') ||
    url.pathname.includes('stream') ||
    STREAM_HOST_BLOCKLIST.some(host => url.hostname.includes(host))) {
    return;
  }

  // Never intercept the service worker script itself.
  // This guarantees fresh SW checks and reliable update-banner detection.
  if (url.pathname === '/sw.js') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (url.hostname === QURAN_API_HOST) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

function getHtmlFallbackPath(pathname) {
  if (!pathname || pathname === '/') {
    return '/index.html';
  }

  if (pathname.endsWith('.html') || pathname.includes('.')) {
    return pathname;
  }

  return `${pathname}.html`;
}

function shouldCacheResponse(response) {
  return response && response.status === 200 && (response.type === 'basic' || response.type === 'cors');
}

async function updateCache(request, response) {
  if (!shouldCacheResponse(response)) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    await updateCache(request, networkResponse.clone());
    return networkResponse;
  } catch (_error) {
    const cachedResponse = await caches.match(request, { ignoreSearch: true });
    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response('Network unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request, { ignoreSearch: true });

  const networkPromise = fetch(request)
    .then(async networkResponse => {
      await updateCache(request, networkResponse.clone());
      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    await updateCache(request, networkResponse.clone());
    return networkResponse;
  } catch (_error) {
    const requestUrl = new URL(request.url);
    const fallbackPath = getHtmlFallbackPath(requestUrl.pathname);
    const cachedResponse = await caches.match(request, { ignoreSearch: true }) ||
      await caches.match(fallbackPath) ||
      await caches.match('/index.html');

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message });
      })
    );
  }
});
