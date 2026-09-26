'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers');

/**
 * Just enough IndexedDB for notify-store.js: open with upgrade, one object
 * store, get/put requests whose success fires before the transaction
 * completes, and structured-cloned values like the real thing.
 */
function createIndexedDB() {
  const databases = new Map(); // name -> { version, stores: Map<name, Map> }
  const log = { opens: 0, upgrades: 0 };

  function makeDb(entry) {
    return {
      objectStoreNames: { contains: (name) => entry.stores.has(name) },
      createObjectStore: (name) => { entry.stores.set(name, new Map()); },
      transaction(storeName, mode) {
        const map = entry.stores.get(storeName);
        const tx = { error: null };
        tx.objectStore = () => ({
          get(key) {
            const request = {};
            queueMicrotask(() => {
              request.result = map.has(key) ? structuredClone(map.get(key)) : undefined;
              if (request.onsuccess) request.onsuccess();
            });
            return request;
          },
          put(value, key) {
            if (mode !== 'readwrite') throw new Error('ReadOnlyError');
            map.set(key, structuredClone(value));
            return {};
          }
        });
        setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0);
        return tx;
      },
      close() {}
    };
  }

  return {
    log,
    raw: (dbName, storeName) => databases.get(dbName).stores.get(storeName),
    open(name, version) {
      log.opens += 1;
      const request = {};
      queueMicrotask(() => {
        let entry = databases.get(name);
        const needsUpgrade = !entry || entry.version < version;
        if (!entry) {
          entry = { version, stores: new Map() };
          databases.set(name, entry);
        }
        request.result = makeDb(entry);
        if (needsUpgrade) {
          entry.version = version;
          log.upgrades += 1;
          if (request.onupgradeneeded) request.onupgradeneeded();
        }
        if (request.onsuccess) request.onsuccess();
      });
      return request;
    }
  };
}

function brokenIndexedDB() {
  return {
    open() {
      const request = { error: new Error('InvalidStateError') };
      queueMicrotask(() => request.onerror && request.onerror());
      return request;
    }
  };
}

function loadStore(indexedDB) {
  const self = { indexedDB };
  loadScript('js/notify-store.js', { self });
  return self.NotifyStore;
}

test('getSettings returns a copy of the defaults when nothing is stored', async () => {
  const store = loadStore(createIndexedDB());
  const settings = await store.getSettings();
  assert.deepEqual(settings, {
    enabled: false,
    prayers: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
    offsetMinutes: 0,
    iqamaReminder: false,
    khatma: false
  });
  settings.enabled = true;
  assert.equal(store.DEFAULT_SETTINGS.enabled, false);
});

test('getSettings merges stored values over defaults, including per-prayer flags', async () => {
  const store = loadStore(createIndexedDB());
  // A settings object saved by an older version: no khatma key, partial prayers.
  await store.setSettings({ enabled: true, offsetMinutes: 10, prayers: { Fajr: false } });

  const settings = await store.getSettings();
  assert.equal(settings.enabled, true);
  assert.equal(settings.offsetMinutes, 10);
  assert.equal(settings.khatma, false);
  assert.deepEqual(settings.prayers, { Fajr: false, Dhuhr: true, Asr: true, Maghrib: true, Isha: true });
  assert.equal(store.DEFAULT_SETTINGS.prayers.Fajr, true);
});

test('get/set round-trip values and return the fallback for missing keys', async () => {
  const idb = createIndexedDB();
  const store = loadStore(idb);
  assert.equal(await store.get('lastRefresh', 'none'), 'none');

  await store.set('lastRefresh', { at: 123, key: 'abc' });
  assert.deepEqual(await store.get('lastRefresh', null), { at: 123, key: 'abc' });
  assert.deepEqual(idb.raw('quranNotify', 'kv').get('lastRefresh'), { at: 123, key: 'abc' });

  // The object store is created on first open only.
  assert.equal(idb.log.upgrades, 1);
  assert.ok(idb.log.opens >= 3);
});

test('getSchedule only ever yields an array', async () => {
  const store = loadStore(createIndexedDB());
  assert.deepEqual(await store.getSchedule(), []);

  await store.set('schedule', { not: 'a list' });
  assert.deepEqual(await store.getSchedule(), []);

  const items = [{ id: 'prayer-Fajr-2026-8-26', at: 1 }];
  await store.setSchedule(items);
  assert.deepEqual(await store.getSchedule(), items);

  await store.setSchedule(null);
  assert.deepEqual(await store.getSchedule(), []);
});

test('a failing IndexedDB degrades to fallbacks instead of rejecting', async () => {
  const store = loadStore(brokenIndexedDB());
  assert.equal(await store.get('anything', 42), 42);
  assert.equal(await store.set('anything', 1), undefined);
  assert.equal((await store.getSettings()).enabled, false);
  assert.deepEqual(await store.getSchedule(), []);
});

test('attaches to window when loaded as a page script without self', () => {
  const window = { indexedDB: createIndexedDB() };
  loadScript('js/notify-store.js', { self: undefined, window });
  assert.equal(typeof window.NotifyStore.getSettings, 'function');
});
