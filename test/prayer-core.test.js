'use strict';

process.env.TZ = 'UTC';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript, createStorage, createBlockedStorage, frozenDate } = require('./helpers');

// Makkah-like timings, as Aladhan returns them (location-local HH:MM).
const TIMINGS = {
  Fajr: '04:20',
  Sunrise: '05:38',
  Dhuhr: '11:43',
  Asr: '15:08',
  Maghrib: '17:47',
  Isha: '19:17'
};
const RIYADH = 'Asia/Riyadh'; // UTC+3, no DST

function loadEngine({ now = '2026-09-26T09:00:00Z', storage = createStorage(), fetch } = {}) {
  const window = {};
  loadScript('js/prayer-core.js', {
    window,
    localStorage: storage,
    fetch: fetch || (() => { throw new Error('unexpected fetch'); }),
    Date: frozenDate(now)
  });
  return window.PrayerEngine;
}

// "HH:MM in Riyadh" -> the UTC instant string, for readable clock setups.
function riyadh(hhmm, day = '2026-09-26') {
  return new Date(`${day}T${hhmm}:00+03:00`).toISOString();
}

test('formatTime renders 12-hour Arabic times', () => {
  const engine = loadEngine();
  assert.equal(engine.formatTime('13:05'), '1:05 م');
  assert.equal(engine.formatTime('00:15'), '12:15 ص');
  assert.equal(engine.formatTime('12:00'), '12:00 م');
  assert.equal(engine.formatTime('04:20'), '4:20 ص');
  assert.equal(engine.formatTime(''), '');
  assert.equal(engine.formatTime(undefined), '');
});

test('toMinutes / fromMinutes / addMinutes round-trip and wrap midnight', () => {
  const engine = loadEngine();
  assert.equal(engine.toMinutes('00:00'), 0);
  assert.equal(engine.toMinutes('19:17'), 1157);
  assert.equal(engine.fromMinutes(1157), '19:17');
  assert.equal(engine.fromMinutes(1440), '00:00');
  assert.equal(engine.fromMinutes(-10), '23:50');
  assert.equal(engine.addMinutes('23:55', 10), '00:05');
  assert.equal(engine.addMinutes('00:05', -10), '23:55');
});

test('calculateTahajjudTime returns the start of the last third of the night', () => {
  const engine = loadEngine();
  // Night 19:17 -> 04:20 is 543 minutes; last third starts 181 min before Fajr.
  assert.equal(engine.calculateTahajjudTime(TIMINGS), '01:19');
  // Fajr just after midnight: the result wraps back to the previous evening
  // rather than going negative.
  assert.equal(engine.calculateTahajjudTime({ Fajr: '00:20', Isha: '22:00' }), '23:34');
});

test('formatCountdown pads and drops the hour when zero', () => {
  const engine = loadEngine();
  assert.equal(engine.formatCountdown(3725), '01:02:05');
  assert.equal(engine.formatCountdown(59), '00:59');
  assert.equal(engine.formatCountdown(-5), '00:00');
  assert.equal(engine.formatCountdown(61.9), '01:01');
});

test('formatRemainingMinutes formats hours and minutes', () => {
  const engine = loadEngine();
  assert.equal(engine.formatRemainingMinutes(125), 'متبقٍّ 2 س و 5 د');
  assert.equal(engine.formatRemainingMinutes(7), 'متبقٍّ 7 د');
  assert.equal(engine.formatRemainingMinutes(-3), 'متبقٍّ 0 د');
});

test('minutesNowAt / secondsNowAt read the clock in the target timezone', () => {
  const engine = loadEngine({ now: '2026-09-26T09:00:30Z' });
  assert.equal(engine.minutesNowAt(RIYADH), 12 * 60);
  assert.equal(engine.secondsNowAt(RIYADH), 12 * 3600 + 30);
  // No timezone: device clock (UTC in this test process).
  assert.equal(engine.minutesNowAt(), 9 * 60);
  // An invalid zone falls back to the device clock instead of throwing.
  assert.equal(engine.minutesNowAt('Not/AZone'), 9 * 60);
});

