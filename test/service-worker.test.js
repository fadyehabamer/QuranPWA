'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadScript, createCaches, frozenDate } = require('./helpers');

const ORIGIN = 'https://app.test';
const NOW = '2026-09-26T12:00:00Z';

/** A network response the worker is allowed to cache (Node's own Response
 *  reports type "default", which a browser never does). */
function netResponse(body, { status = 200, type = 'basic' } = {}) {
  return {
    body,
    status,
    type,
    redirected: false,
    clone() { return this; }
  };
}

function setup({ fetchImpl, notifyStore } = {}) {
  const listeners = {};
  const imported = [];
  const fetchCalls = [];
  const shown = [];
  const clientsLog = { claimed: 0, opened: [], navigated: [], focused: 0 };
  let windowClients = [];

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => { self.skipped = true; },
    NotifyStore: notifyStore,
    registration: {
      showNotification: async (title, options) => { shown.push({ title, options }); }
    },
    clients: {
      claim: async () => { clientsLog.claimed += 1; },
      matchAll: async () => windowClients,
      openWindow: async (url) => { clientsLog.opened.push(url); }
    }
  };

  const caches = createCaches(ORIGIN);
  const fetch = async (request) => {
    fetchCalls.push(typeof request === 'string' ? request : request.url);
    if (!fetchImpl) throw new TypeError('Failed to fetch');
    return fetchImpl(request);
  };

  const exposed = loadScript('js/sw.js', {
    self,
    importScripts: (...urls) => imported.push(...urls),
    caches,
    fetch,
    Date: frozenDate(NOW)
  }, ['CACHE_NAME', 'APP_SHELL_URLS', 'PAGE_PATHS', 'navigationFallbackPaths', 'shouldCacheResponse']);

  function dispatch(type, init = {}) {
    const waits = [];
    let responded;
    const event = {
      ...init,
      waitUntil: (p) => { waits.push(p); },
      respondWith: (p) => { responded = p; }
    };
    listeners[type](event);
    return {
      responded: () => responded,
      settled: () => Promise.all(waits)
    };
  }

  function fetchEvent(url, { method = 'GET', mode = 'cors' } = {}) {
    return dispatch('fetch', { request: { url, method, mode } });
  }

  return {
    self,
    exposed,
    listeners,
    imported,
    caches,
    fetchCalls,
    shown,
    clientsLog,
    setWindowClients: (list) => { windowClients = list; },
    dispatch,
    fetchEvent
  };
}

async function jsonOf(response) {
  return JSON.parse(await response.text());
}

test('loads the notification store and registers every lifecycle handler', () => {
  const sw = setup();
  assert.deepEqual(sw.imported, ['/js/notify-store.js']);
  for (const type of ['install', 'activate', 'fetch', 'message', 'periodicsync', 'notificationclick']) {
    assert.equal(typeof sw.listeners[type], 'function', type);
  }
});

test('navigationFallbackPaths maps every spelling of a page onto its cache keys', () => {
  const { navigationFallbackPaths } = setup().exposed;
  assert.deepEqual(navigationFallbackPaths('/quran'), ['/quran', '/quran.html']);
  assert.deepEqual(navigationFallbackPaths('/quran.html'), ['/quran', '/quran.html']);
  assert.deepEqual(navigationFallbackPaths('/quran/'), ['/quran', '/quran.html']);
  assert.deepEqual(navigationFallbackPaths('/'), ['/', '/index.html']);
  assert.deepEqual(navigationFallbackPaths('/index.html'), ['/', '/index.html']);
  assert.deepEqual(navigationFallbackPaths(''), ['/', '/index.html']);
});

test('shouldCacheResponse only accepts full same-origin or CORS 200s', () => {
  const { shouldCacheResponse } = setup().exposed;
  assert.equal(shouldCacheResponse({ status: 200, type: 'basic' }), true);
  assert.equal(shouldCacheResponse({ status: 200, type: 'cors' }), true);
  assert.equal(shouldCacheResponse({ status: 200, type: 'opaque' }), false);
  assert.equal(shouldCacheResponse({ status: 404, type: 'basic' }), false);
  assert.equal(shouldCacheResponse({ status: 206, type: 'basic' }), false);
  assert.ok(!shouldCacheResponse(null));
});

test('every precached URL exists in the repository', () => {
  const { APP_SHELL_URLS, PAGE_PATHS } = setup().exposed;
  const missing = APP_SHELL_URLS.filter((url) => {
    const candidates = PAGE_PATHS.includes(url)
      ? [url === '/' ? 'index.html' : `${url.slice(1)}.html`]
      : [url.slice(1)];
    return !candidates.some((file) => fs.existsSync(path.join(ROOT, file)));
  });
  assert.deepEqual(missing, []);
  assert.equal(new Set(APP_SHELL_URLS).size, APP_SHELL_URLS.length, 'no duplicate precache entries');
});

