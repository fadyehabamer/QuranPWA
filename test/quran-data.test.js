'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers');

const window = {};
loadScript('js/data/surahs.js', { window });
loadScript('js/data/quran-index.js', { window });

const SURAHS = window.QURAN_SURAHS;
const INDEX = window.QURAN_INDEX;

function isAscending(list) {
  return list.every((entry, i) => {
    if (i === 0) return true;
    const [s, a] = entry;
    const [ps, pa] = list[i - 1];
    return s > ps || (s === ps && a > pa);
  });
}

function pointsAtRealAyah([surah, ayah]) {
  return Number.isInteger(surah) && surah >= 1 && surah <= 114
    && Number.isInteger(ayah) && ayah >= 1 && ayah <= SURAHS[surah - 1].verses;
}

test('surah table has 114 surahs numbered in order with 6236 ayahs', () => {
  assert.equal(SURAHS.length, 114);
  assert.equal(window.QURAN_TOTAL_SURAHS, 114);
  SURAHS.forEach((s, i) => assert.equal(s.number, i + 1));
  assert.equal(SURAHS.reduce((sum, s) => sum + s.verses, 0), 6236);
  for (const s of SURAHS) {
    assert.ok(s.type === 'مكية' || s.type === 'مدنية', `surah ${s.number} type`);
    assert.ok(s.juz >= 1 && s.juz <= 30, `surah ${s.number} juz`);
  }
});

test('derived surah lookups agree with the table', () => {
  assert.equal(window.QURAN_SURAH_NAMES.length, 114);
  assert.equal(window.QURAN_SURAH_NAMES[0], 'الفاتحة');
  assert.equal(window.QURAN_SURAH_TO_JUZ[2], 1);
  assert.equal(window.QURAN_SURAH_TO_JUZ[114], 30);
});

test('getSurahInfo / getSurahName / getSurahJuz accept numbers and numeric strings', () => {
  assert.equal(window.getSurahInfo(2).name, 'البقرة');
  assert.equal(window.getSurahInfo('2').verses, 286);
  assert.equal(window.getSurahName(114), 'الناس');
  assert.equal(window.getSurahName('18'), 'الكهف');
  assert.equal(window.getSurahJuz('67'), 29);
});

test('surah lookups fall back safely for out-of-range or junk input', () => {
  for (const bad of [0, 115, -1, 'abc', null, undefined]) {
    assert.equal(window.getSurahInfo(bad), null, String(bad));
    assert.equal(window.getSurahName(bad), 'سورة', String(bad));
    assert.equal(window.getSurahJuz(bad), null, String(bad));
  }
});

test('index tables have the canonical sizes', () => {
  assert.equal(INDEX.JUZ_STARTS.length, 30);
  assert.equal(INDEX.PAGE_STARTS.length, 604);
  assert.equal(INDEX.HIZB_QUARTER_STARTS.length, 240);
  assert.equal(INDEX.SAJDAS.length, 15);
});

test('every index entry points at a real ayah and the lists are strictly ascending', () => {
  for (const key of ['JUZ_STARTS', 'PAGE_STARTS', 'HIZB_QUARTER_STARTS']) {
    const list = INDEX[key];
    assert.deepEqual(list[0], [1, 1], `${key} starts at 1:1`);
    assert.ok(list.every(pointsAtRealAyah), `${key} entries are real ayahs`);
    assert.ok(isAscending(list), `${key} is ascending`);
  }
  assert.ok(INDEX.SAJDAS.every(([s, a]) => pointsAtRealAyah([s, a])));
});

test('every eighth hizb quarter starts a juz', () => {
  INDEX.JUZ_STARTS.forEach((start, i) => {
    assert.deepEqual(INDEX.HIZB_QUARTER_STARTS[i * 8], start, `juz ${i + 1}`);
  });
});

test('the surah table juz column matches the juz index', () => {
  for (const s of SURAHS) {
    assert.equal(INDEX.juzForAyah(s.number, 1), s.juz, `surah ${s.number}`);
  }
});

test('pageForAyah maps ayahs to Madani mushaf pages', () => {
  assert.equal(INDEX.pageForAyah(1, 1), 1);
  assert.equal(INDEX.pageForAyah(1, 7), 1);
  assert.equal(INDEX.pageForAyah(2, 1), 2);
  assert.equal(INDEX.pageForAyah(2, 5), 2);
  assert.equal(INDEX.pageForAyah(2, 6), 3);
  assert.equal(INDEX.pageForAyah(2, 255), 42);
  assert.equal(INDEX.pageForAyah(18, 1), 293);
  assert.equal(INDEX.pageForAyah(36, 1), 440);
  assert.equal(INDEX.pageForAyah(67, 1), 562);
  assert.equal(INDEX.pageForAyah(114, 6), 604);
});

test('juzForAyah honours mid-surah juz boundaries', () => {
  assert.equal(INDEX.juzForAyah(1, 1), 1);
  assert.equal(INDEX.juzForAyah(2, 141), 1);
  assert.equal(INDEX.juzForAyah(2, 142), 2);
  assert.equal(INDEX.juzForAyah(2, 252), 2);
  assert.equal(INDEX.juzForAyah(2, 253), 3);
  assert.equal(INDEX.juzForAyah(78, 1), 30);
  assert.equal(INDEX.juzForAyah(114, 6), 30);
});

test('isSajdaAyah flags exactly the sajda ayahs', () => {
  assert.equal(INDEX.isSajdaAyah(7, 206), true);
  assert.equal(INDEX.isSajdaAyah(96, 19), true);
  assert.equal(INDEX.isSajdaAyah(32, 15), true);
  assert.equal(INDEX.isSajdaAyah(7, 205), false);
  assert.equal(INDEX.isSajdaAyah(1, 1), false);
});
