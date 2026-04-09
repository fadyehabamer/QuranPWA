let azkarData = {};
let currentCategory = null;
let zikrCounts = {};
let favorites = [];
let currentViewMode = localStorage.getItem('azkarViewMode') || 'swipe';
let currentSwipeIndex = 0;
let swipeStartX = 0;
let swipeTracking = false;
let swipeAnimating = false;

// Load azkar data from JSON file
async function loadAzkarData() {
    try {
        const response = await fetch('data/azkar.json');
        const jsonData = await response.json();

        // Convert the JSON structure to our expected format
        azkarData = {};
        jsonData.forEach((category) => {
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

        renderCategories();
    } catch (error) {
        console.error('Error loading azkar data:', error);
        // Fallback to original data if JSON fails to load
        azkarData = {
            morning: {
                name: 'أذكار الصباح',
                azkar: [
                    {
                        text: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
                        repeat: 'مرة واحدة',
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
        1: 'مرة واحدة',
        3: 'ثلاث مرات',
        4: 'أربع مرات',
        7: 'سبع مرات',
        10: 'عشر مرات',
        33: 'ثلاث وثلاثون',
        34: 'أربع وثلاثون',
        100: 'مائة مرة'
    };
    return countMap[count] || `${count} مرة`;
}

function extractDescription(text) {
    const bracketMatches = text.match(/\[(.*?)\]/g);
    if (bracketMatches && bracketMatches.length > 0) {
        return bracketMatches.map(match => match.slice(1, -1)).join(', ');
    }

    const parenMatches = text.match(/\((.*?)\)/g);
    if (parenMatches && parenMatches.length > 0) {
        for (const match of parenMatches) {
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
    try {
        const savedCounts = localStorage.getItem('zikrCounts');
        if (savedCounts) {
            zikrCounts = JSON.parse(savedCounts);
        }

        const savedFavorites = localStorage.getItem('azkarFavorites');
        if (savedFavorites) {
            favorites = JSON.parse(savedFavorites);
        }
    } catch (error) {
        console.error('Error loading azkar user data:', error);
        zikrCounts = {};
        favorites = [];
    }
}

function saveUserData() {
    localStorage.setItem('zikrCounts', JSON.stringify(zikrCounts));
    localStorage.setItem('azkarFavorites', JSON.stringify(favorites));
}

function setViewModeButtonVisibility(visible) {
    const btn = document.getElementById('viewModeBtn');
    if (!btn) return;
    btn.style.display = visible ? 'flex' : 'none';
}

function updateViewModeButton() {
    const btn = document.getElementById('viewModeBtn');
    if (!btn) return;

    const icon = btn.querySelector('i');
    const label = btn.querySelector('.view-mode-label');

    if (currentViewMode === 'swipe') {
        icon.className = 'bi bi-list-ul';
        label.textContent = 'قائمة';
        btn.title = 'عرض القائمة';
    } else {
        icon.className = 'bi bi-view-stacked';
        label.textContent = 'بطاقات';
        btn.title = 'عرض البطاقات';
    }
}

function toggleViewMode() {
    currentViewMode = currentViewMode === 'list' ? 'swipe' : 'list';
    localStorage.setItem('azkarViewMode', currentViewMode);
    updateViewModeButton();

    if (currentCategory) {
        renderCurrentCategoryView();
    }
}

function renderCategories() {
    const list = document.getElementById('categoryList');

    function getCategoryIcon(categoryName) {
        const iconMap = {
            'أذكار الصباح': 'bi-sunrise-fill',
            'أذكار المساء': 'bi-sunset-fill',
            'أذكار النوم': 'bi-moon-stars-fill',
            'أذكار الاستيقاظ': 'bi-alarm-fill',
            'أذكار الصلاة': 'bi-building',
            'الأذكار': 'bi-bookmark-star-fill'
        };

        return iconMap[categoryName] || 'bi-bookmark-star-fill';
    }

    let html = '';

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

function renderCategoryCard(categoryKey, zikr, index) {
    const countKey = `${categoryKey}_${index}`;
    const currentCount = zikrCounts[countKey] || 0;
    const targetCount = getTargetCount(zikr.repeat);
    const isCompleted = currentCount >= targetCount;
    const isFav = favorites.some(f => f.text === zikr.text);
    const description = extractDescription(zikr.text);

    return `<div class="zikr-card" id="card_${index}">
        <div class="zikr-text">${zikr.text}</div>
        <div class="zikr-info">
            ${description ? `<div class="zikr-desc">${description}</div>` : ''}
        </div>
        <div class="zikr-actions">
            <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${categoryKey}', ${index})">
                <i class="bi bi-heart${isFav ? '-fill' : ''}"></i>
            </button>
            <div class="zikr-repeat">${zikr.repeat}</div>
            <button class="zikr-counter-btn ${isCompleted ? 'completed' : ''}" onclick="incrementZikr('${categoryKey}', ${index}, ${targetCount})">
                ${isCompleted ? '✓' : `${currentCount}/${targetCount}`}
            </button>
        </div>
    </div>`;
}

function renderFavoriteCard(zikr, index) {
    const description = extractDescription(zikr.text);
    return `<div class="zikr-card" id="card_${index}">
        <div class="zikr-text">${zikr.text}</div>
        <div class="zikr-info">
            ${description ? `<div class="zikr-desc">${description}</div>` : ''}
        </div>
        <div class="zikr-actions">
            <button class="favorite-btn active" onclick="removeFromFavorites(${index})">
                <i class="bi bi-heart-fill"></i>
            </button>
            <div class="zikr-repeat">${zikr.repeat || getCountDescription(zikr.count)}</div>
        </div>
    </div>`;
}

function renderCategoryList(categoryKey) {
    const list = document.getElementById('azkarList');
    const category = azkarData[categoryKey];
    let html = '';

    category.azkar.forEach((zikr, index) => {
        html += renderCategoryCard(categoryKey, zikr, index);
    });

    list.innerHTML = html;
}

function renderCategorySwipe(categoryKey) {
    const list = document.getElementById('azkarList');
    const category = azkarData[categoryKey];
    const total = category.azkar.length;

    if (total === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-color);">لا توجد أذكار في هذا القسم</div>';
        return;
    }

    currentSwipeIndex = Math.max(0, Math.min(currentSwipeIndex, total - 1));
    const zikr = category.azkar[currentSwipeIndex];

    list.innerHTML = `<div class="swipe-view">
        <div class="swipe-meta">
            <span>بطاقة ${currentSwipeIndex + 1} من ${total}</span>
            <span>اسحب يميناً ويساراً</span>
        </div>
        <div class="swipe-area">
            ${renderCategoryCard(categoryKey, zikr, currentSwipeIndex).replace('zikr-card', 'zikr-card swipe-card')}
        </div>
        <div class="swipe-hint">تحريك يمين: التالي | تحريك يسار: السابق</div>
        <div class="swipe-nav">
            <button class="swipe-nav-btn" onclick="goToPreviousCard()" ${currentSwipeIndex === 0 ? 'disabled' : ''}>السابق</button>
            <button class="swipe-nav-btn" onclick="goToNextCard()" ${currentSwipeIndex === total - 1 ? 'disabled' : ''}>التالي</button>
        </div>
    </div>`;

    bindSwipeGesture();
}

function renderFavoritesList() {
    const list = document.getElementById('azkarList');

    if (favorites.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-color);"><i class="bi bi-heart" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 16px;"></i>لا توجد أذكار مفضلة<br><small style="opacity: 0.6;">اضغط على ❤️ لإضافة ذكر للمفضلة</small></div>';
        return;
    }

    let html = '';
    favorites.forEach((zikr, index) => {
        html += renderFavoriteCard(zikr, index);
    });

    list.innerHTML = html;
}

function renderFavoritesSwipe() {
    const list = document.getElementById('azkarList');
    const total = favorites.length;

    if (total === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-color);"><i class="bi bi-heart" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 16px;"></i>لا توجد أذكار مفضلة<br><small style="opacity: 0.6;">اضغط على ❤️ لإضافة ذكر للمفضلة</small></div>';
        return;
    }

    currentSwipeIndex = Math.max(0, Math.min(currentSwipeIndex, total - 1));
    const zikr = favorites[currentSwipeIndex];

    list.innerHTML = `<div class="swipe-view">
        <div class="swipe-meta">
            <span>بطاقة ${currentSwipeIndex + 1} من ${total}</span>
            <span>المفضلة</span>
        </div>
        <div class="swipe-area">
            ${renderFavoriteCard(zikr, currentSwipeIndex).replace('zikr-card', 'zikr-card swipe-card')}
        </div>
        <div class="swipe-hint">اسحب يميناً ويساراً للتنقل</div>
        <div class="swipe-nav">
            <button class="swipe-nav-btn" onclick="goToPreviousCard()" ${currentSwipeIndex === 0 ? 'disabled' : ''}>السابق</button>
            <button class="swipe-nav-btn" onclick="goToNextCard()" ${currentSwipeIndex === total - 1 ? 'disabled' : ''}>التالي</button>
        </div>
    </div>`;

    bindSwipeGesture();
}

function renderCurrentCategoryView() {
    if (!currentCategory) return;

    if (currentCategory === 'favorites') {
        if (currentViewMode === 'swipe') {
            renderFavoritesSwipe();
        } else {
            renderFavoritesList();
        }
        return;
    }

    if (currentViewMode === 'swipe') {
        renderCategorySwipe(currentCategory);
    } else {
        renderCategoryList(currentCategory);
    }
}

function showCategory(categoryKey) {
    currentCategory = categoryKey;
    currentSwipeIndex = 0;

    document.getElementById('categoryList').style.display = 'none';
    document.getElementById('azkarList').classList.add('active');
    document.getElementById('headerTitle').textContent = azkarData[categoryKey].name;
    document.getElementById('backBtn').style.display = 'flex';
    document.getElementById('menuBtn').style.display = 'none';

    setViewModeButtonVisibility(true);
    updateViewModeButton();
    renderCurrentCategoryView();
}

function showFavorites() {
    currentCategory = 'favorites';
    currentSwipeIndex = 0;

    document.getElementById('categoryList').style.display = 'none';
    document.getElementById('azkarList').classList.add('active');
    document.getElementById('headerTitle').textContent = 'المفضلة';
    document.getElementById('backBtn').style.display = 'flex';
    document.getElementById('menuBtn').style.display = 'none';

    setViewModeButtonVisibility(true);
    updateViewModeButton();
    renderCurrentCategoryView();
}

function showCategories() {
    currentCategory = null;
    currentSwipeIndex = 0;

    document.getElementById('categoryList').style.display = 'grid';
    document.getElementById('azkarList').classList.remove('active');
    document.getElementById('headerTitle').textContent = 'الأذكار';
    document.getElementById('backBtn').style.display = 'none';
    document.getElementById('menuBtn').style.display = 'flex';

    setViewModeButtonVisibility(false);
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

    const match = repeatText.match(/(\d+)\s*(مرة|مرات)/);
    if (match) {
        return parseInt(match[1], 10);
    }

    return 1;
}

function incrementZikr(categoryKey, index, target) {
    const countKey = `${categoryKey}_${index}`;
    let current = zikrCounts[countKey] || 0;
    const btn = document.querySelector(`#card_${index} .zikr-counter-btn`);

    if (current >= target) {
        zikrCounts[countKey] = 0;
        saveUserData();
        if (btn) {
            btn.textContent = `0/${target}`;
            btn.classList.remove('completed');
        }
        return;
    }

    current++;
    zikrCounts[countKey] = current;
    saveUserData();

    if (window.recordHabitActivity) {
        window.recordHabitActivity('azkar');
    }

    if (btn) {
        if (current >= target) {
            btn.textContent = '✓';
            btn.classList.add('completed');
            if (navigator.vibrate) navigator.vibrate(50);
        } else {
            btn.textContent = `${current}/${target}`;
        }
    }
}

function toggleFavorite(categoryKey, index) {
    const zikr = azkarData[categoryKey].azkar[index];
    const favIndex = favorites.findIndex(f => f.text === zikr.text);

    const btn = document.querySelector(`#card_${index} .favorite-btn`);
    const icon = btn ? btn.querySelector('i') : null;

    if (favIndex === -1) {
        favorites.push(zikr);
        if (btn && icon) {
            btn.classList.add('active');
            icon.classList.remove('bi-heart');
            icon.classList.add('bi-heart-fill');
        }
    } else {
        favorites.splice(favIndex, 1);
        if (btn && icon) {
            btn.classList.remove('active');
            icon.classList.remove('bi-heart-fill');
            icon.classList.add('bi-heart');
        }
    }

    saveUserData();
}

function removeFromFavorites(index) {
    favorites.splice(index, 1);
    saveUserData();

    if (currentViewMode === 'swipe' && currentSwipeIndex >= favorites.length) {
        currentSwipeIndex = Math.max(0, favorites.length - 1);
    }

    showFavorites();
}

function getCurrentItemsLength() {
    if (!currentCategory) return 0;
    if (currentCategory === 'favorites') return favorites.length;
    return azkarData[currentCategory]?.azkar?.length || 0;
}

function changeCardBy(step) {
    if (swipeAnimating) return;

    const total = getCurrentItemsLength();
    const nextIndex = currentSwipeIndex + step;
    if (total <= 1 || nextIndex < 0 || nextIndex >= total) return;

    const card = document.querySelector('.swipe-card');
    if (!card) {
        currentSwipeIndex = nextIndex;
        renderCurrentCategoryView();
        return;
    }

    swipeAnimating = true;
    card.classList.add(step > 0 ? 'swipe-right' : 'swipe-left');

    setTimeout(() => {
        currentSwipeIndex = nextIndex;
        swipeAnimating = false;
        renderCurrentCategoryView();
    }, 180);
}

function goToNextCard() {
    changeCardBy(1);
}

function goToPreviousCard() {
    changeCardBy(-1);
}

function handleSwipeEnd(endX) {
    if (!swipeTracking) return;
    swipeTracking = false;

    const delta = endX - swipeStartX;
    if (Math.abs(delta) < 45) return;

    if (delta > 0) {
        goToNextCard();
    } else {
        goToPreviousCard();
    }
}

function bindSwipeGesture() {
    const card = document.querySelector('.swipe-card');
    if (!card) return;

    card.addEventListener('pointerdown', (event) => {
        swipeStartX = event.clientX;
        swipeTracking = true;
    });

    card.addEventListener('pointerup', (event) => {
        handleSwipeEnd(event.clientX);
    });

    card.addEventListener('pointercancel', () => {
        swipeTracking = false;
    });
}

loadUserData();
updateViewModeButton();
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
        const baseSize = fontSizes[parseInt(fontSize, 10)] || 16;
        document.documentElement.style.setProperty('--font-size-base', `${baseSize}px`);
        document.documentElement.style.setProperty('--font-size-ayah', `${baseSize + 8}px`);
    }
})();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
}
