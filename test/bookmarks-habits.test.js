'use strict';

process.env.TZ = 'UTC';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, runSource, createStorage, frozenDate } = require('./helpers');

// common.js is a large page script whose top level wires up the DOM. The
// bookmark and habit helpers form a self-contained block inside it that only
// needs localStorage and the clock, so that block is run on its own.
const COMMON = readSource('js/common.js');
const START = '// Shared Storage Helpers';
const END = '// ===== New Landing Page Features =====';

function loadHelpers({ storage = createStorage(), now = '2026-09-26T10:00:00Z' } = {}) {
  const start = COMMON.indexOf(START);
  const end = COMMON.indexOf(END);
  assert.ok(start !== -1 && end > start, 'storage helper markers present in js/common.js');
  const window = {};
  runSource(COMMON.slice(start, end), { window, localStorage: storage, Date: frozenDate(now) });
  return { api: window, storage };
}

const NOW = Date.parse('2026-09-26T10:00:00Z');
const stored = (storage, key) => JSON.parse(storage.getItem(key));

test('loadBookmarkLibrary normalises legacy entries and writes them back', () => {
  const storage = createStorage({
    quranBookmarks: JSON.stringify([
      { surah: '2', page: '3', timestamp: 1000 },
      { surah: 200, page: -5, timestamp: 2000, folder: '  حفظ ', tags: 'a, b,a,, c', note: ' n ' },
      { surah: 0, page: 'x', createdAt: 3000, id: 'keep-me' }
    ])
  });
  const { api } = loadHelpers({ storage });
  const [first, second, third] = api.loadBookmarkLibrary();

  assert.deepEqual(first, {
    id: 'bm_2_3_1000_0',
    surah: 2,
    page: 3,
    timestamp: 1000,
    createdAt: 1000,
    folder: 'عام',
    tags: [],
    note: '',
    lastVisited: 0,
    visitCount: 0
  });
  assert.equal(second.surah, 114);
  assert.equal(second.page, 0);
  assert.equal(second.folder, 'حفظ');
  assert.deepEqual(second.tags, ['a', 'b', 'c']);
  assert.equal(second.note, 'n');
  assert.equal(third.id, 'keep-me');
  assert.equal(third.surah, 1);
  assert.equal(third.timestamp, 3000);

  assert.deepEqual(stored(storage, 'quranBookmarks')[0], first);
  assert.deepEqual(stored(storage, 'quranBookmarkFoldersV1'), ['عام', 'حفظ']);
});

test('loadBookmarkLibrary drops duplicate ids and survives corrupt storage', () => {
  const dupes = createStorage({
    quranBookmarks: JSON.stringify([{ id: 'x', surah: 1 }, { id: 'x', surah: 2 }])
  });
  const lib = loadHelpers({ storage: dupes }).api.loadBookmarkLibrary();
  assert.equal(lib.length, 1);
  assert.equal(lib[0].surah, 1);

  assert.deepEqual(loadHelpers({ storage: createStorage({ quranBookmarks: '{oops' }) }).api.loadBookmarkLibrary(), []);
  assert.deepEqual(loadHelpers({ storage: createStorage({ quranBookmarks: '{"a":1}' }) }).api.loadBookmarkLibrary(), []);
});

test('reading an already-normalised library does not rewrite storage', () => {
  const { api, storage } = loadHelpers();
  api.saveBookmarkLibrary([{ id: 'a', surah: 1, page: 0, timestamp: 1 }]);

  let writes = 0;
  const setItem = storage.setItem;
  storage.setItem = (...args) => { writes += 1; setItem(...args); };
  api.loadBookmarkLibrary();
  api.loadBookmarkLibrary();
  assert.equal(writes, 0);
});

test('bookmark tags are de-duplicated and capped at eight', () => {
  const { api } = loadHelpers();
  const [bm] = api.saveBookmarkLibrary([
    { id: 't', surah: 1, tags: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '1', ' '] }
  ]);
  assert.deepEqual(bm.tags, ['1', '2', '3', '4', '5', '6', '7', '8']);
});

