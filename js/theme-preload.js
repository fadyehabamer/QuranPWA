/* Runs before first paint so the page never flashes the wrong theme. */
(function preloadTheme() {
  var root = document.documentElement;

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16)
    ];
  }

  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }

  function mix(rgb, target, amount) {
    return rgb.map(function (v, i) { return v + (target[i] - v) * amount; });
  }

  function luminance(rgb) {
    var c = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var l1 = luminance(a);
    var l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  var WHITE = [255, 255, 255];
  var BLACK = [0, 0, 0];
  var ACCENT_PROPS = [
    '--primary-color', '--primary-light', '--primary-dark',
    '--primary-rgb', '--on-primary'
  ];

  /**
   * Apply a user-chosen accent as a complete set of derived tokens.
   *
   * The previous version set only `--primary-color`, inline on <html>. That
   * caused two real defects:
   *   1. The inline value outranks the `[data-theme="dark"]` rule, so a dark
   *      accent stayed dark in dark mode and text on it fell to ~2:1.
   *   2. `--primary-rgb` was never updated, so every `rgba(var(--primary-rgb))`
   *      tint in the app kept painting the default green whatever the user
   *      picked.
   */
  function applyAccent(hex, isDark) {
    var base = hexToRgb(hex);
    if (!base) return;

    var INK = [10, 28, 13];

    // Keep the accent legible against the current canvas: lift dark accents
    // in dark mode, deepen very light ones in light mode.
    var tuned = base;
    var lum = luminance(base);
    if (isDark && lum < 0.22) {
      tuned = mix(base, WHITE, 0.42);
    } else if (!isDark && lum > 0.62) {
      tuned = mix(base, BLACK, 0.25);
    }

    // Mid-tone accents (e.g. blue-grey) can fail against BOTH black and white
    // — #607D8B measured 4.37 on white and 4.33 on ink. Nudge the fill away
    // from the midpoint until one foreground clears 4.5:1.
    var toward = isDark ? WHITE : BLACK;
    for (var step = 0; step < 12; step++) {
      if (Math.max(contrast(tuned, INK), contrast(tuned, WHITE)) >= 4.5) break;
      tuned = mix(tuned, toward, 0.08);
    }

    root.style.setProperty('--primary-color', toHex(tuned));
    root.style.setProperty('--primary-light', toHex(mix(tuned, WHITE, 0.18)));
    root.style.setProperty('--primary-dark', toHex(mix(tuned, BLACK, 0.22)));
    root.style.setProperty('--primary-rgb', tuned.map(Math.round).join(', '));

    // Text on the accent: measure both candidates and take the better one.
    // A fixed luminance cutoff got this wrong for mid-tone accents — a lifted
    // green measured 2.87:1 against white but 6.2:1 against near-black.
    root.style.setProperty(
      '--on-primary',
      contrast(tuned, INK) >= contrast(tuned, WHITE) ? toHex(INK) : '#ffffff'
    );
  }

  function clearAccent() {
    ACCENT_PROPS.forEach(function (prop) { root.style.removeProperty(prop); });
  }

  function syncTheme() {
    var isDark = false;
    try {
      isDark = localStorage.getItem('darkMode') === 'true';
    } catch (_e) { /* storage blocked */ }

    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.removeAttribute('data-theme');
      root.style.colorScheme = 'light';
    }

    try {
      var accent = localStorage.getItem('primaryColor');
      if (accent) {
        applyAccent(accent, isDark);
      } else {
        // No custom accent: drop the inline overrides so the stylesheet's own
        // light/dark values apply.
        clearAccent();
      }
    } catch (_e) { /* storage blocked */ }
  }

  syncTheme();

  // Exposed so the settings page can re-derive the whole palette when the
  // accent OR the theme changes, instead of setting --primary-color alone.
  window.applyAccentColor = applyAccent;
  window.syncAppTheme = syncTheme;
  window.clearAccentColor = clearAccent;
})();
