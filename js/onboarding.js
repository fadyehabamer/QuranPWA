/* ==========================================================================
   First-run onboarding.

   Three intro screens followed by a setup screen where the reader picks their
   accent colour, Quran font, mushaf display mode and location before ever
   seeing the app. Previously the app just fired a bare geolocation prompt on
   first load with no explanation of why it wanted the permission.

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

  var ACCENTS = [
    { hex: '#1B5E20', label: 'أخضر' },
    { hex: '#2196F3', label: 'أزرق' },
    { hex: '#9C27B0', label: 'بنفسجي' },
    { hex: '#FF5722', label: 'برتقالي' },
    { hex: '#795548', label: 'بني' },
    { hex: '#607D8B', label: 'رمادي' }
  ];

  var INTRO_SLIDES = [
    {
      icon: 'bi-book-half',
      title: 'المصحف كاملاً بين يديك',
      text: 'اقرأ نصاً أو بصور المصحف، مع التفسير والاستماع لأي آية، وتتبّع لموضع قراءتك.'
    },
    {
      icon: 'bi-clock-history',
      title: 'مواقيت صلاتك',
      text: 'الصلاة القادمة والوقت المتبقي لها، وأوقات الكراهة، واتجاه القبلة من موقعك.'
    },
    {
      icon: 'bi-stars',
      title: 'وردك اليومي',
      text: 'الأذكار والمسبحة ومتابعة الصلوات والختمة — كلها تعمل بلا إنترنت.'
    }
  ];

  var state = { index: 0, root: null };
  var TOTAL_STEPS = INTRO_SLIDES.length + 1; // intro slides + the setup screen

  function read(key, fallback) {
    try { return localStorage.getItem(key) || fallback; }
    catch (_e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (_e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------- render */

  function introMarkup(slide) {
    return '' +
      '<div class="onb-hero"><i class="bi ' + slide.icon + '" aria-hidden="true"></i></div>' +
      '<h2 class="onb-title">' + slide.title + '</h2>' +
      '<p class="onb-text">' + slide.text + '</p>';
  }

  function setupMarkup() {
    var accent = read('primaryColor', '#1B5E20');
    var font = read('quranFontFamily', 'amiri');
    var mode = read('quranReaderDisplayModeV1', 'text');
    var fonts = window.QURAN_FONTS || {};

    var accents = ACCENTS.map(function (option) {
      return '<button type="button" class="onb-swatch' + (option.hex === accent ? ' is-active' : '') + '"' +
        ' style="background:' + option.hex + '" data-accent="' + option.hex + '"' +
        ' aria-label="' + option.label + '" aria-pressed="' + (option.hex === accent) + '"></button>';
    }).join('');

    var fontOptions = Object.keys(fonts).map(function (key) {
      return '<button type="button" class="onb-chip' + (key === font ? ' is-active' : '') + '"' +
        ' data-font="' + key + '" style="font-family:' + fonts[key].stack + '"' +
        ' aria-pressed="' + (key === font) + '">' + fonts[key].label + '</button>';
    }).join('');

    return '' +
      '<h2 class="onb-title">لنُجهّز التطبيق لك</h2>' +
      '<p class="onb-text">يمكنك تغيير كل هذا لاحقاً من الإعدادات.</p>' +

      '<div class="onb-field">' +
      '  <span class="onb-label">لون التطبيق</span>' +
      '  <div class="onb-swatches" id="onbAccents">' + accents + '</div>' +
      '</div>' +

      '<div class="onb-field">' +
      '  <span class="onb-label">خط المصحف</span>' +
      '  <div class="onb-chips" id="onbFonts">' + fontOptions + '</div>' +
      '</div>' +

      '<div class="onb-field">' +
      '  <span class="onb-label">طريقة عرض المصحف</span>' +
      '  <div class="onb-chips" id="onbModes">' +
      '    <button type="button" class="onb-chip' + (mode !== 'mushaf' ? ' is-active' : '') + '"' +
      '      data-mode="text" aria-pressed="' + (mode !== 'mushaf') + '">نص</button>' +
      '    <button type="button" class="onb-chip' + (mode === 'mushaf' ? ' is-active' : '') + '"' +
      '      data-mode="mushaf" aria-pressed="' + (mode === 'mushaf') + '">صور المصحف</button>' +
      '  </div>' +
      '</div>' +

      '<div class="onb-field">' +
      '  <span class="onb-label">موقعك</span>' +
      '  <p class="onb-hint">نستخدمه لحساب مواقيت الصلاة واتجاه القبلة فقط، ولا يُرسل لأي جهة أخرى.</p>' +
      '  <button type="button" class="onb-location-btn" id="onbLocationBtn">' +
      '    <i class="bi bi-crosshair" aria-hidden="true"></i><span id="onbLocationLabel">تحديد موقعي تلقائياً</span>' +
      '  </button>' +
      '  <p class="onb-location-state" id="onbLocationState"></p>' +
      '</div>';
  }

  function render() {
    var isSetup = state.index === INTRO_SLIDES.length;
    var body = state.root.querySelector('.onb-body');
    var dots = state.root.querySelector('.onb-dots');
    var next = state.root.querySelector('#onbNext');
    var back = state.root.querySelector('#onbBack');

    body.innerHTML = isSetup ? setupMarkup() : introMarkup(INTRO_SLIDES[state.index]);
    body.scrollTop = 0;
    // The class belongs on the card — `.onb-card.is-setup` is what the
    // stylesheet targets; putting it on the overlay silently did nothing.
    state.root.querySelector('.onb-card').classList.toggle('is-setup', isSetup);

    dots.innerHTML = Array.apply(null, { length: TOTAL_STEPS }).map(function (_v, i) {
      return '<span class="onb-dot' + (i === state.index ? ' is-active' : '') + '"></span>';
    }).join('');

    next.textContent = isSetup ? 'ابدأ' : 'التالي';
    back.style.visibility = state.index === 0 ? 'hidden' : 'visible';

    if (isSetup) bindSetup();
  }

  /* ----------------------------------------------------------- setup wiring */

  function selectIn(container, selected) {
    Array.prototype.forEach.call(container.children, function (child) {
      var isActive = child === selected;
      child.classList.toggle('is-active', isActive);
      child.setAttribute('aria-pressed', String(isActive));
    });
  }

  function bindSetup() {
    var accents = state.root.querySelector('#onbAccents');
    accents.addEventListener('click', function (event) {
      var button = event.target.closest('[data-accent]');
      if (!button) return;
      var hex = button.getAttribute('data-accent');
      write('primaryColor', hex);
      // Repaint immediately so the choice is visible while still choosing.
      if (window.applyAccentColor) {
        window.applyAccentColor(hex, document.documentElement.getAttribute('data-theme') === 'dark');
      }
      selectIn(accents, button);
    });

    var fonts = state.root.querySelector('#onbFonts');
    if (fonts) {
      fonts.addEventListener('click', function (event) {
        var button = event.target.closest('[data-font]');
        if (!button) return;
        write('quranFontFamily', button.getAttribute('data-font'));
        if (window.syncQuranFont) window.syncQuranFont();
        selectIn(fonts, button);
      });
    }

    var modes = state.root.querySelector('#onbModes');
    modes.addEventListener('click', function (event) {
      var button = event.target.closest('[data-mode]');
      if (!button) return;
      write('quranReaderDisplayModeV1', button.getAttribute('data-mode'));
      selectIn(modes, button);
    });

    var locationBtn = state.root.querySelector('#onbLocationBtn');
    var locationState = state.root.querySelector('#onbLocationState');

    // Already granted on a previous run? Say so instead of asking again.
    var existing = read('locationText', '');
    if (existing) {
      locationState.textContent = 'الموقع الحالي: ' + existing;
      locationState.className = 'onb-location-state is-ok';
    }

    locationBtn.addEventListener('click', function () {
      if (!navigator.geolocation) {
        locationState.textContent = 'خدمة الموقع غير متاحة على هذا الجهاز — يمكنك اختيار دولتك يدوياً لاحقاً.';
        locationState.className = 'onb-location-state is-error';
        return;
      }

      locationState.textContent = 'جاري تحديد موقعك…';
      locationState.className = 'onb-location-state';
      locationBtn.disabled = true;

      navigator.geolocation.getCurrentPosition(
        function (position) {
          write('userLocation', JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }));
          write('locationText', 'موقعك الحالي');
          locationState.textContent = 'تم تحديد موقعك بنجاح';
          locationState.className = 'onb-location-state is-ok';
          locationBtn.disabled = false;
        },
        function () {
          // A refusal is a valid outcome; manual country choice still works.
          locationState.textContent = 'لم يُسمح بالوصول للموقع. يمكنك اختيار دولتك يدوياً من صفحة المواقيت.';
          locationState.className = 'onb-location-state is-error';
          locationBtn.disabled = false;
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });
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
    root.className = 'onb-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'إعداد التطبيق');
    root.innerHTML =
      '<div class="onb-card">' +
      '  <button type="button" class="onb-skip" id="onbSkip">تخطي</button>' +
      '  <div class="onb-body"></div>' +
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
      if (state.index < TOTAL_STEPS - 1) { state.index += 1; render(); }
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
