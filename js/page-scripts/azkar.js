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

    // The visible label is hidden below 420px, so the accessible name has to
    // be carried by aria-label as well as the tooltip.
    if (currentViewMode === 'swipe') {
        icon.className = 'bi bi-list-ul';
        label.textContent = 'قائمة';
        btn.title = 'عرض القائمة';
        btn.setAttribute('aria-label', 'عرض القائمة');
    } else {
        icon.className = 'bi bi-view-stacked';
        label.textContent = 'بطاقات';
        btn.title = 'عرض البطاقات';
        btn.setAttribute('aria-label', 'عرض البطاقات');
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

/* --------------------------------------------------------------------------
   Category grouping

   The 132 duas rendered as one flat grid of near-identical cards (~11,000px
   tall) with no hierarchy, so finding "أذكار الصباح" meant scrolling forever.
   They are bucketed into themes by keyword instead.

   Matching runs against a NORMALISED name — tashkeel stripped and
   alef/ya/waw/ta-marbuta folded — so prefixed forms ("للمريض") and vocalised
   text ("الدِّيكِ") still match their stem. Anything unmatched lands in
   "أدعية متنوعة" rather than being lost.
   -------------------------------------------------------------------------- */
const AZKAR_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

function normalizeAzkarText(value) {
    return String(value || '')
        .replace(AZKAR_DIACRITICS, '')
        .replace(/[إأآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/\s+/g, ' ')
        .trim();
}

const AZKAR_GROUPS = [
    { id: 'daily', name: 'أذكار اليوم والليلة', icon: 'bi-sunrise-fill', keywords: ['صباح', 'مساء', 'نوم', 'استيقاظ', 'فزع', 'تقلب', 'رؤيا', 'حلم', 'أرق'] },
    { id: 'prayer', name: 'الصلاة والمسجد', icon: 'bi-building', keywords: ['صلاة', 'مسجد', 'اذان', 'أذان', 'وضوء', 'استفتاح', 'ركوع', 'سجود', 'سجدتين', 'تلاوة', 'تشهد', 'وتر', 'قنوت', 'استخارة', 'السلام', 'النبي'] },
    { id: 'travel', name: 'المنزل والسفر', icon: 'bi-house-door-fill', keywords: ['المنزل', 'الخلاء', 'ثوب', 'سفر', 'مسافر', 'مقيم', 'ركوب', 'مركوب', 'الدابة', 'السوق', 'القرية', 'البلد', 'مترل', 'أسحر', 'نزول'] },
    { id: 'social', name: 'الناس والمناسبات', icon: 'bi-people-fill', keywords: ['مولود', 'أولاد', 'متزوج', 'عطاس', 'عطس', 'كافر', 'تهنئة', 'نكاح', 'زواج', 'زوجة', 'أحسن', 'مدح', 'زكي', 'مجلس', 'ﻟﻤﺠلس', 'أحب', 'الدعاء لمن'] },
    { id: 'distress', name: 'الهمّ والكرب', icon: 'bi-cloud-drizzle-fill', keywords: ['الهم', 'الحزن', 'الكرب', 'العدو', 'السلطان', 'وسوس', 'الدين', 'ذنب', 'خاف', 'استصعب', 'غلب', 'مصيبة', 'الغضب', 'القرض'] },
    { id: 'illness', name: 'المرض والجنائز', icon: 'bi-heart-pulse-fill', keywords: ['مريض', 'محتضر', 'ميت', 'تعزية', 'قبور', 'القبر', 'عيادة', 'دفن', 'إغماض', 'الفرط', 'يئس', 'وجع', 'مبتلى'] },
    { id: 'food', name: 'الطعام والشراب', icon: 'bi-cup-hot-fill', keywords: ['طعام', 'افطار', 'إفطار', 'صائم', 'أفطر', 'شراب', 'الثمر', 'الضيف', 'الذبح', 'النحر'] },
    { id: 'nature', name: 'الطقس والكون', icon: 'bi-cloud-rain-fill', keywords: ['الريح', 'الرعد', 'المطر', 'استسقاء', 'استصحاء', 'الهلال', 'البرق', 'ديك', 'كلاب', 'حمار'] },
    { id: 'protect', name: 'الرقية والتحصين', icon: 'bi-shield-fill-check', keywords: ['الدجال', 'الشرك', 'الطيرة', 'شياطين', 'مردة', 'بعين', 'العين', 'الحسد', 'يعصم', 'يعوذ', 'الشيطان'] },
    { id: 'hajj', name: 'الحج والعمرة', icon: 'bi-geo-fill', keywords: ['محرم', 'الحج', 'عمرة', 'الركن', 'الصفا', 'المروة', 'عرفة', 'المشعر', 'الجمار', 'الأسود', 'يلبي', 'تلبية'] },
    { id: 'praise', name: 'التسبيح والاستغفار', icon: 'bi-stars', keywords: ['تسبيح', 'استغفار', 'الحمد', 'التوبة', 'فضل', 'تهليل', 'سبحان', 'التعجب', 'يسره', 'الخير والآداب'] }
];

const AZKAR_FALLBACK_GROUP = { id: 'misc', name: 'أدعية متنوعة', icon: 'bi-bookmark-star-fill' };

function groupForCategory(categoryName) {
    const name = normalizeAzkarText(categoryName);
    for (const group of AZKAR_GROUPS) {
        if (group.keywords.some(keyword => name.includes(normalizeAzkarText(keyword)))) {
            return group;
        }
    }
    return AZKAR_FALLBACK_GROUP;
}

// How many azkar in a category have reached their repeat target.
function getCategoryProgress(categoryKey) {
    const category = azkarData[categoryKey];
    if (!category || !Array.isArray(category.azkar)) return { done: 0, total: 0 };

    let done = 0;
    category.azkar.forEach((zikr, index) => {
        const target = zikr.count || 1;
        if ((zikrCounts[`${categoryKey}_${index}`] || 0) >= target) done += 1;
    });
    return { done, total: category.azkar.length };
}

let azkarExpandedGroups = new Set(['daily']);
let azkarSearchQuery = '';

function renderCategoryRow(key, category) {
    const progress = getCategoryProgress(key);
    const complete = progress.total > 0 && progress.done === progress.total;
    const badge = progress.done > 0 ? `${progress.done}/${progress.total}` : `${progress.total}`;

    return `<button type="button" class="category-item${complete ? ' is-complete' : ''}" onclick="showCategory('${key}')">
        <span class="category-info">
            <span class="category-name">${category.name}</span>
        </span>
        <span class="category-count">${complete ? '<i class="bi bi-check-lg" aria-hidden="true"></i>' : badge}</span>
    </button>`;
}

function toggleAzkarGroup(groupId) {
    if (azkarExpandedGroups.has(groupId)) {
        azkarExpandedGroups.delete(groupId);
    } else {
        azkarExpandedGroups.add(groupId);
    }
    renderCategories();
}

function handleAzkarSearch(value) {
    azkarSearchQuery = value || '';
    renderCategories();
}

function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;

    const query = normalizeAzkarText(azkarSearchQuery);
    const entries = Object.entries(azkarData);

    // Favourites stay pinned above everything else — but not while searching,
    // where it would sit among the results pretending to be one.
    // Its own component rather than a `.category-item`: that class is a centred
    // card in the base sheet and a row in the group overrides, and the pinned
    // favourites entry ended up caught between the two.
    // Arabic counts one, two and many differently, and the singular and dual
    // drop the numeral entirely — "1 ذكر" reads as broken text.
    const favCount = favorites.length;
    let favSubtitle;
    if (favCount === 0) favSubtitle = 'اضغط ♥ بجانب أي ذكر لحفظه هنا';
    else if (favCount === 1) favSubtitle = 'ذكر واحد محفوظ';
    else if (favCount === 2) favSubtitle = 'ذكران محفوظان';
    else if (favCount <= 10) favSubtitle = `${favCount} أذكار محفوظة`;
    else favSubtitle = `${favCount} ذكراً محفوظاً`;

    let html = query ? '' : `<button type="button" class="azkar-fav-card${favCount ? '' : ' is-empty'}" onclick="showFavorites()">
        <span class="azkar-fav-icon"><i class="bi bi-heart-fill" aria-hidden="true"></i></span>
        <span class="azkar-fav-body">
            <span class="azkar-fav-title">المفضلة</span>
            <span class="azkar-fav-sub">${favSubtitle}</span>
        </span>
        ${favCount ? `<span class="azkar-fav-count">${favCount}</span>` : ''}
        <span class="azkar-fav-go"><i class="bi bi-chevron-left" aria-hidden="true"></i></span>
    </button>`;

    // Searching flattens the groups — you want the match, not its bucket.
    if (query) {
        const matches = entries.filter(([, category]) => normalizeAzkarText(category.name).includes(query));
        html += `<div class="azkar-search-meta">${matches.length} نتيجة</div>`;
        html += matches.length
            ? matches.map(([key, category]) => renderCategoryRow(key, category)).join('')
            : '<div class="azkar-empty">لا توجد نتائج مطابقة</div>';
        list.innerHTML = html;
        return;
    }

    const buckets = new Map();
    AZKAR_GROUPS.concat([AZKAR_FALLBACK_GROUP]).forEach(group => buckets.set(group.id, { group, items: [] }));
    entries.forEach(([key, category]) => {
        buckets.get(groupForCategory(category.name).id).items.push([key, category]);
    });

    buckets.forEach(({ group, items }) => {
        if (!items.length) return;
        const open = azkarExpandedGroups.has(group.id);
        html += `<section class="azkar-group${open ? ' is-open' : ''}">
            <button type="button" class="azkar-group-head" onclick="toggleAzkarGroup('${group.id}')" aria-expanded="${open}">
                <span class="azkar-group-icon"><i class="bi ${group.icon}" aria-hidden="true"></i></span>
                <span class="azkar-group-name">${group.name}</span>
                <span class="azkar-group-count">${items.length}</span>
                <i class="bi bi-chevron-down azkar-group-chevron" aria-hidden="true"></i>
            </button>
            <div class="azkar-group-body">${items.map(([key, category]) => renderCategoryRow(key, category)).join('')}</div>
        </section>`;
    });

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
            <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${categoryKey}', ${index})"
                aria-pressed="${isFav}" aria-label="${isFav ? 'إزالة من المفضلة' : 'أضف إلى المفضلة'}">
                <i class="bi bi-heart${isFav ? '-fill' : ''}" aria-hidden="true"></i>
            </button>
            <div class="zikr-repeat">${zikr.repeat}</div>
            <button class="zikr-counter-btn ${isCompleted ? 'completed' : ''}" onclick="incrementZikr('${categoryKey}', ${index}, ${targetCount})"
                aria-label="${isCompleted ? 'اكتمل، اضغط لإعادة العد' : `العدّاد ${currentCount} من ${targetCount}`}">
                ${isCompleted ? '<i class="bi bi-check-lg" aria-hidden="true"></i>' : `${currentCount}/${targetCount}`}
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
            <button class="favorite-btn active" onclick="removeFromFavorites(${index})" aria-pressed="true"
                aria-label="إزالة من المفضلة">
                <i class="bi bi-heart-fill" aria-hidden="true"></i>
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
        list.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-color);"><i class="bi bi-heart" aria-hidden="true" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 16px;"></i>لا توجد أذكار مفضلة<br><small style="opacity: 0.6;">اضغط على أيقونة القلب <i class="bi bi-heart-fill" aria-hidden="true"></i> لإضافة ذكر للمفضلة</small></div>';
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
        list.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-color);"><i class="bi bi-heart" aria-hidden="true" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 16px;"></i>لا توجد أذكار مفضلة<br><small style="opacity: 0.6;">اضغط على أيقونة القلب <i class="bi bi-heart-fill" aria-hidden="true"></i> لإضافة ذكر للمفضلة</small></div>';
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