test('calculateRemainingTime counts down to a prayer in the location timezone', () => {
  assert.equal(loadEngine({ now: riyadh('12:00') }).calculateRemainingTime('15:08', RIYADH), '3 ساعة و 8 دقيقة');
  assert.equal(loadEngine({ now: riyadh('14:58') }).calculateRemainingTime('15:08', RIYADH), '10 دقيقة');
  assert.equal(loadEngine({ now: riyadh('15:08') }).calculateRemainingTime('15:08', RIYADH), 'الآن');
  // Past today's time: counts to the same time tomorrow.
  assert.equal(loadEngine({ now: riyadh('20:00') }).calculateRemainingTime('04:20', RIYADH), '8 ساعة و 20 دقيقة');
});

test('getNextPrayer picks the next marker, including Tahajjud after midnight', () => {
  const midday = loadEngine({ now: riyadh('12:00') }).getNextPrayer(TIMINGS, RIYADH);
  assert.equal(midday.name, 'Asr');
  assert.equal(midday.time, '15:08');
  assert.equal(midday.tomorrow, undefined);

  const afterMidnight = loadEngine({ now: riyadh('00:30') }).getNextPrayer(TIMINGS, RIYADH);
  assert.equal(afterMidnight.name, 'Tahajjud');
  assert.equal(afterMidnight.time, '01:19');

  const lateNight = loadEngine({ now: riyadh('23:00') }).getNextPrayer(TIMINGS, RIYADH);
  assert.equal(lateNight.name, 'Tahajjud');
  assert.equal(lateNight.tomorrow, true);
});

test('getNextPrayer compares against the location clock, not the device clock', () => {
  // 09:00 UTC is 12:00 in Riyadh (after Dhuhr) but 10:00 in London (before it).
  const engine = loadEngine({ now: '2026-09-26T09:00:00Z' });
  assert.equal(engine.getNextPrayer(TIMINGS, RIYADH).name, 'Asr');
  assert.equal(engine.getNextPrayer(TIMINGS, 'Europe/London').name, 'Dhuhr');
});

test('getDailyWindow reports progress between the surrounding prayers', () => {
  const win = loadEngine({ now: riyadh('12:00') }).getDailyWindow(TIMINGS, RIYADH);
  assert.equal(win.next.key, 'Asr');
  assert.equal(win.prevMin, 703); // Dhuhr
  assert.equal(win.nextMin, 908); // Asr
  assert.equal(win.remainingSec, (908 - 720) * 60);
  assert.equal(win.remainingMin, 188);
  assert.ok(Math.abs(win.fraction - 17 / 205) < 1e-9);
  assert.equal(win.order.length, 5);
});

test('getDailyWindow wraps across midnight in both directions', () => {
  const evening = loadEngine({ now: riyadh('20:00') }).getDailyWindow(TIMINGS, RIYADH);
  assert.equal(evening.next.key, 'Fajr');
  assert.equal(evening.next.tomorrow, true);
  assert.equal(evening.prevMin, 1157);
  assert.equal(evening.nextMin, 260 + 1440);
  assert.equal(evening.remainingMin, 260 + 1440 - 1200);

  const beforeFajr = loadEngine({ now: riyadh('02:00') }).getDailyWindow(TIMINGS, RIYADH);
  assert.equal(beforeFajr.next.key, 'Fajr');
  assert.equal(beforeFajr.next.tomorrow, undefined);
  assert.equal(beforeFajr.prevMin, 1157 - 1440); // yesterday's Isha
  assert.ok(Math.abs(beforeFajr.fraction - (120 + 283) / (260 + 283)) < 1e-9);
});

test('phaseForNow maps the location hour to a sky phase', () => {
  const cases = [
    ['03:00', 'night'],
    ['05:00', 'dawn'],
    ['08:00', 'morning'],
    ['12:00', 'noon'],
    ['16:00', 'afternoon'],
    ['18:00', 'sunset'],
    ['21:00', 'night']
  ];
  for (const [clock, phase] of cases) {
    assert.equal(loadEngine({ now: riyadh(clock) }).phaseForNow(RIYADH), phase, clock);
  }
});

