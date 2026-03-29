function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 27, g: 94, b: 32 };
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

        function loadThemeSettings() {
            const darkMode = localStorage.getItem('darkMode') === 'true';
            if (darkMode) {
                document.documentElement.setAttribute('data-theme', 'dark');
            }

            const color = localStorage.getItem('primaryColor');
            const selectedColor = color || '#1B5E20';
            const rgb = hexToRgb(selectedColor);

            document.documentElement.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

            if (color) {
                const lightColor = adjustColor(color, 30);
                document.documentElement.style.setProperty('--primary-color', color);
                document.documentElement.style.setProperty('--primary-light', lightColor);

                const shadowLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.25 : 0.15})`;
                const shadowHeavy = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.45 : 0.35})`;
                document.documentElement.style.setProperty('--shadow', shadowLight);
                document.documentElement.style.setProperty('--shadow-heavy', shadowHeavy);
            }

            const fontSize = localStorage.getItem('fontSize');
            if (fontSize !== null) {
                const fontSizes = [12, 14, 16, 18, 20, 24, 28];
                const baseSize = fontSizes[parseInt(fontSize, 10)] || 16;
                document.documentElement.style.setProperty('--font-size-base', baseSize + 'px');
                document.documentElement.style.setProperty('--font-size-ayah', (baseSize + 8) + 'px');
                document.documentElement.style.setProperty('--font-size-header', (baseSize + 6) + 'px');
            }

            const fontWeight = localStorage.getItem('fontWeight');
            if (fontWeight !== null) {
                const fontWeights = [300, 400, 500, 600, 700];
                const selectedWeight = fontWeights[parseInt(fontWeight, 10)] || 400;
                document.documentElement.style.setProperty('--font-weight', selectedWeight);
            }
        }

        function updateFeatureStats() {
            const sectionCount = document.querySelectorAll('.feature-section').length;
            const featureCount = document.querySelectorAll('.feature-item').length;
            const pageLinksCount = document.querySelectorAll('.quick-link-card').length;

            document.getElementById('sectionsCount').textContent = sectionCount;
            document.getElementById('featuresCount').textContent = featureCount;
            document.getElementById('pagesCount').textContent = pageLinksCount;
        }

        function normalizeText(value) {
            return String(value || '')
                .toLowerCase()
                .normalize('NFKD')
                .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
                .replace(/[إأآٱ]/g, 'ا')
                .replace(/ى/g, 'ي')
                .replace(/ؤ/g, 'و')
                .replace(/ئ/g, 'ي')
                .replace(/ة/g, 'ه')
                .trim();
        }

        function filterFeatures() {
            const query = normalizeText(document.getElementById('featureSearch').value);
            const sections = Array.from(document.querySelectorAll('.feature-section'));
            let visibleCount = 0;

            sections.forEach(section => {
                const text = normalizeText(section.textContent + ' ' + (section.getAttribute('data-keywords') || ''));
                const matched = !query || text.includes(query);
                section.classList.toggle('hidden-by-filter', !matched);
                if (matched) visibleCount += 1;
            });

            const emptyState = document.getElementById('emptyFilterState');
            const hint = document.getElementById('resultsHint');
            if (emptyState) {
                emptyState.classList.toggle('active', visibleCount === 0);
            }
            if (hint) {
                hint.textContent = query
                    ? `النتائج: ${visibleCount} قسم مطابق`
                    : 'اكتب كلمة للفلترة داخل جميع الأقسام.';
            }
        }

        loadThemeSettings();
        updateFeatureStats();

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
