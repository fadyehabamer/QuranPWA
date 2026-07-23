/* ==========================================================================
   First-run onboarding.

   Three intro screens, then a four-step setup wizard — accent colour, Quran
   font, mushaf display mode, location — one decision per screen. Previously
   the app just fired a bare geolocation prompt on first load with no
   explanation of why it wanted the permission.

   Full-screen rather than a dialog card: this is the first thing the app shows,
   and a popup floating over an empty home page read as an interruption.

   Runs on index.html only, once, gated by `onboardingDoneV1`.
   ========================================================================== */
(function () {
  "use strict";

  var DONE_KEY = 'onboardingDoneV1';

  function isDone() {
    try { return localStorage.getItem(DONE_KEY) === '1'; }
    catch (_e) { return true; } // storage blocked: never trap the reader here
  }

  function markDone() {
    try { localStorage.setItem(DONE_KEY, '1'); } catch (_e) { /* ignore */ }
  }

  function read(key, fallback) {
    try { return localStorage.getItem(key) || fallback; }
    catch (_e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (_e) { /* ignore */ }
  }

  var ACCENTS = [
    { hex: '#1B5E20', label: 'أخضر' },
    { hex: '#2196F3', label: 'أزرق' },
    { hex: '#9C27B0', label: 'بنفسجي' },
    { hex: '#FF5722', label: 'برتقالي' },
    { hex: '#795548', label: 'بني' },
    { hex: '#607D8B', label: 'رمادي' }
  ];

  var state = { index: 0, root: null };

  /* ------------------------------------------------------------------ steps */

  function introStep(icon, title, text) {
    return {
      kind: 'intro',
      render: function () {
        return '' +
          '<div class="onb-hero"><i class="bi ' + icon + '" aria-hidden="true"></i></div>' +
          '<h2 class="onb-title">' + title + '</h2>' +
          '<p class="onb-text">' + text + '</p>';
      }
    };
  }

  function choiceStep(config) {
    return {
      kind: 'setup',
      render: function () {
        return '' +
          '<div class="onb-icon"><i class="bi ' + config.icon + '" aria-hidden="true"></i></div>' +
          '<h2 class="onb-title">' + config.title + '</h2>' +
          '<p class="onb-text">' + config.text + '</p>' +
          '<div class="onb-choices" id="onbChoices">' + config.options() + '</div>';
      },
      bind: function (root) {
        var group = root.querySelector('#onbChoices');
        if (!group) return;
        group.addEventListener('click', function (event) {
          var button = event.target.closest('[data-value]');
          if (!button) return;
          config.select(button.getAttribute('data-value'));
          Array.prototype.forEach.call(group.children, function (child) {
            var isActive = child === button;
            child.classList.toggle('is-active', isActive);
            child.setAttribute('aria-pressed', String(isActive));
          });
        });
      }
    };
  }

  function accentOptions() {
    var current = read('primaryColor', '#1B5E20');
    return ACCENTS.map(function (option) {
      var active = option.hex === current;
      return '<button type="button" class="onb-swatch' + (active ? ' is-active' : '') + '"' +
        ' style="background:' + option.hex + '" data-value="' + option.hex + '"' +
        ' aria-label="' + option.label + '" aria-pressed="' + active + '"></button>';
    }).join('');
  }

  function fontOptions() {
    var current = read('quranFontFamily', 'amiri');
    var fonts = window.QURAN_FONTS || {};
    return Object.keys(fonts).map(function (key) {
      var active = key === current;
      return '<button type="button" class="onb-card-option' + (active ? ' is-active' : '') + '"' +
        ' data-value="' + key + '" aria-pressed="' + active + '">' +
        '<span class="onb-card-sample" style="font-family:' + fonts[key].stack + '">بِسْمِ ٱللَّهِ</span>' +
        '<span class="onb-card-name">' + fonts[key].label + '</span>' +
        '</button>';
    }).join('');
  }

  function modeOptions() {
    var current = read('quranReaderDisplayModeV1', 'text') === 'mushaf' ? 'mushaf' : 'text';
    var options = [
      { value: 'text', icon: 'bi-text-paragraph', name: 'نص', hint: 'يتكيّف مع حجم الخط' },
      { value: 'mushaf', icon: 'bi-file-earmark-image', name: 'صور المصحف', hint: 'صفحات المصحف كما هي' }
    ];
    return options.map(function (option) {
      var active = option.value === current;
      return '<button type="button" class="onb-card-option' + (active ? ' is-active' : '') + '"' +
        ' data-value="' + option.value + '" aria-pressed="' + active + '">' +
        '<span class="onb-card-icon"><i class="bi ' + option.icon + '" aria-hidden="true"></i></span>' +
        '<span class="onb-card-name">' + option.name + '</span>' +
        '<span class="onb-card-hint">' + option.hint + '</span>' +
        '</button>';
    }).join('');
  }

  var locationStep = {
    kind: 'setup',
    render: function () {
      return '' +
        '<div class="onb-icon"><i class="bi bi-geo-alt-fill" aria-hidden="true"></i></div>' +
        '<h2 class="onb-title">أين أنت؟</h2>' +
        '<p class="onb-text">نحتاج موقعك لحساب مواقيت الصلاة واتجاه القبلة. لا يُرسل لأي جهة أخرى.</p>' +
        '<button type="button" class="onb-location-btn" id="onbLocationBtn">' +
        '  <i class="bi bi-crosshair" aria-hidden="true"></i><span>تحديد موقعي تلقائياً</span>' +
        '</button>' +
        '<p class="onb-location-state" id="onbLocationState"></p>' +
        '<p class="onb-hint">يمكنك تخطي هذه الخطوة واختيار دولتك يدوياً لاحقاً من صفحة المواقيت.</p>';
    },
    bind: function (root) {
      var button = root.querySelector('#onbLocationBtn');
      var status = root.querySelector('#onbLocationState');

      var existing = read('locationText', '');
      if (existing) {
        status.textContent = 'الموقع الحالي: ' + existing;
        status.className = 'onb-location-state is-ok';
      }

      button.addEventListener('click', function () {
        if (!navigator.geolocation) {
          status.textContent = 'خدمة الموقع غير متاحة على هذا الجهاز.';
          status.className = 'onb-location-state is-error';
          return;
        }

        status.textContent = 'جاري تحديد موقعك…';
        status.className = 'onb-location-state';
        button.disabled = true;

        navigator.geolocation.getCurrentPosition(
          function (position) {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            write('userLocation', JSON.stringify({ latitude: lat, longitude: lng }));
            status.textContent = 'تم تحديد موقعك';
            status.className = 'onb-location-state is-ok';
            button.disabled = false;
            resolvePlaceName(lat, lng, status);
          },
          function () {
            // A refusal is a valid outcome; manual country choice still works.
            status.textContent = 'لم يُسمح بالوصول للموقع. اختر دولتك يدوياً من صفحة المواقيت.';
            status.className = 'onb-location-state is-error';
            button.disabled = false;
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      });
    }
  };

  /**
   * Turn coordinates into a city name.
   *
   * The first version stored the literal string "موقعك الحالي", which is why
   * the settings page showed that placeholder instead of a real place. Aladhan
   * already returns the resolved timezone for a coordinate pair, and its city
   * component is a good enough label without adding a geocoding provider.
   */
  function resolvePlaceName(latitude, longitude, status) {
    var fallback = latitude.toFixed(2) + ', ' + longitude.toFixed(2);

    fetch('https://api.aladhan.com/v1/timings?latitude=' + latitude + '&longitude=' + longitude)
      .then(function (response) { return response.json(); })
      .then(function (payload) {
        var timezone = payload && payload.data && payload.data.meta && payload.data.meta.timezone;
        // "Africa/Cairo" -> "Cairo"; underscores are word separators there.
        var city = timezone ? timezone.split('/').pop().replace(/_/g, ' ') : '';
        var name = city || fallback;
        write('locationText', name);
        if (status) status.textContent = 'تم تحديد موقعك: ' + name;
      })
      .catch(function () {
        write('locationText', fallback);
        if (status) status.textContent = 'تم تحديد موقعك: ' + fallback;
      });
  }

  var STEPS = [
    introStep('bi-book-half', 'المصحف كاملاً بين يديك',
      'اقرأ نصاً أو بصور المصحف، مع التفسير والاستماع لأي آية، وتتبّع لموضع قراءتك.'),
    introStep('bi-clock-history', 'مواقيت صلاتك',
      'الصلاة القادمة والوقت المتبقي لها، وأوقات الكراهة، واتجاه القبلة من موقعك.'),
    introStep('bi-stars', 'وردك اليومي',
      'الأذكار والمسبحة ومتابعة الصلوات والختمة — كلها تعمل بلا إنترنت.'),

    choiceStep({
      icon: 'bi-palette-fill',
      title: 'اختر لون التطبيق',
      text: 'يمكنك تغييره في أي وقت من الإعدادات.',
      options: accentOptions,
      select: function (hex) {
        write('primaryColor', hex);
        // Repaint immediately so the choice is visible while still choosing.
        if (window.applyAccentColor) {
          window.applyAccentColor(hex, document.documentElement.getAttribute('data-theme') === 'dark');
        }
      }
    }),

    choiceStep({
      icon: 'bi-fonts',
      title: 'خط المصحف',
      text: 'الخط الذي تُعرض به الآيات داخل القارئ.',
      options: fontOptions,
      select: function (key) {
        write('quranFontFamily', key);
        if (window.syncQuranFont) window.syncQuranFont();
      }
    }),

    choiceStep({
      icon: 'bi-book',
      title: 'طريقة عرض المصحف',
      text: 'كيف تفضّل قراءة السور؟',
      options: modeOptions,
      select: function (mode) { write('quranReaderDisplayModeV1', mode); }
    }),

    locationStep
  ];

  /* ---------------------------------------------------------------- render */

  function render() {
    var step = STEPS[state.index];
    var isLast = state.index === STEPS.length - 1;
    var body = state.root.querySelector('.onb-body');
    var dots = state.root.querySelector('.onb-dots');
    var next = state.root.querySelector('#onbNext');
    var back = state.root.querySelector('#onbBack');

    body.innerHTML = step.render();
    body.scrollTop = 0;
    state.root.classList.toggle('is-intro', step.kind === 'intro');

    dots.innerHTML = STEPS.map(function (_step, i) {
      return '<span class="onb-dot' + (i === state.index ? ' is-active' : '') + '"></span>';
    }).join('');

    next.textContent = isLast ? 'ابدأ' : 'التالي';
    // "Back" only exists once there is somewhere to go back to, so the first
    // screen's primary action is centred on its own rather than pushed aside.
    back.hidden = state.index === 0;
    state.root.classList.toggle('is-first', state.index === 0);

    if (step.bind) step.bind(state.root);
  }

  /* ------------------------------------------------------------- lifecycle */

  function finish() {
    markDone();
    document.body.classList.remove('onboarding-active');
    if (state.root) {
      state.root.remove();
      state.root = null;
    }

    // Re-run the home widget so it picks up the location just granted, and let
    // the page tour start now that the wizard is out of the way.
    if (typeof initHomePrayerWidget === 'function') {
      try { initHomePrayerWidget(); } catch (_e) { /* ignore */ }
    }
    if (window.AppTour) {
      setTimeout(function () {
        if (!window.AppTour.hasSeen('index')) window.AppTour.replay('index');
      }, 800);
    }
  }

  function open() {
    if (state.root) return;

    var root = document.createElement('div');
    root.className = 'onb-screen';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'إعداد التطبيق');
    root.innerHTML =
      '<button type="button" class="onb-skip" id="onbSkip">تخطي</button>' +
      '<div class="onb-body"></div>' +
      '<div class="onb-footer">' +
      '  <div class="onb-dots"></div>' +
      '  <div class="onb-actions">' +
      '    <button type="button" class="onb-btn" id="onbBack">السابق</button>' +
      '    <button type="button" class="onb-btn onb-btn-primary" id="onbNext">التالي</button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(root);
    document.body.classList.add('onboarding-active');
    state.root = root;
    state.index = 0;

    root.querySelector('#onbSkip').addEventListener('click', finish);
    root.querySelector('#onbBack').addEventListener('click', function () {
      if (state.index > 0) { state.index -= 1; render(); }
    });
    root.querySelector('#onbNext').addEventListener('click', function () {
      if (state.index < STEPS.length - 1) { state.index += 1; render(); }
      else finish();
    });

    render();
  }

  window.AppOnboarding = {
    open: open,
    isDone: isDone,
    reset: function () {
      try { localStorage.removeItem(DONE_KEY); } catch (_e) { /* ignore */ }
    }
  };

  // First run, home page only.
  var page = (location.pathname.split('/').pop() || 'index.html');
  if ((page === 'index.html' || page === '') && !isDone()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', open);
    } else {
      open();
    }
  }
})();