test('fetch handler ignores requests it must not touch', () => {
  const sw = setup();
  const ignored = [
    [`${ORIGIN}/api`, { method: 'POST' }],
    ['chrome-extension://abc/script.js', {}],
    [`${ORIGIN}/sw.js`, {}],
    [`${ORIGIN}/js/sw.js`, {}],
    ['https://server.mp3quran.net/afs/001.mp3', {}],
    ['https://example.com/live/stream', {}]
  ];
  for (const [url, init] of ignored) {
    assert.equal(sw.fetchEvent(url, init).responded(), undefined, url);
  }
});

test('Quran text is served cache-first, including explicitly downloaded surahs', async () => {
  const sw = setup({ fetchImpl: () => netResponse('network') });
  const url = 'https://api.alquran.cloud/v1/surah/2/quran-uthmani';
  const offline = await sw.caches.open('quran-offline-v1');
  await offline.put(url, netResponse('cached'));

  const response = await sw.fetchEvent(url).responded();
  assert.equal(response.body, 'cached');
  assert.deepEqual(sw.fetchCalls, []);
});

test('an uncached Quran text request offline returns the API-shaped 503 envelope', async () => {
  const sw = setup();
  const response = await sw.fetchEvent('https://api.alquran.cloud/v1/surah/2/quran-uthmani').responded();
  assert.equal(response.status, 503);
  assert.deepEqual(await jsonOf(response), { code: 503, status: 'OFFLINE', data: null });
});

test('Quran text fetched from the network is cached for next time', async () => {
  const sw = setup({ fetchImpl: () => netResponse('fresh', { type: 'cors' }) });
  const url = 'https://api.alquran.cloud/v1/juz/30/quran-uthmani';
  const response = await sw.fetchEvent(url).responded();
  assert.equal(response.body, 'fresh');
  assert.deepEqual(sw.caches.urls(sw.exposed.CACHE_NAME), [url]);
});

test('Quran search stays network-first and falls back to cache only when offline', async () => {
  const url = 'https://api.alquran.cloud/v1/search/رحمة/all/ar';

  const online = setup({ fetchImpl: () => netResponse('live', { type: 'cors' }) });
  const shell = await online.caches.open(online.exposed.CACHE_NAME);
  await shell.put(url, netResponse('stale'));
  assert.equal((await online.fetchEvent(url).responded()).body, 'live');

  const offline = setup();
  const cache = await offline.caches.open(offline.exposed.CACHE_NAME);
  await cache.put(url, netResponse('stale'));
  assert.equal((await offline.fetchEvent(url).responded()).body, 'stale');

  const nothing = setup();
  const response = await nothing.fetchEvent(url).responded();
  assert.equal(response.status, 503);
  assert.equal(await response.text(), 'Network unavailable');
});

test('cross-origin API cache lookups keep the query string significant', async () => {
  // Aladhan timings for another location must not be served from cache.
  const sw = setup();
  const cache = await sw.caches.open(sw.exposed.CACHE_NAME);
  await cache.put('https://api.aladhan.com/v1/timings/26-09-2026?latitude=1', netResponse('other place'));
  const response = await sw.fetchEvent('https://api.aladhan.com/v1/timings/26-09-2026?latitude=2').responded();
  assert.equal(response.status, 503);
});

test('static assets are stale-while-revalidate', async () => {
  const sw = setup({ fetchImpl: () => netResponse('v2') });
  const url = `${ORIGIN}/css/styles.css`;
  const cache = await sw.caches.open(sw.exposed.CACHE_NAME);
  await cache.put(url, netResponse('v1'));

  const event = sw.fetchEvent(url);
  assert.equal((await event.responded()).body, 'v1');
  await event.settled();
  assert.equal((await cache.match(url)).body, 'v2');
});

test('an uncached asset offline yields an empty 503, not the word "Offline"', async () => {
  const sw = setup();
  const response = await sw.fetchEvent(`${ORIGIN}/css/missing.css`).responded();
  assert.equal(response.status, 503);
  assert.equal(await response.text(), '');
});

test('offline navigation serves the precached page for any spelling of its URL', async () => {
  const sw = setup();
  const cache = await sw.caches.open(sw.exposed.CACHE_NAME);
  await cache.put('/quran', netResponse('quran page'));

  for (const url of [`${ORIGIN}/quran`, `${ORIGIN}/quran.html`, `${ORIGIN}/quran/?surah=2`]) {
    const response = await sw.fetchEvent(url, { mode: 'navigate' }).responded();
    assert.equal(response.body, 'quran page', url);
  }
});

