'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript, createStorage, createCaches } = require('./helpers');

const CACHE_NAME = 'quran-offline-v1';
const surahUrl = (n) => `https://api.alquran.cloud/v1/surah/${n}/quran-uthmani`;

function surahResponse(length) {
  const headers = length ? { 'content-length': String(length) } : {};
  return new Response('{"code":200}', { status: 200, headers });
}

function setup({ storage = createStorage(), fetchImpl, withIndex = true } = {}) {
  const window = {};
  loadScript('js/data/surahs.js', { window });
  if (withIndex) loadScript('js/data/quran-index.js', { window });
  const caches = createCaches();
  const fetchCalls = [];
  const fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return fetchImpl ? fetchImpl(url) : surahResponse(100);
  };
  loadScript('js/offline-quran.js', { window, localStorage: storage, caches, fetch });
  return { api: window.OfflineQuran, caches, storage, fetchCalls };
}

async function seed(caches, surahs) {
  const cache = await caches.open(CACHE_NAME);
  for (const n of surahs) await cache.put(surahUrl(n), surahResponse(100));
}

test('surahsForJuz lists every surah a juz touches', () => {
  const { api } = setup();
  assert.deepEqual(api.surahsForJuz(1), [1, 2]);
  assert.deepEqual(api.surahsForJuz(2), [2]);
  assert.deepEqual(api.surahsForJuz(3), [2, 3]);
  const last = api.surahsForJuz(30);
  assert.equal(last[0], 78);
  assert.equal(last[last.length - 1], 114);
  assert.equal(last.length, 37);
  assert.deepEqual(api.surahsForJuz(0), []);
  assert.deepEqual(api.surahsForJuz(31), []);
});

test('surahsForJuz is empty when the index script is not loaded', () => {
  const { api } = setup({ withIndex: false });
  assert.deepEqual(api.surahsForJuz(1), []);
});

test('getSelection drops out-of-range entries and survives corrupt storage', () => {
  assert.deepEqual(setup({ storage: createStorage({ offlineJuzV1: '[0, 1, 30, 31, 5]' }) }).api.getSelection(), [1, 30, 5]);
  assert.deepEqual(setup({ storage: createStorage({ offlineJuzV1: '{nope' }) }).api.getSelection(), []);
  assert.deepEqual(setup({ storage: createStorage({ offlineJuzV1: '{"a":1}' }) }).api.getSelection(), []);
});

test('downloadJuz fetches only missing surahs, reports progress and records the selection', async () => {
  const { api, caches, storage, fetchCalls } = setup();
  await seed(caches, [2]);

  const progress = [];
  const result = await api.downloadJuz(3, (done, total) => progress.push([done, total]));

  assert.deepEqual(result, { ok: true, done: 2, total: 2 });
  assert.deepEqual(progress, [[1, 2], [2, 2]]);
  assert.deepEqual(fetchCalls.map((c) => c.url), [surahUrl(3)]);
  assert.deepEqual(fetchCalls[0].init, { cache: 'no-store' });
  assert.deepEqual(caches.urls(CACHE_NAME).sort(), [surahUrl(2), surahUrl(3)].sort());
  assert.equal(storage.getItem('offlineJuzV1'), '[3]');
});

test('downloadJuz stops on a non-OK response without caching it or selecting the juz', async () => {
  const { api, caches, storage } = setup({
    fetchImpl: (url) => (url === surahUrl(2)
      ? new Response('{"code":503,"status":"OFFLINE"}', { status: 503 })
      : surahResponse(100))
  });

  const result = await api.downloadJuz(1);
  assert.deepEqual(result, { ok: false, reason: 'network', done: 1, total: 2 });
  assert.deepEqual(caches.urls(CACHE_NAME), [surahUrl(1)]);
  assert.equal(storage.getItem('offlineJuzV1'), null);

  const status = await api.juzStatus(1);
  assert.deepEqual(status, { done: 1, total: 2, complete: false, selected: false });
});

test('downloadJuz rejects an unknown juz', async () => {
  const { api, fetchCalls } = setup();
  assert.deepEqual(await api.downloadJuz(99), { ok: false, reason: 'unknown-juz' });
  assert.equal(fetchCalls.length, 0);
});

test('allStatus distinguishes a selected juz from one that is only incidentally cached', async () => {
  const { api } = setup();
  await api.downloadJuz(1);

  const all = await api.allStatus();
  assert.equal(all.length, 30);
  assert.deepEqual(all[0], { done: 2, total: 2, complete: true, selected: true });
  // Juz 2 is entirely inside surah 2, which juz 1 pulled in — but it was
  // never chosen, so it must not claim to be downloaded.
  assert.deepEqual(all[1], { done: 1, total: 1, complete: false, selected: false });
});

test('removeJuz keeps surahs another selected juz still needs', async () => {
  const { api, caches, storage } = setup();
  await api.downloadJuz(1);
  await api.downloadJuz(2);
  assert.equal(storage.getItem('offlineJuzV1'), '[1,2]');

  await api.removeJuz(1);
  assert.deepEqual(api.getSelection(), [2]);
  assert.deepEqual(caches.urls(CACHE_NAME), [surahUrl(2)]);
  assert.equal((await api.juzStatus(2)).complete, true);

  await api.removeJuz(2);
  assert.deepEqual(api.getSelection(), []);
  assert.deepEqual(caches.urls(CACHE_NAME), []);
});

test('removeAll clears the selection and drops the whole cache', async () => {
  const { api, caches } = setup();
  await api.downloadJuz(1);
  await api.removeAll();
  assert.deepEqual(api.getSelection(), []);
  assert.deepEqual(await caches.keys(), []);
});

test('usage sums Content-Length and estimates entries without it', async () => {
  const { api, caches } = setup();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(surahUrl(2), surahResponse(1000));
  await cache.put(surahUrl(1), surahResponse(0)); // no header: 7 ayahs * 340
  assert.deepEqual(await api.usage(), { surahs: 2, bytes: 1000 + 7 * 340 });
});

test('downloadAll stops at the first juz that fails', async () => {
  const { api } = setup({
    fetchImpl: (url) => (url === surahUrl(3) ? new Response('', { status: 500 }) : surahResponse(100))
  });
  const seen = [];
  const result = await api.downloadAll((juz, r) => seen.push([juz, r.ok]));
  assert.deepEqual(result, { ok: false, stoppedAt: 3 });
  assert.deepEqual(seen, [[1, true], [2, true], [3, false]]);
  assert.deepEqual(api.getSelection(), [1, 2]);
});