function toggleAzkarSearchBar(visible) {
    const bar = document.getElementById('azkarSearchBar');
    if (bar) bar.style.display = visible ? 'flex' : 'none';
}

function showCategory(categoryKey) {
    currentCategory = categoryKey;
    currentSwipeIndex = 0;

    document.getElementById('categoryList').style.display = 'none';

    toggleAzkarSearchBar(false);
    document.getElementById('azkarList').classList.add('active');
    document.getElementById('headerTitle').textContent = azkarData[categoryKey].name;
    document.getElementById('backBtn').style.display = 'flex';
    setMenuButtonVisible(false);

    setViewModeButtonVisibility(true);
    updateViewModeButton();
    renderCurrentCategoryView();
    enterDrillDown(categoryKey);
}

function showFavorites(keepIndex) {
    currentCategory = 'favorites';
    if (!keepIndex) currentSwipeIndex = 0;

    document.getElementById('categoryList').style.display = 'none';

    toggleAzkarSearchBar(false);
    document.getElementById('azkarList').classList.add('active');
    document.getElementById('headerTitle').textContent = 'المفضلة';
    document.getElementById('backBtn').style.display = 'flex';
    setMenuButtonVisible(false);

    setViewModeButtonVisibility(true);
    updateViewModeButton();
    renderCurrentCategoryView();
    enterDrillDown('favorites');
}

