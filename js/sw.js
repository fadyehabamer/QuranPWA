importScripts('/js/notify-store.js');

const CACHE_NAME = 'quran-app-v26';
const OFFLINE_URL = '/offline';

/* Surahs the reader has explicitly downloaded. Kept in its own cache so that:
     - the activate handler's "delete everything that isn't CACHE_NAME" sweep
       does not wipe a deliberate download on every app update, and
     - "clear cache" can leave it alone, since it is user-chosen content and
       not an incidental copy of something re-fetchable in a second. */
const QURAN_OFFLINE_CACHE = 'quran-offline-v1';
const PRESERVED_CACHES = [CACHE_NAME, QURAN_OFFLINE_CACHE];
// Long enough for a slow-but-working connection, short enough that a dead
// one falls back to cache before the user gives up.
const NAVIGATION_TIMEOUT_MS = 4000;
/* Pages are precached under their extensionless URLs. The host serves
   `/quran.html` as a 308 to `/quran`; caching the followed response under the
   `.html` key stored a *redirected* response, which browsers refuse to hand to
   a navigation request (redirect mode "manual") — so offline navigation to any
   `.html` link failed with a network error. All in-app links are extensionless
   now, and handleNavigationRequest maps either spelling onto these keys. */
const PAGE_PATHS = [
  '/',
  '/offline',
  '/quran',
  '/khatma',
  '/azkar',
  '/masbaha',
  '/settings',
  '/bookmarks',
  '/sunan',
  '/prayer-times',
  '/features',
  '/home-more',
  '/bio',
  '/references'
];
const APP_SHELL_URLS = [
  ...PAGE_PATHS,
  '/css/tokens.css',
  '/css/styles.css',
  '/css/components.css',
  '/css/app-ui.css',
  '/css/native.css',
  '/js/theme-preload.js',
  '/js/a11y.js',
  '/js/native-ui.js',
  '/css/page-styles/index.css',
  '/css/page-styles/home.css',
  '/css/page-styles/references.css',
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
  '/js/notify-store.js',
  '/js/notifications.js',
  '/js/offline-quran.js',
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
            await cache.put(request, await stripRedirect(response));
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

  // Layer 3 of reminder delivery: any time the worker is awake at all, flush
  // whatever fell due while it was not. Throttled so this does not touch
  // IndexedDB on every single request.
  if (Date.now() - lastFlushAt > FLUSH_THROTTLE_MS) {
    event.waitUntil(flushDueReminders().catch(() => { }));
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

  event.respondWith(staleWhileRevalidate(request, event));
});

/* Candidate cache keys for a navigation, most likely first. `/quran`,
   `/quran.html` and `/quran/` all resolve to the same precached page. */
function navigationFallbackPaths(pathname) {
  const clean = String(pathname || '/')
    .replace(/\/index\.html$/, '/')
    .replace(/\.html$/, '')
    .replace(/\/+$/, '') || '/';
  const withExt = clean === '/' ? '/index.html' : `${clean}.html`;
  return [clean, withExt];
}

function shouldCacheResponse(response) {
  return response && response.status === 200 && (response.type === 'basic' || response.type === 'cors');
}

/* A response that arrived via a redirect keeps `redirected: true` (and a
   multi-entry URL list) inside the Cache. Serving such an entry to a
   navigation request is rejected by the browser, so store a plain copy. */
async function stripRedirect(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

/* Query strings are significant for API calls: aladhan's timings URL carries
   latitude/longitude/method/school, so ignoring the search part returned
   yesterday's *other location or method* for a whole day. Only same-origin
   requests (where `?surah=2` style params never change the served file) match
   loosely. */
function matchOptionsFor(request) {
  const sameOrigin = new URL(request.url).origin === self.location.origin;
  return sameOrigin ? { ignoreSearch: true } : undefined;
}

async function updateCache(request, response) {
  if (!shouldCacheResponse(response)) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, await stripRedirect(response));
}

