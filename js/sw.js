const CACHE_NAME = 'quran-app-v23';
const OFFLINE_URL = '/offline.html';
// Long enough for a slow-but-working connection, short enough that a dead
// one falls back to cache before the user gives up.
const NAVIGATION_TIMEOUT_MS = 4000;
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/quran.html',
  '/khatma.html',
  '/azkar.html',
  '/masbaha.html',
  '/settings.html',
  '/bookmarks.html',
  '/sunan.html',
  '/prayer-times.html',
  '/features.html',
  '/home-more.html',
  '/bio.html',
  '/references.html',
  '/css/tokens.css',
  '/css/styles.css',
  '/css/components.css',
  '/css/app-ui.css',
  '/css/native.css',
  '/js/theme-preload.js',
  '/js/a11y.js',
  '/js/native-ui.js',
  '/css/page-styles/index.css',
  '/css/page-styles/quran.css',
  '/css/page-styles/khatma.css',
  '/css/page-styles/azkar.css',
  '/css/page-styles/masbaha.css',
  '/css/page-styles/settings.css',
  '/css/page-styles/bookmarks.css',
  '/css/page-styles/sunan.css',
  '/css/page-styles/prayer-times.css',
  '/css/page-styles/features.css',
  '/css/page-styles/home-more.css',
  '/css/page-styles/bio.css',
  '/js/common.js',
  '/js/page-scripts/index.js',
  '/js/data/surahs.js',
  '/js/data/quran-index.js',
  '/js/prayer-core.js',
  '/js/tour.js',
  '/js/tours.js',
  '/js/onboarding.js',
  '/css/nav.css',
  '/css/tour.css',
  '/css/onboarding.css',
  '/js/page-scripts/quran.js',
  '/js/page-scripts/khatma.js',
  '/js/page-scripts/azkar.js',
  '/js/page-scripts/masbaha.js',
  '/js/page-scripts/settings.js',
  '/js/page-scripts/bookmarks.js',
  '/js/page-scripts/sunan.js',
  '/js/page-scripts/prayer-times.js',
  '/js/page-scripts/features.js',
  '/js/page-scripts/home-more.js',
  '/js/page-scripts/bio.js',
  '/data/manifest.json',
  '/data/azkar.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon.svg',
  '/assets/icons/favicon.png'
];

const QURAN_API_HOST = 'api.alquran.cloud';
// Immutable scripture endpoints (surah/ayah/juz/page text + tafsir editions).
// Deliberately excludes /search/, which must stay live.
const QURAN_TEXT_PATH = /^\/v1\/(surah|ayah|juz|page)\//;
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

  // Never intercept service worker scripts themselves.
  // This guarantees fresh SW checks and reliable update-banner detection.
  if (url.pathname === '/js/sw.js' || url.pathname === '/sw.js') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (url.hostname === QURAN_API_HOST) {
    // Quran text is immutable: a surah's Uthmani script never changes. Serving
    // it cache-first makes re-reads instant and works with no connection at
    // all, instead of waiting on a network round-trip every time.
    // Search results are live, so they stay network-first.
    if (QURAN_TEXT_PATH.test(url.pathname)) {
      event.respondWith(cacheFirst(request));
    } else {
      event.respondWith(networkFirst(request));
    }
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

// For content that never changes. Cache hit = instant and offline-capable;
// only a miss touches the network.
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request, { ignoreSearch: true });
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    await updateCache(request, networkResponse.clone());
    return networkResponse;
  } catch (_error) {
    // Shaped like the API's own envelope so callers can detect it by `code`
    // rather than choking on an HTML/text body in response.json().
    return new Response(JSON.stringify({ code: 503, status: 'OFFLINE', data: null }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
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

  // Empty body rather than the word "Offline", which would otherwise be
  // injected into whatever slot the request was for (a stylesheet, a script
  // tag, or an image).
  return new Response('', { status: 503, statusText: 'Offline' });
}

/**
 * Races a fetch against a timeout.
 *
 * Navigation was previously an unbounded network-first fetch. On a flaky or
 * captive-portal connection — the normal case on mobile — that hangs for as
 * long as the OS allows before any cache fallback runs, so the app appears
 * frozen and then fails. iOS is the worst offender.
 */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      response => { clearTimeout(timer); resolve(response); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
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

    // A plain-text 503 was being rendered raw by the browser — white text on
    // a black page in dark mode, which is the "offline screen" users saw.
    // Serve a real, styled, self-contained page instead.
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) {
      return offlinePage;
    }

    return new Response(
      '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<body style="margin:0;display:grid;place-items:center;min-height:100vh;' +
      'font-family:system-ui,sans-serif;background:#fbf8f2;color:#1a1714">' +
      '<p>لا يوجد اتصال بالإنترنت</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
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