function showCategories() {
    currentCategory = null;
    currentSwipeIndex = 0;

    document.getElementById('categoryList').style.display = 'grid';

    toggleAzkarSearchBar(true);
    document.getElementById('azkarList').classList.remove('active');
    document.getElementById('headerTitle').textContent = 'الأذكار';
    document.getElementById('backBtn').style.display = 'none';
    setMenuButtonVisible(true);

    setViewModeButtonVisibility(false);
    renderCategories();
    leaveDrillDown();
}

// The shared header's drawer toggle carries a class, not an id.
function setMenuButtonVisible(visible) {
    const btn = document.querySelector('.app-header .menu-toggle-btn');
    if (btn) btn.style.display = visible ? '' : 'none';
}

/* Drill-down views live on the same URL, so the hardware/browser Back button
   used to leave the page instead of returning to the category grid. Push a
   history entry on the way in and pop back to the grid on the way out. */
let drillDownDepth = 0;

function enterDrillDown(key) {
    window.scrollTo(0, 0);
    if (history.state && history.state.azkarView) {
        history.replaceState({ azkarView: key }, '');
        return;
    }
    history.pushState({ azkarView: key }, '');
    drillDownDepth = 1;
}

function leaveDrillDown() {
    window.scrollTo(0, 0);
    if (drillDownDepth && history.state && history.state.azkarView) {
        drillDownDepth = 0;
        history.back();
    }
}

