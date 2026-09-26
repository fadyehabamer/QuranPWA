'use strict';

// The device is in New York while the saved location is Riyadh, so every
// reminder has to be resolved against the location's timezone, not the phone's.
process.env.TZ = 'America/New_York';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript, createStorage, frozenDate } = require('./helpers');

const NOW = '2026-09-26T06:00:00Z'; // 09:00 in Riyadh, 02:00 Saturday in New York
const TIMINGS = {
  Fajr: '04:20',
  Sunrise: '05:38',
  Dhuhr: '11:43',
  Asr: '15:08',
  Maghrib: '17:47',
  Isha: '19:17'
};
const LOCATION = JSON.stringify({ latitude: 21.42, longitude: 39.82 });

const DEFAULT_SETTINGS = {
  enabled: false,
  prayers: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
  offsetMinutes: 0,
  iqamaReminder: false,
  khatma: false
};

function memoryStore(initial = {}) {
  const kv = new Map(Object.entries(initial));
  return {
    kv,
    get: async (key, fallback) => (kv.has(key) ? kv.get(key) : fallback),
    set: async (key, value) => { kv.set(key, value); },
    getSettings: async () => {
      const stored = kv.get('settings') || {};
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        prayers: { ...DEFAULT_SETTINGS.prayers, ...(stored.prayers || {}) }
      };
    },
    getSchedule: async () => kv.get('schedule') || [],
    setSchedule: async (list) => { kv.set('schedule', list || []); }
  };
}

function setup({
  settings = { enabled: true },
  storage = { userLocation: LOCATION },
  permission = 'granted',
  failDays = [],
  triggers = false,
  pending = [],
  storeInitial = {},
  withEngine = true
} = {}) {
  const store = memoryStore({ settings, ...storeInitial });
  const fetchCalls = [];
  const shown = [];
  const closed = [];
  const posted = [];

  function Notification() {}
  Notification.permission = permission;
  if (triggers) Notification.prototype.showTrigger = null;

  const registration = {
    getNotifications: async () => pending.map((tag) => ({ tag, close: () => closed.push(tag) })),
    showNotification: async (title, options) => { shown.push({ title, options }); }
  };
  const navigator = {
    serviceWorker: {
      ready: Promise.resolve(registration),
      controller: { postMessage: (msg) => posted.push(msg) }
    }
  };

  const window = {
    Notification,
    NotifyStore: store,
    addEventListener: () => {},
    TimestampTrigger: class TimestampTrigger {
      constructor(at) { this.at = at; }
    }
  };
  if (withEngine) {
    window.PrayerEngine = {
      fetchTimings: async (lat, lng, method, offset) => {
        fetchCalls.push({ lat, lng, method, offset });
        if (failDays.includes(offset)) throw new Error('offline');
        return { timings: TIMINGS, meta: { timezone: 'Asia/Riyadh' } };
      }
    };
  }

  loadScript('js/notifications.js', {
    window,
    navigator,
    Notification,
    localStorage: createStorage(storage),
    Date: frozenDate(NOW)
  });

  return { api: window.AppNotifications, store, fetchCalls, shown, closed, posted };
}

const at = (iso) => Date.parse(iso);

test('buildSchedule resolves prayer times in the location timezone for today and tomorrow', async () => {
  const { api, fetchCalls } = setup();
  const { items, failedDays } = await api.buildSchedule();

  assert.deepEqual(failedDays, []);
  assert.deepEqual(fetchCalls, [
    { lat: 21.42, lng: 39.82, method: undefined, offset: 0 },
    { lat: 21.42, lng: 39.82, method: undefined, offset: 1 }
  ]);

  // Today's Fajr (04:20 Riyadh = 01:20Z) has already passed.
  assert.deepEqual(items.map((i) => [i.prayer, i.at]), [
    ['Dhuhr', at('2026-09-26T08:43:00Z')],
    ['Asr', at('2026-09-26T12:08:00Z')],
    ['Maghrib', at('2026-09-26T14:47:00Z')],
    ['Isha', at('2026-09-26T16:17:00Z')],
    ['Fajr', at('2026-09-27T01:20:00Z')],
    ['Dhuhr', at('2026-09-27T08:43:00Z')],
    ['Asr', at('2026-09-27T12:08:00Z')],
    ['Maghrib', at('2026-09-27T14:47:00Z')],
    ['Isha', at('2026-09-27T16:17:00Z')]
  ]);

  assert.deepEqual(items[0], {
    id: 'prayer-Dhuhr-2026-8-26',
    at: at('2026-09-26T08:43:00Z'),
    kind: 'prayer',
    prayer: 'Dhuhr',
    title: 'حان وقت الظهر',
    body: 'اللهم أعنا على ذكرك وشكرك وحسن عبادتك'
  });
});