test('getPrayerRanges chains each prayer to the next and wraps Isha to Fajr', () => {
  const ranges = loadEngine().getPrayerRanges(TIMINGS);
  assert.deepEqual(ranges.map((r) => r.key), ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  assert.deepEqual(ranges[0], { key: 'Fajr', label: 'الفجر', start: '04:20', end: '05:38' });
  assert.equal(ranges[1].moment, true);
  assert.equal(ranges[1].end, undefined);
  assert.equal(ranges[5].end, '04:20');
  assert.equal(ranges[5].wraps, true);
});

test('getForbiddenWindows derives the three disliked prayer windows', () => {
  const windows = loadEngine().getForbiddenWindows(TIMINGS);
  assert.deepEqual(
    windows.map(({ key, from, to }) => ({ key, from, to })),
    [
      { key: 'afterSunrise', from: '05:38', to: '05:53' },
      { key: 'zenith', from: '11:33', to: '11:43' },
      { key: 'beforeSunset', from: '17:32', to: '17:47' }
    ]
  );
});

test('isWithinWindow is start-inclusive and end-exclusive', () => {
  assert.equal(loadEngine({ now: riyadh('05:38') }).isWithinWindow('05:38', '05:53', RIYADH), true);
  assert.equal(loadEngine({ now: riyadh('05:52') }).isWithinWindow('05:38', '05:53', RIYADH), true);
  assert.equal(loadEngine({ now: riyadh('05:53') }).isWithinWindow('05:38', '05:53', RIYADH), false);
  assert.equal(loadEngine({ now: riyadh('05:37') }).isWithinWindow('05:38', '05:53', RIYADH), false);
});

test('calculationMethod and asrSchool read settings with safe defaults', () => {
  const defaults = loadEngine();
  assert.equal(defaults.calculationMethod(), 4);
  assert.equal(defaults.asrSchool(), 0);

  const custom = loadEngine({ storage: createStorage({ prayerMethod: '5', prayerSchool: '1' }) });
  assert.equal(custom.calculationMethod(), 5);
  assert.equal(custom.asrSchool(), 1);

  const junk = loadEngine({ storage: createStorage({ prayerMethod: 'abc', prayerSchool: 'yes' }) });
  assert.equal(junk.calculationMethod(), 4);
  assert.equal(junk.asrSchool(), 0);

  const blocked = loadEngine({ storage: createBlockedStorage() });
  assert.equal(blocked.calculationMethod(), 4);
  assert.equal(blocked.asrSchool(), 0);
});

function mockFetch(payload) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    return { json: async () => payload };
  };
  return { fetch, calls };
}

test('fetchTimings requests DD-MM-YYYY for the local calendar day', async () => {
  const data = { timings: TIMINGS, meta: { timezone: RIYADH } };
  const { fetch, calls } = mockFetch({ code: 200, data });
  const engine = loadEngine({ now: '2026-07-03T10:00:00Z', fetch });

  const result = await engine.fetchTimings(21.42, 39.82);
  assert.deepEqual(result, data);
  assert.equal(
    calls[0],
    'https://api.aladhan.com/v1/timings/03-07-2026?latitude=21.42&longitude=39.82&method=4&school=0'
  );
});

test('fetchTimings applies dayOffset across a month boundary and honours settings', async () => {
  const { fetch, calls } = mockFetch({ code: 200, data: {} });
  const storage = createStorage({ prayerMethod: '5', prayerSchool: '1' });
  const engine = loadEngine({ now: '2026-01-31T10:00:00Z', fetch, storage });

  await engine.fetchTimings(30, 31, undefined, 1);
  assert.match(calls[0], /\/timings\/01-02-2026\?/);
  assert.match(calls[0], /method=5&school=1$/);

  // An explicit method wins over the stored preference.
  await engine.fetchTimings(30, 31, 2);
  assert.match(calls[1], /\/timings\/31-01-2026\?.*method=2&school=1$/);
});

test('fetchTimings rejects when the API reports an error', async () => {
  const { fetch } = mockFetch({ code: 400, status: 'BAD_REQUEST' });
  const engine = loadEngine({ fetch });
  await assert.rejects(engine.fetchTimings(0, 0), /Failed to fetch prayer times/);
});
