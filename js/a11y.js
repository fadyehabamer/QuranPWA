/* ==========================================================================
   Shared accessibility helpers.

   Loaded on every page before common.js. Provides the dialog behaviour the
   app's six overlay surfaces were all missing: focus trapping, focus restore,
   Escape-to-close, background inerting and scroll locking.
   ========================================================================== */

(function (window, document) {
  'use strict';

  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  /* Stack so nested dialogs unwind in the right order. */
  var openLayers = [];

  function focusableWithin(root) {
    if (!root) return [];
    return Array.prototype.filter.call(
      root.querySelectorAll(FOCUSABLE),
      function (el) {
        // offsetParent is null for display:none; also skip visibility:hidden.
        return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
      }
    );
  }

  function lockScroll() {
    if (document.body.hasAttribute('data-scroll-locked')) return;
    var y = window.scrollY;
    document.body.setAttribute('data-scroll-locked', String(y));
    document.body.style.position = 'fixed';
    document.body.style.insetInlineStart = '0';
    document.body.style.width = '100%';
    document.body.style.top = -y + 'px';
  }

  function unlockScroll() {
    if (!document.body.hasAttribute('data-scroll-locked')) return;
    var y = parseInt(document.body.getAttribute('data-scroll-locked'), 10) || 0;
    document.body.removeAttribute('data-scroll-locked');
    document.body.style.position = '';
    document.body.style.insetInlineStart = '';
    document.body.style.width = '';
    document.body.style.top = '';
    window.scrollTo(0, y);
  }

  /* Hide everything outside the dialog from assistive tech. `inert` also
     removes descendants from the tab order where supported. */
  function inertSiblings(el, on) {
    var node = el;
    while (node && node !== document.body) {
      var parent = node.parentElement;
      if (!parent) break;
      Array.prototype.forEach.call(parent.children, function (sibling) {
        if (sibling === node) return;
        if (on) {
          if (sibling.hasAttribute('aria-hidden')) {
            sibling.setAttribute('data-a11y-prev-hidden', sibling.getAttribute('aria-hidden'));
          }
          sibling.setAttribute('aria-hidden', 'true');
          sibling.inert = true;
        } else {
          if (sibling.hasAttribute('data-a11y-prev-hidden')) {
            sibling.setAttribute('aria-hidden', sibling.getAttribute('data-a11y-prev-hidden'));
            sibling.removeAttribute('data-a11y-prev-hidden');
          } else {
            sibling.removeAttribute('aria-hidden');
          }
          sibling.inert = false;
        }
      });
      node = parent;
    }
  }

  function onKeydown(event) {
    var layer = openLayers[openLayers.length - 1];
    if (!layer) return;

    if (event.key === 'Escape' || event.key === 'Esc') {
      if (layer.closeOnEscape === false) return;
      event.preventDefault();
      event.stopPropagation();
      closeDialog(layer.element);
      return;
    }

    if (event.key !== 'Tab') return;

    var items = focusableWithin(layer.panel || layer.element);
    if (!items.length) {
      // Nothing focusable inside — keep focus on the panel itself.
      event.preventDefault();
      (layer.panel || layer.element).focus();
      return;
    }

    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;

    if (event.shiftKey && (active === first || !(layer.panel || layer.element).contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Open an element as a modal dialog.
   * @param {Element} element  the overlay/backdrop element
   * @param {Object}  [opts]
   * @param {Element} [opts.panel]        inner panel that receives focus
   * @param {Element} [opts.initialFocus] element to focus on open
   * @param {Function}[opts.onClose]      called after close
   * @param {boolean} [opts.closeOnEscape=true]
   * @param {boolean} [opts.lockScroll=true]
   */
  function openDialog(element, opts) {
    if (!element || openLayers.some(function (l) { return l.element === element; })) return;
    opts = opts || {};

    var panel = opts.panel
      || element.querySelector('.dialog-panel, .modal, .modal-content')
      || element;

    element.setAttribute('role', element.getAttribute('role') || 'dialog');
    element.setAttribute('aria-modal', 'true');
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    if (panel !== element && !panel.hasAttribute('tabindex')) {
      panel.setAttribute('tabindex', '-1');
    }

    var layer = {
      element: element,
      panel: panel,
      previousFocus: document.activeElement,
      onClose: opts.onClose,
      closeOnEscape: opts.closeOnEscape !== false,
      lockedScroll: opts.lockScroll !== false
    };

    if (openLayers.length === 0) {
      document.addEventListener('keydown', onKeydown, true);
    }
    openLayers.push(layer);

    if (layer.lockedScroll) lockScroll();
    inertSiblings(element, true);

    // Defer so the element is visible before we move focus into it.
    window.requestAnimationFrame(function () {
      var target = opts.initialFocus || focusableWithin(panel)[0] || panel;
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    });
  }

  function closeDialog(element) {
    var index = -1;
    for (var i = openLayers.length - 1; i >= 0; i--) {
      if (openLayers[i].element === element) { index = i; break; }
    }
    if (index === -1) return;

    var layer = openLayers.splice(index, 1)[0];

    inertSiblings(layer.element, false);
    layer.element.removeAttribute('aria-modal');

    if (openLayers.length === 0) {
      document.removeEventListener('keydown', onKeydown, true);
      if (layer.lockedScroll) unlockScroll();
    }

    // Return focus where the user left it.
    if (layer.previousFocus && document.contains(layer.previousFocus)) {
      try {
        layer.previousFocus.focus({ preventScroll: true });
      } catch (e) {
        layer.previousFocus.focus();
      }
    }

    if (typeof layer.onClose === 'function') layer.onClose();
  }

  function isDialogOpen(element) {
    if (!element) return openLayers.length > 0;
    return openLayers.some(function (l) { return l.element === element; });
  }

  /**
   * Make a non-semantic element behave like a button for keyboard users.
   * Used for the legacy `<div onclick>` controls that could not be reached
   * by keyboard at all.
   */
  function makeActivatable(el, handler, opts) {
    if (!el || el.hasAttribute('data-a11y-activatable')) return;
    opts = opts || {};
    el.setAttribute('data-a11y-activatable', '');
    el.setAttribute('role', opts.role || 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');

    el.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      // Let real controls inside handle their own keys.
      if (event.target !== el && event.target.closest(FOCUSABLE) !== el) return;
      event.preventDefault();
      if (typeof handler === 'function') handler.call(el, event);
      else el.click();
    });
  }

  /**
   * Announce a message to screen readers without moving focus.
   */
  function announce(message, assertive) {
    var id = assertive ? 'a11y-live-assertive' : 'a11y-live-polite';
    var region = document.getElementById(id);
    if (!region) {
      region = document.createElement('div');
      region.id = id;
      region.className = 'sr-only';
      region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
      region.setAttribute('aria-atomic', 'true');
      document.body.appendChild(region);
    }
    // Clearing first forces re-announcement of an identical message.
    region.textContent = '';
    window.setTimeout(function () { region.textContent = message; }, 50);
  }

  window.A11y = {
    openDialog: openDialog,
    closeDialog: closeDialog,
    isDialogOpen: isDialogOpen,
    makeActivatable: makeActivatable,
    announce: announce,
    focusableWithin: focusableWithin,
    lockScroll: lockScroll,
    unlockScroll: unlockScroll
  };
})(window, document);
