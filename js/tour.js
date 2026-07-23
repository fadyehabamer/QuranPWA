/* ==========================================================================
   Guided tours — coach marks that introduce each page on first visit.

   Written in-house rather than pulling in driver.js: this app has no bundler
   and ships offline-first, so a CDN <script> would be a network dependency the
   service worker cannot satisfy, and vendoring the library would add ~30KB for
   behaviour this file covers in a fraction of that.

   Usage (classic script, loaded after common.js):
       AppTour.register('quran', [
         { selector: '.quran-tabs', title: '…', text: '…' },
         …
       ]);
   Steps whose target is missing are skipped, so a tour degrades rather than
   breaking when a section is hidden (no location chosen, empty list, …).
   ========================================================================== */
(function () {
  "use strict";

  var SEEN_PREFIX = 'tourSeenV1:';
  var SPOTLIGHT_PADDING = 6;

  var state = {
    steps: [],
    index: 0,
    key: null,
    nodes: null,
    onScroll: null
  };

  function hasSeen(key) {
    try { return localStorage.getItem(SEEN_PREFIX + key) === '1'; }
    catch (_e) { return true; } // storage blocked: never nag
  }

  function markSeen(key) {
    try { localStorage.setItem(SEEN_PREFIX + key, '1'); } catch (_e) { /* ignore */ }
  }

  function resetAll() {
    try {
      Object.keys(localStorage)
        .filter(function (k) { return k.indexOf(SEEN_PREFIX) === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (_e) { /* ignore */ }
  }

  function buildChrome() {
    var overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'tourTitle');

    var spotlight = document.createElement('div');
    spotlight.className = 'tour-spotlight';

    var bubble = document.createElement('div');
    bubble.className = 'tour-bubble';
    bubble.innerHTML =
      '<div class="tour-step-count" id="tourCount"></div>' +
      '<h3 class="tour-title" id="tourTitle"></h3>' +
      '<p class="tour-text" id="tourText"></p>' +
      '<div class="tour-actions">' +
      '  <button type="button" class="tour-btn tour-btn-skip" id="tourSkip">تخطي</button>' +
      '  <div class="tour-nav">' +
      '    <button type="button" class="tour-btn" id="tourPrev">السابق</button>' +
      '    <button type="button" class="tour-btn tour-btn-primary" id="tourNext">التالي</button>' +
      '  </div>' +
      '</div>';

    overlay.appendChild(spotlight);
    overlay.appendChild(bubble);
    document.body.appendChild(overlay);

    return {
      overlay: overlay,
      spotlight: spotlight,
      bubble: bubble,
      count: bubble.querySelector('#tourCount'),
      title: bubble.querySelector('#tourTitle'),
      text: bubble.querySelector('#tourText'),
      skip: bubble.querySelector('#tourSkip'),
      prev: bubble.querySelector('#tourPrev'),
      next: bubble.querySelector('#tourNext')
    };
  }

  function place(step) {
    var n = state.nodes;
    var target = step.selector ? document.querySelector(step.selector) : null;

    if (!target) {
      // Centred card with no cut-out — used for welcome/closing steps.
      n.spotlight.style.opacity = '0';
      n.bubble.style.insetInlineStart = '50%';
      n.bubble.style.insetBlockStart = '50%';
      n.bubble.style.transform = 'translate(50%, -50%)';
      return;
    }

    var rect = target.getBoundingClientRect();
    var pad = SPOTLIGHT_PADDING;

    n.spotlight.style.opacity = '1';
    n.spotlight.style.top = (rect.top - pad) + 'px';
    n.spotlight.style.left = (rect.left - pad) + 'px';
    n.spotlight.style.width = (rect.width + pad * 2) + 'px';
    n.spotlight.style.height = (rect.height + pad * 2) + 'px';

    // Prefer below the target; flip above when it would run off the bottom.
    var bubbleRect = n.bubble.getBoundingClientRect();
    var gap = 14;
    var below = rect.bottom + gap;
    var above = rect.top - gap - bubbleRect.height;
    var top = (below + bubbleRect.height <= window.innerHeight - 12 || above < 12) ? below : above;
    top = Math.max(12, Math.min(top, window.innerHeight - bubbleRect.height - 12));

    n.bubble.style.transform = 'none';
    n.bubble.style.insetInlineStart = '';
    n.bubble.style.top = top + 'px';
    n.bubble.style.left = '12px';
    n.bubble.style.right = '12px';
  }

  function render() {
    var step = state.steps[state.index];
    var n = state.nodes;

    n.count.textContent = (state.index + 1) + ' / ' + state.steps.length;
    n.title.textContent = step.title || '';
    n.text.textContent = step.text || '';
    n.prev.disabled = state.index === 0;
    n.next.textContent = state.index === state.steps.length - 1 ? 'تم' : 'التالي';

    var target = step.selector ? document.querySelector(step.selector) : null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Let the smooth scroll settle before measuring, or the cut-out lands
      // where the target used to be.
      setTimeout(function () { place(step); }, 320);
    } else {
      place(step);
    }
  }

  function go(delta) {
    var next = state.index + delta;
    if (next < 0) return;
    if (next >= state.steps.length) return finish();
    state.index = next;
    render();
  }

  function finish() {
    if (state.key) markSeen(state.key);
    teardown();
  }

  function teardown() {
    if (state.nodes) {
      state.nodes.overlay.remove();
      state.nodes = null;
    }
    if (state.onScroll) {
      window.removeEventListener('resize', state.onScroll);
      window.removeEventListener('scroll', state.onScroll, true);
      state.onScroll = null;
    }
    document.removeEventListener('keydown', onKeydown, true);
    document.body.classList.remove('tour-active');
  }

  function onKeydown(event) {
    if (!state.nodes) return;
    if (event.key === 'Escape') { event.preventDefault(); finish(); }
    // Arrows are mirrored in RTL: "next" is the left arrow.
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); go(-1); }
  }

  function start(key, steps) {
    if (!steps || !steps.length) return;
    teardown();

    // Drop steps whose target is absent right now, but always keep the ones
    // that are deliberately target-less (welcome / closing cards).
    var usable = steps.filter(function (s) {
      return !s.selector || document.querySelector(s.selector);
    });
    if (!usable.length) return;

    state.steps = usable;
    state.index = 0;
    state.key = key;
    state.nodes = buildChrome();
    document.body.classList.add('tour-active');

    state.nodes.skip.addEventListener('click', finish);
    state.nodes.prev.addEventListener('click', function () { go(-1); });
    state.nodes.next.addEventListener('click', function () { go(1); });
    // Captured, not read off `state` — teardown nulls `state.nodes`, and the
    // listener still fires once more on the click that closed the tour.
    var overlay = state.nodes.overlay;
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) finish();
    });
    document.addEventListener('keydown', onKeydown, true);

    state.onScroll = function () {
      if (state.nodes) place(state.steps[state.index]);
    };
    window.addEventListener('resize', state.onScroll);
    window.addEventListener('scroll', state.onScroll, true);

    render();
    state.nodes.next.focus();
  }

  /**
   * Register a page's tour. Runs it automatically the first time that page is
   * opened; afterwards it only runs when replayed from settings.
   */
  function register(key, steps, options) {
    var opts = options || {};
    window.AppTour.tours[key] = steps;
    mountHelpButton(key);

    if (opts.skipAutoStart) return;

    if (opts.force || !hasSeen(key)) {
      // Wait for the page's own async rendering (surah list, prayer times) so
      // the targets exist before the first step measures them.
      var delay = typeof opts.delay === 'number' ? opts.delay : 900;
      setTimeout(function () { start(key, steps); }, delay);
    }
  }

  function replay(key) {
    var steps = window.AppTour.tours[key];
    if (steps) start(key, steps);
  }

  /**
   * Floating help button, so a tour can be replayed at any time instead of only
   * on first visit. Rendered only on pages that actually registered a tour.
   */
  function mountHelpButton(key) {
    if (document.querySelector('.tour-help-btn')) return;

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'tour-help-btn';
    button.setAttribute('aria-label', 'شرح هذه الصفحة');
    button.title = 'شرح هذه الصفحة';
    button.innerHTML = '<i class="bi bi-question-lg" aria-hidden="true"></i>';
    button.addEventListener('click', function () { replay(key); });

    document.body.appendChild(button);
  }

  window.AppTour = {
    tours: {},
    register: register,
    start: start,
    mountHelpButton: mountHelpButton,
    replay: replay,
    hasSeen: hasSeen,
    resetAll: resetAll
  };
})();