test('offline navigation to an uncached page falls back to the offline page, then inline HTML', async () => {
  const withOfflinePage = setup();
  const cache = await withOfflinePage.caches.open(withOfflinePage.exposed.CACHE_NAME);
  await cache.put('/offline', netResponse('offline page'));
  const first = await withOfflinePage.fetchEvent(`${ORIGIN}/khatma`, { mode: 'navigate' }).responded();
  assert.equal(first.body, 'offline page');

  const bare = setup();
  const second = await bare.fetchEvent(`${ORIGIN}/khatma`, { mode: 'navigate' }).responded();
  assert.equal(second.status, 503);
  assert.match(second.headers.get('content-type'), /text\/html/);
  assert.match(await second.text(), /لا يوجد اتصال بالإنترنت/);
});

test('online navigation returns the network page and refreshes the cache', async () => {
  const sw = setup({ fetchImpl: () => netResponse('fresh home') });
  const response = await sw.fetchEvent(`${ORIGIN}/`, { mode: 'navigate' }).responded();
  assert.equal(response.body, 'fresh home');
  assert.deepEqual(sw.caches.urls(sw.exposed.CACHE_NAME), [`${ORIGIN}/`]);
});

test('activate deletes old caches but preserves the shell and downloaded surahs', async () => {
  const sw = setup();
  for (const name of ['quran-app-v1', 'quran-app-v25', sw.exposed.CACHE_NAME, 'quran-offline-v1']) {
    await sw.caches.open(name);
  }
  await sw.dispatch('activate').settled();
  assert.deepEqual((await sw.caches.keys()).sort(), [sw.exposed.CACHE_NAME, 'quran-offline-v1'].sort());
  assert.equal(sw.clientsLog.claimed, 1);
});

test('CLEAR_CACHE clears everything except downloaded surahs and reports back', async () => {
  const sw = setup();
  for (const name of [sw.exposed.CACHE_NAME, 'quran-offline-v1', 'misc']) await sw.caches.open(name);
  const replies = [];
  await sw.dispatch('message', {
    data: { type: 'CLEAR_CACHE' },
    ports: [{ postMessage: (msg) => replies.push(msg) }]
  }).settled();
  assert.deepEqual(await sw.caches.keys(), ['quran-offline-v1']);
  assert.deepEqual(replies, [{ success: true }]);
});

test('SKIP_WAITING activates the new worker', () => {
  const sw = setup();
  assert.equal(sw.self.skipped, undefined);
  sw.dispatch('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(sw.self.skipped, true);
});

function notifyStore(settings, schedule) {
  const state = { schedule };
  return {
    state,
    getSettings: async () => settings,
    getSchedule: async () => state.schedule,
    setSchedule: async (list) => { state.schedule = list; }
  };
}

test('FLUSH_REMINDERS fires due reminders, drops stale ones and keeps future ones', async () => {
  const now = Date.parse(NOW);
  const due = { id: 'due', at: now - 5 * 60000, title: 'حان وقت العصر', body: 'b', kind: 'prayer', prayer: 'Asr' };
  const stale = { id: 'stale', at: now - 2 * 3600000, title: 'old', body: 'b', kind: 'prayer' };
  const future = { id: 'future', at: now + 3600000, title: 'later', body: 'b', kind: 'khatma' };
  const store = notifyStore({ enabled: true }, [due, stale, future]);
  const sw = setup({ notifyStore: store });

  await sw.dispatch('message', { data: { type: 'FLUSH_REMINDERS' } }).settled();

  assert.deepEqual(sw.shown.map((n) => n.title), ['حان وقت العصر']);
  assert.equal(sw.shown[0].options.tag, 'quran-reminder-due');
  assert.deepEqual(sw.shown[0].options.data, { kind: 'prayer', prayer: 'Asr' });
  assert.deepEqual(store.state.schedule, [future]);
});

test('FLUSH_REMINDERS does nothing while reminders are disabled', async () => {
  const now = Date.parse(NOW);
  const store = notifyStore({ enabled: false }, [{ id: 'due', at: now - 1000 }]);
  const sw = setup({ notifyStore: store });
  await sw.dispatch('message', { data: { type: 'FLUSH_REMINDERS' } }).settled();
  assert.deepEqual(sw.shown, []);
  assert.equal(store.state.schedule.length, 1);
});

test('notification clicks route to the relevant page', async () => {
  const click = async (sw, kind) => {
    let closed = false;
    await sw.dispatch('notificationclick', {
      notification: { data: kind ? { kind } : null, close: () => { closed = true; } }
    }).settled();
    return closed;
  };

  const fresh = setup();
  assert.equal(await click(fresh, 'khatma'), true);
  await click(fresh, 'iqama');
  await click(fresh, null);
  assert.deepEqual(fresh.clientsLog.opened, ['/khatma', '/prayer-times', '/']);

  const withWindow = setup();
  const navigated = [];
  let focused = 0;
  withWindow.setWindowClients([{
    navigate: (url) => navigated.push(url),
    focus: async () => { focused += 1; }
  }]);
  await click(withWindow, 'prayer');
  assert.deepEqual(navigated, ['/prayer-times']);
  assert.equal(focused, 1);
  assert.deepEqual(withWindow.clientsLog.opened, []);
});
