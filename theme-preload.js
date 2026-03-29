(function preloadTheme() {
  var root = document.documentElement;

  try {
    var darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.removeAttribute('data-theme');
      root.style.colorScheme = 'light';
    }

    var primaryColor = localStorage.getItem('primaryColor');
    if (primaryColor) {
      root.style.setProperty('--primary-color', primaryColor);
    }
  } catch (_error) {
    // Ignore storage access errors (e.g., strict privacy mode).
  }
})();
