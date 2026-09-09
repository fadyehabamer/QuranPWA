/* ==========================================================================
   Reminder scheduling — prayer times, adhan and khatma.

   WHY THIS IS SHAPED THE WAY IT IS
   --------------------------------
   The previous implementation called setTimeout() from the settings page. A
   setTimeout dies with the page, so a reminder only ever fired if the app
   happened to still be open at that moment — which is precisely when you least
   need reminding. It also skipped anything more than 24h away.

   A web app with no push server cannot guarantee delivery while fully closed.
   So this uses three layers, best first:

     1. Notification Triggers (`showTrigger`). The browser takes ownership of
        the timestamp and fires it whether or not the app or worker is running.
        This is the only true "closed app" delivery available without a server.
     2. Periodic Background Sync, which wakes the worker roughly twice a day so
        it can flush anything due.
     3. Catch-up on wake: any time the worker runs at all — a fetch, the app
        opening — it fires reminders whose time has passed but which were never
        delivered, labelled as a missed prayer rather than a live call.

   Layer 1 is the real feature; 2 and 3 are the safety net where it is missing.
   The page computes concrete timestamps and hands them over; the worker holds
   no prayer-time logic at all.
   ========================================================================== */
(function () {
  "use strict";

  // 48h of schedule, refreshed on every app open. Long enough that a day of
  // not opening the app still has reminders, short enough that a location or
  // calculation-method change is reflected quickly.
  var HORIZON_MS = 48 * 60 * 60 * 1000;

  var PRAYER_LABELS = {
    Fajr: 'الفجر',
    Dhuhr: 'الظهر',
    Asr: 'العصر',
    Maghrib: 'المغرب',
    Isha: 'العشاء'
  };

  function supportsNotifications() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  function supportsTriggers() {
    return 'Notification' in window && 'showTrigger' in Notification.prototype;
  }

  function permission() {
    return supportsNotifications() ? Notification.permission : 'unsupported';
  }

  function requestPermission() {
    if (!supportsNotifications()) return Promise.resolve('unsupported');
    return Notification.requestPermission();
  }

  /* ------------------------------------------------------------- scheduling */

  function readSavedLocation() {
    try {
      var raw = JSON.parse(localStorage.getItem('userLocation') || 'null');
      if (raw && typeof raw.latitude === 'number' && typeof raw.longitude === 'number') return raw;
    } catch (_e) { /* fall through */ }
    return null;
  }

  /**
   * Turn a "HH:MM" prayer time into an absolute timestamp on a given date.
   *
   * The API reports times in the LOCATION's timezone, which is not necessarily
   * the device's. Building a Date from local parts would silently shift every
   * reminder by the offset between the two, so the wall-clock time is resolved
   * against the target timezone explicitly.
   */
  function timestampFor(dateParts, time24, timezone) {
    var pieces = String(time24).split(':');
    var hour = parseInt(pieces[0], 10);
    var minute = parseInt(pieces[1], 10);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return NaN;

    // Start from the device's interpretation, then correct by the difference
    // between the two zones at that instant.
    var naive = new Date(dateParts.year, dateParts.month, dateParts.day, hour, minute, 0, 0);
    if (!timezone) return naive.getTime();

    try {
      var asTarget = new Date(naive.toLocaleString('en-US', { timeZone: timezone }));
      var asLocal = new Date(naive.toLocaleString('en-US'));
      return naive.getTime() + (asLocal.getTime() - asTarget.getTime());
    } catch (_e) {
      return naive.getTime();
    }
  }

  function dayParts(offsetDays) {
    var date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
  }

  /**
   * Build the concrete list of reminders for the next HORIZON_MS.
   * Returns [] when reminders are off, permission is missing, or there is no
   * saved location to compute times from.
   */
  async function buildSchedule() {
    // null means "cannot compute" and MUST NOT be written over the stored
    // schedule. This script loads on every page, but PrayerEngine does not —
    // returning an empty list here would let opening the azkar page silently
    // wipe every reminder that was already scheduled.
    if (!window.NotifyStore || !window.PrayerEngine) return null;

    var settings = await window.NotifyStore.getSettings();
    if (permission() !== 'granted') return [];

    var now = Date.now();
    var items = buildCustomReminders(now);
    var failedDays = [];

    if (!settings.enabled) {
      return { items: items, failedDays: failedDays };
    }

    // No location: nothing can be computed, but a previously built schedule is
    // still valid, so leave it alone.
    var location = readSavedLocation();
    if (!location) return null;

    // Today and tomorrow. Two requests, both cached by the service worker.
    for (var offset = 0; offset <= 1; offset += 1) {
      var data;
      try {
        data = await window.PrayerEngine.fetchTimings(
          location.latitude, location.longitude, undefined, offset
        );
      } catch (_e) {
        // Offline. Keep whatever the other day produced; refresh() merges the
        // previously scheduled items for this day back in.
        failedDays.push(offset);
        continue;
      }

      var timezone = data && data.meta && data.meta.timezone;
      var timings = data && data.timings;
      if (!timings) continue;

      var parts = dayParts(offset);

      Object.keys(PRAYER_LABELS).forEach(function (key) {
        if (!settings.prayers[key]) return;

        var base = timestampFor(parts, timings[key], timezone);
        if (!base) return;

        var at = base - settings.offsetMinutes * 60000;
        if (at > now && at < now + HORIZON_MS) {
          items.push({
            id: 'prayer-' + key + '-' + parts.year + '-' + parts.month + '-' + parts.day,
            at: at,
            kind: 'prayer',
            prayer: key,
            title: settings.offsetMinutes > 0
              ? 'اقترب وقت ' + PRAYER_LABELS[key]
              : 'حان وقت ' + PRAYER_LABELS[key],
            body: settings.offsetMinutes > 0
              ? 'بقي ' + settings.offsetMinutes + ' دقيقة على أذان ' + PRAYER_LABELS[key]
              : 'اللهم أعنا على ذكرك وشكرك وحسن عبادتك'
          });
        }

        // Second nudge after the adhan, for anyone who silences the first.
        if (settings.iqamaReminder) {
          var followUp = base + 15 * 60000;
          if (followUp > now && followUp < now + HORIZON_MS) {
            items.push({
              id: 'iqama-' + key + '-' + parts.year + '-' + parts.month + '-' + parts.day,
              at: followUp,
              kind: 'iqama',
              prayer: key,
              title: 'هل صليت ' + PRAYER_LABELS[key] + '؟',
              body: 'سجّل صلاتك في متابعة الصلوات'
            });
          }
        }
      });
    }

    if (settings.khatma) {
      items = items.concat(buildKhatmaReminders(now));
    }

    items.sort(function (a, b) { return a.at - b.at; });
    return { items: items, failedDays: failedDays };
  }

  /**
   * User-defined reminders from the settings page ("notifications" in
   * localStorage: [{ time: 'HH:MM', days: [0..6] }]). These used to be fired
   * by a setTimeout on the settings page, so they only ever went off while
   * that page stayed open, ignored the chosen days, and stacked up duplicates.
   * Folding them into the same schedule gives them the trigger / worker
   * delivery the prayer reminders get.
   */
  function buildCustomReminders(now) {
    var enabled = false;
    var list = [];
    try {
      enabled = localStorage.getItem('notificationsEnabled') === 'true';
      list = JSON.parse(localStorage.getItem('notifications') || '[]');
    } catch (_e) { return []; }
    if (!enabled || !Array.isArray(list)) return [];

    var out = [];
    list.forEach(function (entry, index) {
      if (!entry || typeof entry.time !== 'string') return;
      var pieces = entry.time.split(':');
      var hour = parseInt(pieces[0], 10);
      var minute = parseInt(pieces[1], 10);
      if (!Number.isInteger(hour) || !Number.isInteger(minute)) return;
      var days = Array.isArray(entry.days) ? entry.days.map(Number) : [];

      for (var offset = 0; offset <= 1; offset += 1) {
        var parts = dayParts(offset);
        var date = new Date(parts.year, parts.month, parts.day, hour, minute, 0, 0);
        if (days.length && days.indexOf(date.getDay()) === -1) continue;
        var at = date.getTime();
        if (at > now && at < now + HORIZON_MS) {
          out.push({
            id: 'custom-' + index + '-' + parts.year + '-' + parts.month + '-' + parts.day,
            at: at,
            kind: 'custom',
            title: 'القرآن الكريم',
            body: 'حان وقت قراءة القرآن والأذكار'
          });
        }
      }
    });
    return out;
  }

  // A single daily nudge at 20:00 device time, only while a khatma plan is
  // actually running.
  function buildKhatmaReminders(now) {
    var hasPlan = false;
    try { hasPlan = Boolean(localStorage.getItem('khatmaPlanV1') || localStorage.getItem('khatmaProgress')); }
    catch (_e) { hasPlan = false; }
    if (!hasPlan) return [];

    var out = [];
    for (var offset = 0; offset <= 1; offset += 1) {
      var parts = dayParts(offset);
      var at = new Date(parts.year, parts.month, parts.day, 20, 0, 0, 0).getTime();
      if (at > now && at < now + HORIZON_MS) {
        out.push({
          id: 'khatma-' + parts.year + '-' + parts.month + '-' + parts.day,
          at: at,
          kind: 'khatma',
          title: 'وردك اليومي من القرآن',
          body: 'أكمل ورد اليوم من ختمتك'
        });
      }
    }
    return out;
  }

  /* --------------------------------------------------------------- delivery */

  // Hand each item to the browser to fire on its own. Only this path survives
  // the app being fully closed without a push server.
  async function installTriggers(items) {
    if (!supportsTriggers()) return false;

    var registration = await navigator.serviceWorker.ready;

    // Clear previously scheduled ones so a settings change does not leave
    // stale reminders queued in the browser.
    var pending = await registration.getNotifications({ includeTriggered: false });
    pending.forEach(function (notification) {
      if (notification.tag && notification.tag.indexOf('quran-reminder-') === 0) notification.close();
    });

    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      try {
        await registration.showNotification(item.title, {
          body: item.body,
          tag: 'quran-reminder-' + item.id,
          icon: '/assets/icons/icon-192.png',
          badge: '/assets/icons/icon-192.png',
          showTrigger: new window.TimestampTrigger(item.at),
          data: { kind: item.kind, prayer: item.prayer || null }
        });
      } catch (_e) {
        return false; // fall back to the worker's own catch-up
      }
    }
    return true;
  }

  async function registerPeriodicSync() {
    try {
      var registration = await navigator.serviceWorker.ready;
      if (!('periodicSync' in registration)) return;

      var status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state !== 'granted') return;

      await registration.periodicSync.register('quran-reminders', {
        minInterval: 12 * 60 * 60 * 1000
      });
    } catch (_e) { /* unsupported: layers 1 and 3 still apply */ }
  }

  /**
   * Recompute and install everything. Safe to call on every app start — it is
   * idempotent, and the schedule is keyed by day so re-runs do not duplicate.
   */
  // Skip a rebuild when nothing that feeds it has changed. This runs on every
  // page open; without it each navigation cost two timing requests plus a
  // close-and-reshow of every pending trigger.
  var REFRESH_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

  function refreshKey(settings) {
    var location = readSavedLocation();
    var extra = '';
    try {
      extra = [
        localStorage.getItem('prayerMethod'),
        localStorage.getItem('prayerSchool'),
        localStorage.getItem('notificationsEnabled'),
        localStorage.getItem('notifications'),
        localStorage.getItem('khatmaPlanV1') ? '1' : '0'
      ].join('|');
    } catch (_e) { /* ignore */ }
    return JSON.stringify([settings, location, permission(), extra]);
  }

  async function refresh(options) {
    if (!window.NotifyStore) return { count: 0, skipped: true };
    var force = Boolean(options && options.force);

    var settings = await window.NotifyStore.getSettings();
    var key = refreshKey(settings);
    var last = await window.NotifyStore.get('lastRefresh', null);
    if (!force && last && last.key === key && (Date.now() - last.at) < REFRESH_MIN_INTERVAL_MS) {
      var current = await window.NotifyStore.getSchedule();
      return { count: current.length, skipped: true, unchanged: true };
    }

    var built = await buildSchedule();

    // Could not compute (wrong page, no location, fully offline): leave the
    // existing schedule in place rather than clearing it.
    if (built === null) {
      var existing = await window.NotifyStore.getSchedule();
      return { count: existing.length, skipped: true };
    }

    var items = built.items;
    var previous = await window.NotifyStore.getSchedule();
    var now = Date.now();

    // A day whose request failed keeps whatever was scheduled for it last
    // time, instead of silently dropping tomorrow's reminders (and cancelling
    // their triggers below) because the network hiccuped once.
    if (built.failedDays.length) {
      var ids = {};
      items.forEach(function (item) { ids[item.id] = true; });
      previous.forEach(function (item) {
        if (item.at > now && !ids[item.id]) items.push(item);
      });
      items.sort(function (a, b) { return a.at - b.at; });
    }

    // Every day resolved to nothing while reminders are ON usually means the
    // network was down, not that there is genuinely nothing to fire.
    if (!items.length && settings.enabled) {
      var stillAhead = previous.filter(function (item) { return item.at > now; });
      if (stillAhead.length) return { count: stillAhead.length, skipped: true };
    }

    var usedTriggers = await installTriggers(items);
    if (!usedTriggers) await registerPeriodicSync();

    // With triggers the browser owns delivery. Leaving the same items in the
    // worker's catch-up list as well made every reminder fire twice: once on
    // time, then again from flushDueReminders() when the app was next opened
    // within 30 minutes.
    await window.NotifyStore.setSchedule(usedTriggers ? [] : items);
    await window.NotifyStore.set('lastRefresh', { at: now, key: key });

    // Ask the worker to flush anything already due (app was closed over it).
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'FLUSH_REMINDERS' });
    }

    return { count: items.length, usedTriggers: usedTriggers };
  }

  async function sendTestNotification() {
    if (permission() !== 'granted') return false;
    var registration = await navigator.serviceWorker.ready;
    await registration.showNotification('تنبيه تجريبي', {
      body: 'التنبيهات تعمل بشكل صحيح.',
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-192.png',
      tag: 'quran-test'
    });
    return true;
  }

  window.AppNotifications = {
    PRAYER_LABELS: PRAYER_LABELS,
    supported: supportsNotifications,
    supportsTriggers: supportsTriggers,
    permission: permission,
    requestPermission: requestPermission,
    buildSchedule: buildSchedule,
    refresh: refresh,
    sendTestNotification: sendTestNotification
  };

  // Every app start is a chance to top the schedule back up to 48h.
  if (supportsNotifications()) {
    window.addEventListener('load', function () {
      setTimeout(function () { refresh().catch(function () { /* non-fatal */ }); }, 2500);
    });
  }
})();