window.addEventListener('popstate', () => {
    if (!currentCategory) return;
    drillDownDepth = 0;
    showCategories();
});

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
            btn.setAttribute('aria-label', `العدّاد 0 من ${target}`);
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
            btn.innerHTML = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
            btn.setAttribute('aria-label', 'اكتمل، اضغط لإعادة العد');
            btn.classList.add('completed');
            if (navigator.vibrate) navigator.vibrate(50);
        } else {
            btn.textContent = `${current}/${target}`;
            btn.setAttribute('aria-label', `العدّاد ${current} من ${target}`);
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
            btn.setAttribute('aria-pressed', 'true');
            btn.setAttribute('aria-label', 'إزالة من المفضلة');
            icon.classList.remove('bi-heart');
            icon.classList.add('bi-heart-fill');
        }
    } else {
        favorites.splice(favIndex, 1);
        if (btn && icon) {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
            btn.setAttribute('aria-label', 'أضف إلى المفضلة');
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

    // Stay on the neighbouring card instead of jumping back to the first.
    showFavorites(true);
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

// Font size (theme and accent are applied by theme-preload.js before paint;
// re-setting --primary-color here overrode its contrast-tuned value).
(function () {
    const fontSize = localStorage.getItem('fontSize');
    if (fontSize !== null) {
        const fontSizes = [12, 14, 16, 18, 20, 24, 28];
        const baseSize = fontSizes[parseInt(fontSize, 10)] || 16;
        document.documentElement.style.setProperty('--font-size-base', `${baseSize}px`);
        document.documentElement.style.setProperty('--font-size-ayah', `${baseSize + 8}px`);
    }
})();
