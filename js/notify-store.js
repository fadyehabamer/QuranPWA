/* ==========================================================================
   Notification store — shared by the page and the service worker.

   localStorage is unavailable inside a service worker, so the reminder
   schedule lives in IndexedDB, which both scopes can reach. The page writes
   concrete timestamps; the worker only reads them and fires. Keeping all the
   prayer-time maths on the page side means the worker needs no location, no
   network and no knowledge of how a schedule is derived.

   Loaded as a classic script in the page, and via importScripts() in sw.js —
   hence `self` rather than `window`, and no module syntax.
   ========================================================================== */
(function (scope) {
  "use strict";

  var DB_NAME = 'quranNotify';
  var DB_VERSION = 1;
  var STORE = 'kv';

  function openDb() {
    return new Promise(function (resolve, reject) {
      var request = scope.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function withStore(mode, work) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var result;
        // Resolve on transaction completion, not on request success: in
        // readwrite mode the write is only durable once the tx commits.
        tx.oncomplete = function () { db.close(); resolve(result); };
        tx.onerror = function () { db.close(); reject(tx.error); };
        tx.onabort = function () { db.close(); reject(tx.error); };
        work(tx.objectStore(STORE), function (value) { result = value; });
      });
    });
  }

  function get(key, fallback) {
    return withStore('readonly', function (store, done) {
      var request = store.get(key);
      request.onsuccess = function () {
        done(request.result === undefined ? fallback : request.result);
      };
    }).catch(function () { return fallback; });
  }

  function set(key, value) {
    return withStore('readwrite', function (store) {
      store.put(value, key);
    }).catch(function () { /* storage blocked or full */ });
  }

  var DEFAULT_SETTINGS = {
    enabled: false,
    // Which of the five prayers to be reminded of.
    prayers: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
    // Minutes BEFORE the prayer time. 0 = at the adhan.
    offsetMinutes: 0,
    // A second reminder a few minutes after the adhan, to actually pray.
    iqamaReminder: false,
    khatma: false
  };

  function getSettings() {
    return get('settings', null).then(function (stored) {
      if (!stored) return Object.assign({}, DEFAULT_SETTINGS);
      // Merge so a setting added in a later version has a value.
      return Object.assign({}, DEFAULT_SETTINGS, stored, {
        prayers: Object.assign({}, DEFAULT_SETTINGS.prayers, stored.prayers || {})
      });
    });
  }

  function setSettings(settings) {
    return set('settings', settings);
  }

  function getSchedule() {
    return get('schedule', []).then(function (list) {
      return Array.isArray(list) ? list : [];
    });
  }

  function setSchedule(list) {
    return set('schedule', list || []);
  }

  scope.NotifyStore = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    get: get,
    set: set,
    getSettings: getSettings,
    setSettings: setSettings,
    getSchedule: getSchedule,
    setSchedule: setSchedule
  };
})(typeof self !== 'undefined' ? self : window);
