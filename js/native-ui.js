/* ==========================================================================
   Native mobile shell behaviour.

   Pairs with css/native.css. Adds the large collapsing title and keeps the
   `data-scrolled` flag on <body> that drives the header crossfade.
   ========================================================================== */

(function (window, document) {
  'use strict';

  var PHONE = '(max-width: 768px)';

  function isPhone() {
    return window.matchMedia(PHONE).matches;
  }

  /* ----------------------------------------------------------------------
     Large title

     The compact header keeps the accessible <h1>. The large title is a
     visual duplicate of it, so it is marked aria-hidden — otherwise every
     screen would announce its name twice.
     ---------------------------------------------------------------------- */
  function mountLargeTitle() {
    if (document.querySelector('.large-title-bar')) return;

    var header = document.querySelector('.app-header');
    var main = document.querySelector('main, .app-content');
    if (!header || !main) return;

    var heading = header.querySelector('h1');
    var text = heading && heading.textContent.trim();
    if (!text) return;

    var bar = document.createElement('div');
    bar.className = 'large-title-bar';
    bar.setAttribute('aria-hidden', 'true');

    var title = document.createElement('div');
    title.className = 'large-title';
    title.textContent = text;
    bar.appendChild(title);

    // Inserting a block at the top of the document triggers Chrome's scroll
    // anchoring, which scrolls down by the inserted height to keep the
    // previously-anchored content in place. That instantly collapsed the very
    // title being added. If the user was at the top, put them back there.
    var wasAtTop = window.scrollY < 2;
    main.insertBefore(bar, main.firstChild);
    if (wasAtTop) {
      window.scrollTo(0, 0);
    }

    // Pages that retitle their header at runtime (azkar, sunan, quran) need
    // the large title to follow.
    if (heading) {
      new MutationObserver(function () {
        var next = heading.textContent.trim();
        if (next && next !== title.textContent) title.textContent = next;
      }).observe(heading, { childList: true, characterData: true, subtree: true });
    }
  }

  function removeLargeTitle() {
    var bar = document.querySelector('.large-title-bar');
    if (bar) bar.remove();
  }

  /* ----------------------------------------------------------------------
     Scroll state
     ---------------------------------------------------------------------- */
  var ticking = false;

  function readScroll() {
    ticking = false;
    // Switch once the large title has essentially left the viewport.
    var threshold = 28;
    var scrolled = window.scrollY > threshold;
    if (document.body.getAttribute('data-scrolled') !== String(scrolled)) {
      document.body.setAttribute('data-scrolled', String(scrolled));
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(readScroll);
  }

  /* ----------------------------------------------------------------------
     Setup
     ---------------------------------------------------------------------- */
  function sync() {
    if (isPhone()) {
      mountLargeTitle();
      readScroll();
    } else {
      removeLargeTitle();
      // Desktop keeps its header title visible unconditionally.
      document.body.setAttribute('data-scrolled', 'true');
    }
  }

  function init() {
    sync();
    window.addEventListener('scroll', onScroll, { passive: true });

    var mq = window.matchMedia(PHONE);
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else if (mq.addListener) mq.addListener(sync);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