// For content that never changes. Cache hit = instant and offline-capable;
// only a miss touches the network.
async function cacheFirst(request) {
  // caches.match() with no cacheName searches every cache, so an explicitly
  // downloaded surah in QURAN_OFFLINE_CACHE is found here too.
  const cachedResponse = await caches.match(request, matchOptionsFor(request));
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
    const cachedResponse = await caches.match(request, matchOptionsFor(request));
    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response('Network unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function staleWhileRevalidate(request, event) {
  const cachedResponse = await caches.match(request, matchOptionsFor(request));

  const networkPromise = fetch(request)
    .then(async networkResponse => {
      await updateCache(request, networkResponse.clone());
      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    // Keep the worker alive until the background refresh lands; otherwise the
    // browser may kill it right after respondWith() and the cache never
    // updates.
    if (event) event.waitUntil(networkPromise);
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
    let cachedResponse = await caches.match(request, { ignoreSearch: true });
    if (!cachedResponse) {
      for (const path of navigationFallbackPaths(requestUrl.pathname)) {
        cachedResponse = await caches.match(path, { ignoreSearch: true });
        if (cachedResponse) break;
      }
    }

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
          .filter(cacheName => !PRESERVED_CACHES.includes(cacheName))
          .map(cacheName => caches.delete(cacheName))
      );

      await self.clients.claim();
      await flushDueReminders();
    })()
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data && event.data.type === 'FLUSH_REMINDERS') {
    event.waitUntil(flushDueReminders());
    return;
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        // Downloaded surahs are deliberate user content, not incidental
        // caching, so "clear cache" leaves them in place. They have their own
        // delete control in settings.
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== QURAN_OFFLINE_CACHE)
            .map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message });
      })
    );
  }
});

/* ==========================================================================
   Reminder delivery

   The worker holds no prayer-time logic — the page writes absolute timestamps
   into IndexedDB and this only decides what is due. See js/notifications.js
   for why delivery is layered.
   ========================================================================== */

// Anything overdue by more than this is stale: firing "حان وقت الفجر" at noon
// is worse than staying silent.
const REMINDER_STALE_MS = 30 * 60 * 1000;

// The fetch handler runs constantly; checking IndexedDB on every request would
// be wasteful, so opportunistic flushes are rate limited.
const FLUSH_THROTTLE_MS = 60 * 1000;
let lastFlushAt = 0;

async function flushDueReminders() {
  if (!self.NotifyStore) return;

  // No permission check here on purpose. `Notification.permission` is a Window
  // attribute — inside a ServiceWorkerGlobalScope it reads `undefined`, so
  // guarding on it disabled every flush permanently. showNotification() simply
  // rejects when permission is missing, which the per-item catch handles.

  lastFlushAt = Date.now();

  const settings = await self.NotifyStore.getSettings();
  if (!settings.enabled) return;

  const schedule = await self.NotifyStore.getSchedule();
  if (!schedule.length) return;

  const now = Date.now();
  const remaining = [];

  for (const item of schedule) {
    if (item.at > now) {
      remaining.push(item);
      continue;
    }

    // Due or overdue. Drop it from the schedule either way so it cannot fire
    // twice on the next wake-up.
    const overdueBy = now - item.at;
    if (overdueBy > REMINDER_STALE_MS) continue;

    try {
      await self.registration.showNotification(item.title, {
        body: item.body,
        tag: 'quran-reminder-' + item.id,
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/icon-192.png',
        data: { kind: item.kind, prayer: item.prayer || null }
      });
    } catch (_error) {
      // Could not show it; do not retry forever.
    }
  }

  await self.NotifyStore.setSchedule(remaining);
}

// Roughly twice a day where supported, so a closed app still gets flushed.
self.addEventListener('periodicsync', event => {
  if (event.tag === 'quran-reminders') {
    event.waitUntil(flushDueReminders());
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const kind = event.notification.data && event.notification.data.kind;
  const target = kind === 'prayer' || kind === 'iqama' ? '/prayer-times'
    : kind === 'khatma' ? '/khatma'
      : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Reuse an open window rather than stacking up new ones.
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