test('buildSchedule applies the early offset and wording', async () => {
  const { api } = setup({ settings: { enabled: true, offsetMinutes: 10 } });
  const { items } = await api.buildSchedule();
  const dhuhr = items[0];
  assert.equal(dhuhr.at, at('2026-09-26T08:33:00Z'));
  assert.equal(dhuhr.title, 'اقترب وقت الظهر');
  assert.equal(dhuhr.body, 'بقي 10 دقيقة على أذان الظهر');
});

test('buildSchedule skips disabled prayers and adds iqama follow-ups when asked', async () => {
  const { api } = setup({
    settings: { enabled: true, iqamaReminder: true, prayers: { Asr: false } }
  });
  const { items } = await api.buildSchedule();

  assert.ok(!items.some((i) => i.prayer === 'Asr'));

  const iqama = items.filter((i) => i.kind === 'iqama');
  assert.equal(iqama.length, 7); // 3 left today + 4 tomorrow, no Asr
  const firstIqama = iqama[0];
  assert.equal(firstIqama.id, 'iqama-Dhuhr-2026-8-26');
  assert.equal(firstIqama.at, at('2026-09-26T08:58:00Z'));
  assert.equal(firstIqama.title, 'هل صليت الظهر؟');

  const sorted = items.map((i) => i.at);
  assert.deepEqual(sorted, [...sorted].sort((a, b) => a - b));
});

test('buildSchedule keeps the day that loaded when the other request fails', async () => {
  const { api } = setup({ failDays: [1] });
  const { items, failedDays } = await api.buildSchedule();
  assert.deepEqual(failedDays, [1]);
  assert.equal(items.length, 4);
  assert.ok(items.every((i) => i.id.endsWith('2026-8-26')));
});

test('buildSchedule returns [] without notification permission', async () => {
  const { api } = setup({ permission: 'denied' });
  assert.deepEqual(await api.buildSchedule(), []);
});

test('buildSchedule returns null when it cannot compute (no engine or no location)', async () => {
  assert.equal(await setup({ withEngine: false }).api.buildSchedule(), null);
  assert.equal(await setup({ storage: {} }).api.buildSchedule(), null);
  assert.equal(
    await setup({ storage: { userLocation: '{"latitude":"21"}' } }).api.buildSchedule(),
    null
  );
});

test('custom reminders fire at device-local time and respect the chosen weekdays', async () => {
  const storage = {
    notificationsEnabled: 'true',
    notifications: JSON.stringify([
      { time: '21:30', days: [] },
      { time: '07:00', days: [0] }, // Sundays only
      { time: 'bad' },
      null
    ])
  };
  const { api, fetchCalls } = setup({ settings: { enabled: false }, storage });
  const { items } = await api.buildSchedule();

  // Prayer reminders are off, so no timings are fetched.
  assert.equal(fetchCalls.length, 0);
  assert.deepEqual(items.map((i) => [i.id, i.at]), [
    ['custom-0-2026-8-26', at('2026-09-27T01:30:00Z')], // Sat 21:30 EDT
    ['custom-0-2026-8-27', at('2026-09-28T01:30:00Z')], // Sun 21:30 EDT
    ['custom-1-2026-8-27', at('2026-09-27T11:00:00Z')] // Sun 07:00 EDT
  ]);
  assert.ok(items.every((i) => i.kind === 'custom'));
});

