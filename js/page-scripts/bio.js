// Load theme settings
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 27, g: 94, b: 32 };
        }

        function loadThemeSettings() {
            const darkMode = localStorage.getItem('darkMode') === 'true';
            if (darkMode) {
                document.documentElement.setAttribute('data-theme', 'dark');
            }

            const color = localStorage.getItem('primaryColor');
            if (color) {
                const lightColor = adjustColor(color, 30);
                document.documentElement.style.setProperty('--primary-color', color);
                document.documentElement.style.setProperty('--primary-light', lightColor);

                // Update shadow colors
                const rgb = hexToRgb(color);
                const shadowLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.25 : 0.15})`;
                const shadowHeavy = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.45 : 0.35})`;
                document.documentElement.style.setProperty('--shadow', shadowLight);
                document.documentElement.style.setProperty('--shadow-heavy', shadowHeavy);
            }

            const fontSize = localStorage.getItem('fontSize');
            if (fontSize !== null) {
                const fontSizes = [12, 14, 16, 18, 20, 24, 28];
                const baseSize = fontSizes[parseInt(fontSize)] || 16;
                document.documentElement.style.setProperty('--font-size-base', baseSize + 'px');
            }

            const fontWeight = localStorage.getItem('fontWeight');
            if (fontWeight) {
                const fontWeights = [300, 400, 500, 600, 700];
                const weight = fontWeights[parseInt(fontWeight)];
                document.documentElement.style.setProperty('--font-weight', weight);
            }
        }

        function adjustColor(color, amount) {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * amount);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255))
                .toString(16).slice(1);
        }

        loadThemeSettings();

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(reg => console.log('SW registered'))
                .catch(err => console.log('SW registration failed'));
        }