test('createBookmarkEntry stamps a fresh, visited bookmark', () => {
  const { api } = loadHelpers();
  const bm = api.createBookmarkEntry({ surah: 18, page: 2, tags: 'جمعة' });
  assert.match(bm.id, /^bm_[a-z0-9]+_\d+$/);
  assert.equal(bm.surah, 18);
  assert.equal(bm.page, 2);
  assert.equal(bm.timestamp, NOW);
  assert.equal(bm.createdAt, NOW);
  assert.equal(bm.lastVisited, NOW);
  assert.equal(bm.visitCount, 1);
  assert.equal(bm.folder, 'عام');
  assert.deepEqual(bm.tags, ['جمعة']);
});

test('folders: default first, trimmed, no duplicates', () => {
  const { api } = loadHelpers();
  api.saveBookmarkLibrary([{ id: 'a', surah: 1, folder: 'مراجعة' }]);

  assert.deepEqual(api.getBookmarkFolders(), ['عام', 'مراجعة']);
  assert.deepEqual(api.getBookmarkFolders(false), ['مراجعة']);

  assert.deepEqual(api.addBookmarkFolder('  تدبر  '), ['مراجعة', 'تدبر']);
  // Adding an existing folder is a no-op apart from re-saving the sorted list.
  assert.deepEqual(api.addBookmarkFolder('تدبر'), ['تدبر', 'مراجعة']);
  // Reads come back sorted (Arabic collation) with the default folder first.
  assert.deepEqual(api.getBookmarkFolders(), ['عام', 'تدبر', 'مراجعة']);
  // A blank name adds nothing and just returns the current list.
  assert.deepEqual(api.addBookmarkFolder('   '), ['عام', 'تدبر', 'مراجعة']);
});

test('getBookmarkTags returns the sorted union of all tags', () => {
  const { api } = loadHelpers();
  api.saveBookmarkLibrary([
    { id: 'a', surah: 1, tags: ['ب', 'أ'] },
    { id: 'b', surah: 2, tags: 'ب, ت' }
  ]);
  assert.deepEqual(api.getBookmarkTags(), ['أ', 'ب', 'ت']);
});

test('touchBookmarkVisitById records a visit', () => {
  const { api } = loadHelpers();
  api.saveBookmarkLibrary([{ id: 'a', surah: 1, visitCount: 2 }]);
  const bm = api.touchBookmarkVisitById(' a ');
  assert.equal(bm.visitCount, 3);
  assert.equal(bm.lastVisited, NOW);
  assert.equal(api.loadBookmarkLibrary()[0].visitCount, 3);
  assert.equal(api.touchBookmarkVisitById('missing'), null);
  assert.equal(api.touchBookmarkVisitById(''), null);
});

test('touchBookmarkVisitByLocation updates every match and returns the newest', () => {
  const { api } = loadHelpers();
  api.saveBookmarkLibrary([
    { id: 'old', surah: 2, page: 5, timestamp: 100 },
    { id: 'new', surah: 2, page: 5, timestamp: 900 },
    { id: 'other', surah: 2, page: 6, timestamp: 1000 }
  ]);
  const hit = api.touchBookmarkVisitByLocation('2', '5');
  assert.equal(hit.id, 'new');

  const byId = Object.fromEntries(api.loadBookmarkLibrary().map((b) => [b.id, b]));
  assert.equal(byId.old.visitCount, 1);
  assert.equal(byId.new.visitCount, 1);
  assert.equal(byId.other.visitCount, 0);

  assert.equal(api.touchBookmarkVisitByLocation(2, 99), null);
  assert.equal(api.touchBookmarkVisitByLocation('x', 5), null);
});

test('updateBookmarkMetaById re-normalises the edited bookmark', () => {
  const { api } = loadHelpers();
  api.saveBookmarkLibrary([{ id: 'a', surah: 1, folder: 'قديم' }]);
  const bm = api.updateBookmarkMetaById('a', { folder: '  ', tags: 'x, y', note: ' hi ' });
  assert.equal(bm.folder, 'عام');
  assert.deepEqual(bm.tags, ['x', 'y']);
  assert.equal(bm.note, 'hi');
  assert.equal(bm.id, 'a');
  assert.equal(api.updateBookmarkMetaById('nope', {}), null);
});

test('deleteBookmarkById reports how many were removed', () => {
  const { api } = loadHelpers();
  api.saveBookmarkLibrary([{ id: 'a', surah: 1 }, { id: 'b', surah: 2 }]);
  assert.equal(api.deleteBookmarkById('a'), 1);
  assert.equal(api.deleteBookmarkById('a'), 0);
  assert.equal(api.deleteBookmarkById(''), 0);
  assert.deepEqual(api.loadBookmarkLibrary().map((b) => b.id), ['b']);
});