test('custom reminders are ignored while the toggle is off', async () => {
  const storage = { notificationsEnabled: 'false', notifications: '[{"time":"21:30"}]' };
  const { items } = await setup({ settings: { enabled: false }, storage }).api.buildSchedule();
  assert.deepEqual(items, []);
});

test('khatma reminders are added at 20:00 only while a plan exists', async () => {
  const withPlan = setup({
    settings: { enabled: true, khatma: true, prayers: { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false } },
    storage: { userLocation: LOCATION, khatmaPlanV1: '{"days":30}' }
  });
  const { items } = await withPlan.api.buildSchedule();
  assert.deepEqual(items.map((i) => [i.kind, i.at]), [
    ['khatma', at('2026-09-27T00:00:00Z')],
    ['khatma', at('2026-09-28T00:00:00Z')]
  ]);

  const noPlan = setup({ settings: { enabled: true, khatma: true } });
  assert.ok(!(await noPlan.api.buildSchedule()).items.some((i) => i.kind === 'khatma'));
});

test('refresh stores the schedule for the worker when triggers are unsupported', async () => {
  const { api, store, posted } = setup();
  const result = await api.refresh();

  assert.deepEqual(result, { count: 9, usedTriggers: false });
  assert.equal(store.kv.get('schedule').length, 9);
  assert.equal(store.kv.get('lastRefresh').at, at(NOW));
  assert.deepEqual(posted, [{ type: 'FLUSH_REMINDERS' }]);
});

test('refresh hands reminders to the browser via triggers and clears the worker copy', async () => {
  const { api, store, shown, closed } = setup({
    triggers: true,
    pending: ['quran-reminder-old', 'something-else']
  });
  const result = await api.refresh();

  assert.deepEqual(result, { count: 9, usedTriggers: true });
  assert.deepEqual(closed, ['quran-reminder-old']);
  assert.equal(shown.length, 9);
  assert.equal(shown[0].title, 'حان وقت الظهر');
  assert.equal(shown[0].options.tag, 'quran-reminder-prayer-Dhuhr-2026-8-26');
  assert.equal(shown[0].options.showTrigger.at, at('2026-09-26T08:43:00Z'));
  assert.deepEqual(shown[0].options.data, { kind: 'prayer', prayer: 'Dhuhr' });
  // Otherwise every reminder would fire twice.
  assert.deepEqual(store.kv.get('schedule'), []);
});

test('refresh is skipped when nothing changed since a recent run', async () => {
  const first = setup();
  await first.api.refresh();
  const lastRefresh = first.store.kv.get('lastRefresh');

  const second = setup({ storeInitial: { lastRefresh, schedule: [{ id: 'x', at: 1 }] } });
  const result = await second.api.refresh();
  assert.deepEqual(result, { count: 1, skipped: true, unchanged: true });
  assert.equal(second.fetchCalls.length, 0);

  const forced = setup({ storeInitial: { lastRefresh } });
  assert.equal((await forced.api.refresh({ force: true })).count, 9);
  assert.equal(forced.fetchCalls.length, 2);
});

test('refresh keeps previously scheduled items for a day whose fetch failed', async () => {
  const future = { id: 'prayer-Fajr-2026-8-27', at: at('2026-09-27T01:20:00Z'), kind: 'prayer' };
  const past = { id: 'prayer-Fajr-2026-8-25', at: at('2026-09-25T01:20:00Z'), kind: 'prayer' };
  const { api, store } = setup({ failDays: [1], storeInitial: { schedule: [future, past] } });

  const result = await api.refresh();
  assert.equal(result.count, 5);
  const ids = store.kv.get('schedule').map((i) => i.id);
  assert.ok(ids.includes(future.id));
  assert.ok(!ids.includes(past.id));
});

test('refresh leaves the existing schedule alone when it cannot compute one', async () => {
  const kept = [{ id: 'a', at: at('2026-09-27T00:00:00Z') }];
  const { api, store } = setup({ storage: {}, storeInitial: { schedule: kept } });
  assert.deepEqual(await api.refresh(), { count: 1, skipped: true });
  assert.deepEqual(store.kv.get('schedule'), kept);
});
