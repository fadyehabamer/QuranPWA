/* ==========================================================================
   Prayer engine — the single source of truth for prayer-time maths.

   The app had two copies: the timezone-correct one in prayer-times.js and an
   older device-local one in common.js (home widget). The home widget copy
   still had the bugs prayer-times.js already fixed:
     - toISOString() fetched the wrong day's timings east of Greenwich at night
     - it compared prayer times against the DEVICE clock, so a location in a
       different timezone than the phone got the wrong "next prayer"
     - its countdown never ticked

   This module holds the corrected logic once. prayer-times.js and the home
   widget both delegate here. Classic script (no module): exposes window.PrayerEngine.
   Load BEFORE common.js and prayer-times.js.
   ========================================================================== */
(function () {
  "use strict";

  // Fetch today's timings for a location. Builds the date from LOCAL calendar
  // parts (not toISOString, which is UTC and rolls over early east of Greenwich).
  async function fetchTimings(latitude, longitude, method) {
    const today = new Date();
    const date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');

    const m = method || 2;
    const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${latitude}&longitude=${longitude}&method=${m}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.code !== 200) throw new Error('Failed to fetch prayer times');
    return data.data; // { timings, meta: { timezone }, date, ... }
  }

  function formatTime(time24) {
    if (!time24) return '';
    const [hours, minutes] = String(time24).split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'م' : 'ص';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }

  function toMinutes(t) {
    const [h, m] = String(t).split(':');
    return parseInt(h, 10) * 60 + parseInt(m, 10);
  }

  /**
   * Minutes since midnight *at the location the timings belong to*.
   * The Aladhan response is in the target location's timezone; comparing it
   * against the device clock shifts the whole schedule for anyone reading
   * times for a place in a different timezone than their phone.
   */
  function minutesNowAt(timezone) {
    const now = new Date();
    if (!timezone) return now.getHours() * 60 + now.getMinutes();
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(now);
      const h = Number(parts.find(p => p.type === 'hour').value);
      const m = Number(parts.find(p => p.type === 'minute').value);
      return h * 60 + m;
    } catch (_e) {
      return now.getHours() * 60 + now.getMinutes();
    }
  }

  // Last third of the night. Wraps into 0..1439 so early Fajr doesn't yield
  // negative times like "-2:35".
  function calculateTahajjudTime(timings) {
    const fajrMinutes = toMinutes(timings.Fajr);
    const ishaMinutes = toMinutes(timings.Isha);
    let nightDuration = fajrMinutes - ishaMinutes;
    if (nightDuration < 0) nightDuration += 24 * 60;
    const lastThirdStart = ((fajrMinutes - Math.floor(nightDuration / 3)) % 1440 + 1440) % 1440;
    const hours = Math.floor(lastThirdStart / 60);
    const minutes = lastThirdStart % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function calculateRemainingTime(prayerTime, timezone) {
    const target = toMinutes(prayerTime);
    const current = minutesNowAt(timezone);
    const minutesLeftTotal = ((target - current) % 1440 + 1440) % 1440;
    const hoursLeft = Math.floor(minutesLeftTotal / 60);
    const minutesLeft = minutesLeftTotal % 60;
    if (hoursLeft > 0) return `${hoursLeft} ساعة و ${minutesLeft} دقيقة`;
    if (minutesLeft > 0) return `${minutesLeft} دقيقة`;
    return 'الآن';
  }

  // Next of the six markers (five prayers + Tahajjud). Sorted by clock time so
  // Tahajjud (after midnight) is reachable. Used by the full prayer-times page.
  function getNextPrayer(timings, timezone) {
    const currentTime = minutesNowAt(timezone);
    const tahajjudTime = calculateTahajjudTime(timings);
    const prayers = [
      { name: 'Fajr', time: timings.Fajr },
      { name: 'Dhuhr', time: timings.Dhuhr },
      { name: 'Asr', time: timings.Asr },
      { name: 'Maghrib', time: timings.Maghrib },
      { name: 'Isha', time: timings.Isha },
      { name: 'Tahajjud', time: tahajjudTime }
    ].map(p => ({ ...p, minutes: toMinutes(p.time) })).sort((a, b) => a.minutes - b.minutes);

    for (const prayer of prayers) {
      if (prayer.minutes > currentTime) return prayer;
    }
    const first = prayers[0];
    return { name: first.name, time: first.time, minutes: first.minutes, tomorrow: true };
  }

  // The five daily prayers only, with the surrounding window and how far
  // through it we are now — for the home hero (timeline + countdown + chips).
  // Timezone-aware and midnight-safe.
  function getDailyWindow(timings, timezone) {
    const order = [
      { key: 'Fajr', label: 'الفجر' },
      { key: 'Dhuhr', label: 'الظهر' },
      { key: 'Asr', label: 'العصر' },
      { key: 'Maghrib', label: 'المغرب' },
      { key: 'Isha', label: 'العشاء' }
    ];
    const cur = minutesNowAt(timezone);
    const times = order.map(p => ({ ...p, min: toMinutes(timings[p.key]) }));

    let nextIdx = times.findIndex(p => p.min > cur);
    let next, nextMin, prevMin;
    if (nextIdx === -1) {
      next = { ...times[0], tomorrow: true };
      nextMin = times[0].min + 1440;
      prevMin = times[times.length - 1].min;
      nextIdx = 0;
    } else {
      next = times[nextIdx];
      nextMin = next.min;
      prevMin = nextIdx === 0 ? times[times.length - 1].min - 1440 : times[nextIdx - 1].min;
    }
    const span = Math.max(1, nextMin - prevMin);
    const fraction = Math.min(1, Math.max(0, (cur - prevMin) / span));
    const remainingMin = Math.max(0, nextMin - cur);
    return { order, next, fraction, remainingMin };
  }

  // Time-of-day phase for the home hero's sky gradient (matches home.css).
  function phaseForNow(timezone) {
    const hour = Math.floor(minutesNowAt(timezone) / 60);
    if (hour < 4) return 'night';
    if (hour < 6) return 'dawn';
    if (hour < 11) return 'morning';
    if (hour < 15) return 'noon';
    if (hour < 17) return 'afternoon';
    if (hour < 19) return 'sunset';
    return 'night';
  }

  function formatRemainingMinutes(mins) {
    const total = Math.max(0, Math.round(mins));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h > 0) return `متبقٍّ ${h} س و ${m} د`;
    return `متبقٍّ ${m} د`;
  }

  window.PrayerEngine = {
    fetchTimings,
    formatTime,
    toMinutes,
    minutesNowAt,
    calculateTahajjudTime,
    calculateRemainingTime,
    getNextPrayer,
    getDailyWindow,
    phaseForNow,
    formatRemainingMinutes
  };
})();
