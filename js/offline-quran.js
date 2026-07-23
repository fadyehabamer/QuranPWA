/* ==========================================================================
   Offline Quran download.

   The service worker already serves `/v1/surah/…` cache-first, but only for
   surahs that happened to be opened before — so "works offline" was really
   "works offline for whatever you already read". This downloads chosen juz
   deliberately, into a cache the worker's cleanup and the "clear cache"
   button both leave alone.

   Granularity is the juz rather than the whole mushaf: 30 items is a real
   choice, 114 is a chore, and one button for ~4MB is not a choice at all.
   ========================================================================== */
(function () {
  "use strict";

  var CACHE_NAME = 'quran-offline-v1';
  var EDITION = 'quran-uthmani';

  function surahUrl(surahNumber) {
    return 'https://api.alquran.cloud/v1/surah/' + surahNumber + '/' + EDITION;
  }

  /**
   * Which surahs a juz touches.
   *
   * A juz is a range of ayahs, not of surahs, and it routinely starts and ends
   * mid-surah — so juz 1 needs all of الفاتحة AND the first part of البقرة,
   * and reading it offline means having both surahs whole.
   */
  function surahsForJuz(juzNumber) {
    var index = window.QURAN_INDEX;
    if (!index) return [];

    var starts = index.JUZ_STARTS;
    var first = starts[juzNumber - 1];
    if (!first) return [];

    var next = starts[juzNumber];
    var lastSurah = next ? next[0] : 114;

    var out = [];
    for (var surah = first[0]; surah <= lastSurah; surah += 1) out.push(surah);
    return out;
  }

  function openCache() {
    return caches.open(CACHE_NAME);
  }

  async function isSurahCached(cache, surahNumber) {
    var match = await cache.match(surahUrl(surahNumber), { ignoreSearch: true });
    return Boolean(match);
  }

  /**
   * Every cached surah number, in ONE pass over the cache index.
   *
   * Rendering the grid used to call cache.match() once per surah per juz — 143
   * awaited lookups — which is what made a single tap freeze for seconds and
   * leave the chip stuck at 100%. cache.keys() is a single call, and matching
   * the surah number out of the URL is just a regex.
   */
  async function cachedSurahSet() {
    var cache = await openCache();
    var keys = await cache.keys();
    var set = new Set();

    keys.forEach(function (request) {
      var match = /\/v1\/surah\/(\d+)\//.exec(request.url);
      if (match) set.add(Number(match[1]));
    });

    return set;
  }

  /* --------------------------------------------------------------------------
     Which juz the reader ASKED for, stored separately from what is in the cache.

     Deriving "is this juz downloaded?" purely from cache contents was circular
     and produced a genuinely confusing bug. Juz boundaries fall mid-surah, so
     neighbours share surahs: juz 1 is [1,2] and juz 2 is [2]. Removing juz 1
     could not delete surah 2 (juz 2 needs it), yet removing juz 2 also deleted
     nothing (juz 1 needs it) — and once any shared surah did get deleted, an
     untouched neighbour silently flipped back to "not downloaded" and the next
     tap re-downloaded it.

     Intent is now the source of truth: a chip is on because you turned it on.
     The cache is just the union of surahs the selected juz need.
     -------------------------------------------------------------------------- */
  var SELECTION_KEY = 'offlineJuzV1';

  function getSelection() {
    try {
      var raw = JSON.parse(localStorage.getItem(SELECTION_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(function (n) { return n >= 1 && n <= 30; }) : [];
    } catch (_error) {
      return [];
    }
  }

  function setSelection(list) {
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(Array.from(new Set(list)).sort(function (a, b) { return a - b; })));
    } catch (_error) { /* storage blocked */ }
  }

  function isSelected(juzNumber) {
    return getSelection().indexOf(juzNumber) !== -1;
  }

  /**
   * A juz is "downloaded" when it was selected AND every surah it spans is
   * present. `done`/`total` drive the progress label while a download runs or
   * after one was interrupted.
   */
  function statusFrom(juzNumber, cached, selection) {
    var surahs = surahsForJuz(juzNumber);
    if (!surahs.length) return { done: 0, total: 0, complete: false, selected: false };

    var selected = selection.indexOf(juzNumber) !== -1;
    var done = surahs.filter(function (n) { return cached.has(n); }).length;

    return {
      done: done,
      total: surahs.length,
      complete: selected && done === surahs.length,
      selected: selected
    };
  }

  async function juzStatus(juzNumber) {
    return statusFrom(juzNumber, await cachedSurahSet(), getSelection());
  }

  // One cache scan for all thirty, instead of thirty scans.
  async function allStatus() {
    var cached = await cachedSurahSet();
    var selection = getSelection();

    var out = [];
    for (var juz = 1; juz <= 30; juz += 1) out.push(statusFrom(juz, cached, selection));
    return out;
  }

  /**
   * Download one juz. `onProgress(done, total)` fires after each surah.
   * Surahs already present are skipped, so overlapping juz are nearly free
   * and a failed download resumes rather than restarting.
   */
  async function downloadJuz(juzNumber, onProgress) {
    var surahs = surahsForJuz(juzNumber);
    if (!surahs.length) return { ok: false, reason: 'unknown-juz' };

    var cache = await openCache();
    var done = 0;

    for (var i = 0; i < surahs.length; i += 1) {
      var url = surahUrl(surahs[i]);

      if (await isSurahCached(cache, surahs[i])) {
        done += 1;
        if (onProgress) onProgress(done, surahs.length);
        continue;
      }

      try {
        var response = await fetch(url, { cache: 'no-store' });
        // Only a real 200 is worth storing — the worker hands back a 503
        // OFFLINE envelope when there is no connection, and caching that
        // would poison the download.
        if (!response.ok) throw new Error('HTTP ' + response.status);
        await cache.put(url, response.clone());
        done += 1;
      } catch (_error) {
        if (onProgress) onProgress(done, surahs.length);
        return { ok: false, reason: 'network', done: done, total: surahs.length };
      }

      if (onProgress) onProgress(done, surahs.length);
    }

    // Only mark it chosen once every surah actually landed, so an interrupted
    // download shows as partial rather than as done.
    setSelection(getSelection().concat([juzNumber]));

    return { ok: true, done: done, total: surahs.length };
  }

  /**
   * Deselect a juz, then delete only the surahs no other SELECTED juz needs.
   * Keying on selection rather than on cache contents is what stops removing
   * one juz from quietly gutting its neighbour.
   */
  async function removeJuz(juzNumber) {
    var remaining = getSelection().filter(function (n) { return n !== juzNumber; });
    setSelection(remaining);

    var keep = new Set();
    remaining.forEach(function (juz) {
      surahsForJuz(juz).forEach(function (n) { keep.add(n); });
    });

    var cache = await openCache();
    var mine = surahsForJuz(juzNumber);

    for (var i = 0; i < mine.length; i += 1) {
      if (keep.has(mine[i])) continue;
      await cache.delete(surahUrl(mine[i]), { ignoreSearch: true });
    }
  }

  async function removeAll() {
    setSelection([]);
    await caches.delete(CACHE_NAME);
  }

  /**
   * Approximate footprint.
   *
   * This used to read every cached body with arrayBuffer() to weigh it — with
   * the whole mushaf downloaded that is several megabytes decoded on the main
   * thread every time the grid repainted, which is what made the settings page
   * hang. Content-Length is already on the cached response, so no body is
   * touched; entries without the header fall back to a per-ayah estimate.
   */
  async function usage() {
    var cache = await openCache();
    var keys = await cache.keys();
    var bytes = 0;

    var responses = await Promise.all(keys.map(function (request) {
      return cache.match(request).catch(function () { return null; });
    }));

    responses.forEach(function (response, index) {
      if (!response) return;
      var length = parseInt(response.headers.get('content-length'), 10);
      if (Number.isInteger(length) && length > 0) {
        bytes += length;
        return;
      }
      // Rough mean surah payload, used only when the header is absent.
      bytes += estimateSurahBytes(keys[index].url);
    });

    return { surahs: keys.length, bytes: bytes };
  }

  function estimateSurahBytes(url) {
    var match = /\/v1\/surah\/(\d+)\//.exec(url);
    var surah = match ? Number(match[1]) : 0;
    var info = window.QURAN_SURAHS && window.QURAN_SURAHS[surah - 1];
    // ~340 bytes of JSON per ayah in the Uthmani edition.
    return info ? info.verses * 340 : 12000;
  }

  async function downloadAll(onJuzProgress) {
    for (var juz = 1; juz <= 30; juz += 1) {
      var result = await downloadJuz(juz);
      if (onJuzProgress) onJuzProgress(juz, result);
      if (!result.ok) return { ok: false, stoppedAt: juz };
    }
    return { ok: true };
  }

  window.OfflineQuran = {
    CACHE_NAME: CACHE_NAME,
    surahsForJuz: surahsForJuz,
    getSelection: getSelection,
    juzStatus: juzStatus,
    allStatus: allStatus,
    downloadJuz: downloadJuz,
    downloadAll: downloadAll,
    removeJuz: removeJuz,
    removeAll: removeAll,
    usage: usage
  };
})();