test('getRecentBookmarks lists visited bookmarks, most recent first', () => {
  const { api } = loadHelpers();
  api.saveBookmarkLibrary([
    { id: 'never', surah: 1 },
    { id: 'older', surah: 2, lastVisited: 10 },
    { id: 'newest', surah: 3, lastVisited: 30 },
    { id: 'middle', surah: 4, lastVisited: 20 }
  ]);
  assert.deepEqual(api.getRecentBookmarks().map((b) => b.id), ['newest', 'middle', 'older']);
  assert.deepEqual(api.getRecentBookmarks(2).map((b) => b.id), ['newest', 'middle']);
  assert.deepEqual(api.getRecentBookmarks(0).map((b) => b.id), ['newest']);
});

test('loadHabitLogs keeps only known habits and valid, unique, sorted dates', () => {
  const storage = createStorage({
    appHabitLogsV1: JSON.stringify({
      quran: ['2026-09-02', 'bad', '2026-09-01', '2026-09-02'],
      azkar: 'nope',
      jogging: ['2026-09-01']
    })
  });
  const { api } = loadHelpers({ storage });
  const logs = api.loadHabitLogs();
  assert.deepEqual(logs, { quran: ['2026-09-01', '2026-09-02'], azkar: [], masbaha: [] });
  assert.deepEqual(stored(storage, 'appHabitLogsV1'), logs);
});

test('recordHabitActivity logs today once and ignores unknown habits', () => {
  const { api } = loadHelpers();
  assert.deepEqual(api.recordHabitActivity('quran'), ['2026-09-26']);
  assert.deepEqual(api.recordHabitActivity('quran'), ['2026-09-26']);
  assert.equal(api.recordHabitActivity('jogging'), null);
});

test('recordHabitActivity keeps at most 180 days of history', () => {
  const days = [];
  for (let i = 200; i >= 1; i -= 1) {
    days.push(new Date(NOW - i * 86400000).toISOString().slice(0, 10));
  }
  const { api } = loadHelpers({ storage: createStorage({ appHabitLogsV1: JSON.stringify({ quran: days }) }) });
  const log = api.recordHabitActivity('quran');
  assert.equal(log.length, 180);
  assert.equal(log[log.length - 1], '2026-09-26');
});

test('getHabitStreak computes current and best streaks across month boundaries', () => {
  const storage = createStorage({
    appHabitLogsV1: JSON.stringify({
      quran: [
        '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', // best: 4
        '2026-09-10',
        '2026-09-24', '2026-09-25', '2026-09-26' // current: 3
      ],
      azkar: ['2026-09-24', '2026-09-25'] // not done today
    })
  });
  const { api } = loadHelpers({ storage });

  const quran = api.getHabitStreak('quran');
  assert.equal(quran.current, 3);
  assert.equal(quran.best, 4);
  assert.equal(quran.total, 8);

  const azkar = api.getHabitStreak('azkar');
  assert.equal(azkar.current, 0);
  assert.equal(azkar.best, 2);

  assert.deepEqual(api.getHabitStreak('masbaha'), { current: 0, best: 0, total: 0, days: [] });
});

test('getHabitSummary reports activity over a trailing window', () => {
  const storage = createStorage({
    appHabitLogsV1: JSON.stringify({ masbaha: ['2026-09-20', '2026-09-22', '2026-09-26', '2026-09-01'] })
  });
  const { api } = loadHelpers({ storage });

  const week = api.getHabitSummary('masbaha');
  assert.equal(week.windowDays, 7);
  assert.equal(week.activeDays, 3);
  assert.equal(week.percent, 43);
  assert.equal(week.timeline.length, 7);
  assert.deepEqual(week.timeline[0], { date: '2026-09-20', active: true });
  assert.deepEqual(week.timeline[6], { date: '2026-09-26', active: true });

  assert.equal(api.getHabitSummary('masbaha', 'junk').windowDays, 7);
  const today = api.getHabitSummary('masbaha', 1);
  assert.deepEqual([today.activeDays, today.percent], [1, 100]);
});
