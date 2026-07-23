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
  //
  // The date MUST be DD-MM-YYYY. The app previously sent YYYY-MM-DD, which
  // Aladhan silently misparsed: "2026-07-23" came back echoed as 23-07-2023,
  // i.e. timings for the WRONG YEAR (and a Hijri date three years out).
  // Prayer times differ only a minute or two year-over-year for the same
  // day-of-year, which is why it went unnoticed.
  // Calculation preferences, chosen on the settings page. Aladhan `method` is
  // the authority whose Fajr/Isha angles to use; `school` is the Asr rule
  // (0 = majority, 1 = Hanafi, which puts Asr noticeably later).
  function calculationMethod() {
    try {
      const stored = parseInt(localStorage.getItem('prayerMethod'), 10);
      if (Number.isInteger(stored)) return stored;
    } catch (_e) { /* storage blocked */ }
    return 4; // Umm al-Qura
  }

  function asrSchool() {
    try {
      return localStorage.getItem('prayerSchool') === '1' ? 1 : 0;
    } catch (_e) {
      return 0;
    }
  }

  async function fetchTimings(latitude, longitude, method, dayOffset) {
    const today = new Date();
    if (dayOffset) today.setDate(today.getDate() + dayOffset);
    const date = [
      String(today.getDate()).padStart(2, '0'),
      String(today.getMonth() + 1).padStart(2, '0'),
      today.getFullYear()
    ].join('-');

    const m = method || calculationMethod();
    const school = asrSchool();
    const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${latitude}&longitude=${longitude}&method=${m}&school=${school}`;
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

  // Seconds since midnight at the timings' location. The hero ring counts down
  // in HH:MM:SS, so minute resolution is not enough.
  function secondsNowAt(timezone) {
    const now = new Date();
    if (!timezone) return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).formatToParts(now);
      const h = Number(parts.find(p => p.type === 'hour').value);
      const m = Number(parts.find(p => p.type === 'minute').value);
      const s = Number(parts.find(p => p.type === 'second').value);
      return h * 3600 + m * 60 + s;
    } catch (_e) {
      return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    }
  }

  function formatCountdown(totalSeconds) {
    const t = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  // The five daily prayers only, with the surrounding window and how far
  // through it we are now — for the home hero (ring + countdown + chips).
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
    // Second-resolution so the ring sweeps smoothly and the countdown ticks.
    const curSec = secondsNowAt(timezone);
    const prevSec = prevMin * 60;
    const nextSec = nextMin * 60;
    const spanSec = Math.max(1, nextSec - prevSec);
    const fraction = Math.min(1, Math.max(0, (curSec - prevSec) / spanSec));
    const remainingSec = Math.max(0, nextSec - curSec);

    return {
      order,
      next,
      fraction,
      remainingSec,
      remainingMin: Math.ceil(remainingSec / 60),
      prevMin,
      nextMin
    };
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

  function fromMinutes(total) {
    const wrapped = ((Math.round(total) % 1440) + 1440) % 1440;
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function addMinutes(time24, delta) {
    return fromMinutes(toMinutes(time24) + delta);
  }

  /**
   * Each prayer as the window it may be performed in, rather than a single
   * instant. Sunrise is a boundary, not a prayer, so it is marked as a moment.
   * Isha runs to the next day's Fajr, which is why its range wraps midnight.
   */
  function getPrayerRanges(timings) {
    return [
      { key: 'Fajr', label: 'الفجر', start: timings.Fajr, end: timings.Sunrise },
      { key: 'Sunrise', label: 'الشروق', start: timings.Sunrise, moment: true },
      { key: 'Dhuhr', label: 'الظهر', start: timings.Dhuhr, end: timings.Asr },
      { key: 'Asr', label: 'العصر', start: timings.Asr, end: timings.Maghrib },
      { key: 'Maghrib', label: 'المغرب', start: timings.Maghrib, end: timings.Isha },
      { key: 'Isha', label: 'العشاء', start: timings.Isha, end: timings.Fajr, wraps: true }
    ];
  }

  /**
   * The three times at which voluntary prayer is disliked (أوقات الكراهة):
   * just after sunrise until the sun has risen a spear's length, the few
   * minutes around solar zenith, and from the sun yellowing until it sets.
   *
   * The classical descriptions are of the sun's apparent position, not clock
   * minutes. The offsets below are the conventional approximations used by
   * prayer apps (~15 / ~10 / ~15 minutes) — close enough to warn with, which
   * is why each row says "تقريباً".
   */
  function getForbiddenWindows(timings) {
    return [
      {
        key: 'afterSunrise',
        label: 'بعد الشروق',
        from: timings.Sunrise,
        to: addMinutes(timings.Sunrise, 15),
        note: 'حتى ترتفع الشمس قِيدَ رمح'
      },
      {
        key: 'zenith',
        label: 'قبل الظهر',
        from: addMinutes(timings.Dhuhr, -10),
        to: timings.Dhuhr,
        note: 'عند استواء الشمس حتى تزول'
      },
      {
        key: 'beforeSunset',
        label: 'قبل المغرب',
        from: addMinutes(timings.Maghrib, -15),
        to: timings.Maghrib,
        note: 'من اصفرار الشمس حتى تغرب'
      }
    ];
  }

  // Is the clock currently inside [from, to)? Windows here never wrap midnight.
  function isWithinWindow(from, to, timezone) {
    const now = minutesNowAt(timezone);
    return now >= toMinutes(from) && now < toMinutes(to);
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
    calculationMethod,
    asrSchool,
    formatTime,
    toMinutes,
    minutesNowAt,
    secondsNowAt,
    formatCountdown,
    calculateTahajjudTime,
    calculateRemainingTime,
    getNextPrayer,
    getDailyWindow,
    fromMinutes,
    addMinutes,
    getPrayerRanges,
    getForbiddenWindows,
    isWithinWindow,
    phaseForNow,
    formatRemainingMinutes
  };
})();
