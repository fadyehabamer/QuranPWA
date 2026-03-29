let azkarData = {};
        let currentCategory = null;
        let zikrCounts = {};
        let favorites = [];
        // Load azkar data from JSON file
        async function loadAzkarData() {
            try {
                const response = await fetch('data/azkar.json');
                const jsonData = await response.json();

                // Convert the JSON structure to our expected format
                azkarData = {};
                jsonData.forEach((category, index) => {
                    const key = category.category.replace(/\s+/g, '_').toLowerCase();
                    azkarData[key] = {
                        name: category.category,
                        azkar: category.array.map(item => ({
                            text: item.text,
                            repeat: getCountDescription(item.count),
                            count: item.count
                        }))
                    };
                });

                // Render categories after data is loaded
                renderCategories();
            } catch (error) {
                console.error('Error loading azkar data:', error);
                // Fallback to original data if JSON fails to load
                azkarData = {
                    morning: {
                        name: 'أذكار الصباح',
                        azkar: [
                            {
                                text: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
                                repeat: "مرة واحدة",
                                count: 1
                            }
                        ]
                    }
                };
                renderCategories();
            }
        }

        function getCountDescription(count) {
            const countMap = {
                1: "مرة واحدة",
                3: "ثلاث مرات",
                4: "أربع مرات",
                7: "سبع مرات",
                10: "عشر مرات",
                33: "ثلاث وثلاثون",
                34: "أربع وثلاثون",
                100: "مائة مرة"
            };
            return countMap[count] || `${count} مرة`;
        }

        // Function to extract descriptions from text (looking for content in brackets)
        function extractDescription(text) {
            // Look for content in brackets [...]
            const bracketMatches = text.match(/\[(.*?)\]/g);
            if (bracketMatches && bracketMatches.length > 0) {
                // Join all bracket contents with commas
                return bracketMatches.map(match => match.slice(1, -1)).join(', ');
            }

            // Look for content in parentheses (...)
            const parenMatches = text.match(/\((.*?)\)/g);
            if (parenMatches && parenMatches.length > 0) {
                // Take the first parenthetical content that looks like a description
                for (let match of parenMatches) {
                    const content = match.slice(1, -1);
                    if (content.includes('مرة') || content.includes('مرات') || content.includes('قول') ||
                        content.includes('قال') || content.includes('كان') || content.includes('من')) {
                        return content;
                    }
                }
            }

            return '';
        }

        function loadUserData() {
            const savedCounts = localStorage.getItem('zikrCounts');
            if (savedCounts) {
                zikrCounts = JSON.parse(savedCounts);
            }

            const savedFavorites = localStorage.getItem('azkarFavorites');
            if (savedFavorites) {
                favorites = JSON.parse(savedFavorites);
            }
        }

        function saveUserData() {
            localStorage.setItem('zikrCounts', JSON.stringify(zikrCounts));
            localStorage.setItem('azkarFavorites', JSON.stringify(favorites));
        }

        function renderCategories() {
            const list = document.getElementById('categoryList');

            // Generate icons dynamically based on category names
            function getCategoryIcon(categoryName) {
                const iconMap = {
                    'أذكار الصباح': 'bi-sunrise-fill',
                    'أذكار المساء': 'bi-sunset-fill',
                    'أذكار النوم': 'bi-moon-stars-fill',
                    'أذكار الاستيقاظ': 'bi-alarm-fill',
                    'أذكار الصلاة': 'bi-building',
                    'الأذكار': 'bi-bookmark-star-fill'
                };

                // Default icon if category not found in map
                return iconMap[categoryName] || 'bi-bookmark-star-fill';
            }

            let html = '';

            // Add Favorites Category
            html += `<div class="category-item" onclick="showFavorites()">
                <div class="category-info">
                    <div class="category-icon"><i class="bi bi-heart-fill"></i></div>
                    <div class="category-name">المفضلة</div>
                </div>
                <div class="category-count">${favorites.length}</div>
            </div>`;

            for (const [key, category] of Object.entries(azkarData)) {
                const icon = getCategoryIcon(category.name);
                html += `<div class="category-item" onclick="showCategory('${key}')">
                    <div class="category-info">
                        <div class="category-icon"><i class="bi ${icon}"></i></div>
                        <div class="category-name">${category.name}</div>
                    </div>
                    <div class="category-count">${category.azkar.length}</div>
                </div>`;
            }

            list.innerHTML = html;
        }

        function showCategory(categoryKey) {
            currentCategory = categoryKey;
            const category = azkarData[categoryKey];
            const list = document.getElementById('azkarList');
            let html = '';

            category.azkar.forEach((zikr, index) => {
                const countKey = `${categoryKey}_${index}`;
                const currentCount = zikrCounts[countKey] || 0;
                const targetCount = getTargetCount(zikr.repeat);
                const isCompleted = currentCount >= targetCount;
                const isFav = favorites.some(f => f.text === zikr.text);

                html += `<div class="zikr-card" id="card_${index}">
                    <div class="zikr-text">${zikr.text}</div>
                    <div class="zikr-info">
                        ${extractDescription(zikr.text) ? `<div class="zikr-desc">${extractDescription(zikr.text)}</div>` : ''}
                    </div>
                    <div class="zikr-actions">
                        <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${categoryKey}', ${index})">
                            <i class="bi bi-heart${isFav ? '-fill' : ''}"></i>
                        </button>
                        <div class="zikr-repeat">${zikr.repeat}</div>
                        <button class="zikr-counter-btn ${isCompleted ? 'completed' : ''}"
                            onclick="incrementZikr('${categoryKey}', ${index}, ${targetCount})">
                            ${isCompleted ? '✓' : `${currentCount}/${targetCount}`}
                        </button>
                    </div>
                </div>`;
            });

            list.innerHTML = html;
            document.getElementById('categoryList').style.display = 'none';
            document.getElementById('azkarList').classList.add('active');
            document.getElementById('headerTitle').textContent = category.name;
            document.getElementById('backBtn').style.display = 'flex';
            document.getElementById('menuBtn').style.display = 'none';

            // Show and update progress bar
            document.getElementById('progressContainer').style.display = 'block';
            updateProgressBar();
        }

        function showFavorites() {
            currentCategory = 'favorites';
            const list = document.getElementById('azkarList');

            if (favorites.length === 0) {
                list.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-color);"><i class="bi bi-heart" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 16px;"></i>لا توجد أذكار مفضلة<br><small style="opacity: 0.6;">اضغط على ❤️ لإضافة ذكر للمفضلة</small></div>';
            } else {
                let html = '';
                favorites.forEach((zikr, index) => {
                    html += `<div class="zikr-card">
                        <div class="zikr-text">${zikr.text}</div>
                        <div class="zikr-info">
                            ${extractDescription(zikr.text) ? `<div class="zikr-desc">${extractDescription(zikr.text)}</div>` : ''}
                        </div>
                        <div class="zikr-actions">
                            <button class="favorite-btn active" onclick="removeFromFavorites(${index})">
                                <i class="bi bi-heart-fill"></i>
                            </button>
                            <div class="zikr-repeat">${zikr.repeat || getCountDescription(zikr.count)}</div>
                        </div>
                    </div>`;
                });
                list.innerHTML = html;
            }

            document.getElementById('categoryList').style.display = 'none';
            document.getElementById('azkarList').classList.add('active');
            document.getElementById('headerTitle').textContent = 'المفضلة';
            document.getElementById('backBtn').style.display = 'flex';
            document.getElementById('menuBtn').style.display = 'none';
            document.getElementById('progressContainer').style.display = 'none';
        }

        function showCategories() {
            document.getElementById('categoryList').style.display = 'grid';
            document.getElementById('azkarList').classList.remove('active');
            document.getElementById('headerTitle').textContent = 'الأذكار';
            document.getElementById('backBtn').style.display = 'none';
            document.getElementById('menuBtn').style.display = 'flex';
            document.getElementById('progressContainer').style.display = 'none';
            renderCategories();
        }

        function getTargetCount(repeatText) {
            if (!repeatText) return 1;
            if (repeatText.includes('ثلاث مرات')) return 3;
            if (repeatText.includes('ثلاث وثلاثون')) return 33;
            if (repeatText.includes('أربع وثلاثون')) return 34;
            if (repeatText.includes('سبع مرات')) return 7;
            if (repeatText.includes('أربع مرات')) return 4;
            if (repeatText.includes('مائة مرة')) return 100;
            if (repeatText.includes('عشر مرات')) return 10;

            // Extract number from strings like "5 مرة"
            const match = repeatText.match(/(\d+)\s*(مرة|مرات)/);
            if (match) {
                return parseInt(match[1]);
            }

            return 1;
        }

        function incrementZikr(categoryKey, index, target) {
            const countKey = `${categoryKey}_${index}`;
            let current = zikrCounts[countKey] || 0;
            const btn = document.querySelector(`#card_${index} .zikr-counter-btn`);

            // If already completed, reset the count
            if (current >= target) {
                zikrCounts[countKey] = 0;
                saveUserData();
                btn.textContent = `0/${target}`;
                btn.classList.remove('completed');
                updateProgressBar();
                return;
            }

            current++;
            zikrCounts[countKey] = current;
            saveUserData();

            if (window.recordHabitActivity) {
                window.recordHabitActivity('azkar');
            }

            if (current >= target) {
                btn.textContent = '✓';
                btn.classList.add('completed');
                if (navigator.vibrate) navigator.vibrate(50);
            } else {
                btn.textContent = `${current}/${target}`;
            }

            updateProgressBar();
        }

        function toggleFavorite(categoryKey, index) {
            const zikr = azkarData[categoryKey].azkar[index];
            const favIndex = favorites.findIndex(f => f.text === zikr.text);

            const btn = document.querySelector(`#card_${index} .favorite-btn`);
            const icon = btn.querySelector('i');

            if (favIndex === -1) {
                favorites.push(zikr);
                btn.classList.add('active');
                icon.classList.remove('bi-heart');
                icon.classList.add('bi-heart-fill');
            } else {
                favorites.splice(favIndex, 1);
                btn.classList.remove('active');
                icon.classList.remove('bi-heart-fill');
                icon.classList.add('bi-heart');
            }

            saveUserData();
        }

        function removeFromFavorites(index) {
            favorites.splice(index, 1);
            saveUserData();
            showFavorites();
        }

        function updateProgressBar() {
            if (!currentCategory || currentCategory === 'favorites') return;

            const category = azkarData[currentCategory];
            let totalTarget = 0;
            let totalCurrent = 0;

            category.azkar.forEach((zikr, index) => {
                const target = getTargetCount(zikr.repeat);
                const current = Math.min(zikrCounts[`${currentCategory}_${index}`] || 0, target);
                totalTarget += target;
                totalCurrent += current;
            });

            const percent = Math.round((totalCurrent / totalTarget) * 100) || 0;
            document.getElementById('progressBar').style.width = `${percent}%`;
            document.getElementById('progressPercent').textContent = `${percent}%`;
        }

        // Sidebar Toggle
// Initialize
        loadUserData();
        loadAzkarData();

        // Load theme settings
        (function () {
            const darkMode = localStorage.getItem('darkMode') === 'true';
            if (darkMode) document.documentElement.setAttribute('data-theme', 'dark');

            const color = localStorage.getItem('primaryColor');
            if (color) {
                document.documentElement.style.setProperty('--primary-color', color);
            }

            const fontSize = localStorage.getItem('fontSize');
            if (fontSize !== null) {
                const fontSizes = [12, 14, 16, 18, 20, 24, 28];
                const baseSize = fontSizes[parseInt(fontSize)] || 16;
                document.documentElement.style.setProperty('--font-size-base', baseSize + 'px');
                document.documentElement.style.setProperty('--font-size-ayah', (baseSize + 8) + 'px');
            }
        })();

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
