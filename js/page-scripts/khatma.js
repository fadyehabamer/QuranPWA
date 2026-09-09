function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 27, g: 94, b: 32 };
}

/* Theme, accent colour and font preferences are applied before first paint by
   js/theme-preload.js. The block that used to live here re-set --primary-color
   to the raw stored hex, undoing the contrast tuning. */


function applyHabitRing(habitId, summary) {
    const ringEl = document.getElementById(`habitRing${habitId}`);
    const pctEl = document.getElementById(`habitRing${habitId}Pct`);
    const metaEl = document.getElementById(`habitRing${habitId}Meta`);
    if (!ringEl || !pctEl || !metaEl) return;

    const percent = Math.max(0, Math.min(100, summary.percent || 0));
    ringEl.style.setProperty('--ring-percent', percent);
    pctEl.textContent = `${percent}%`;
    metaEl.textContent = `${summary.activeDays || 0} من ${summary.windowDays || 7} أيام`;
}

function getAzkarTargetCountFromText(repeatText) {
    const text = String(repeatText || '');
    if (text.includes('ثلاث مرات')) return 3;
    if (text.includes('ثلاث وثلاثون')) return 33;
    if (text.includes('أربع وثلاثون')) return 34;
    if (text.includes('سبع مرات')) return 7;
    if (text.includes('أربع مرات')) return 4;
    if (text.includes('مائة مرة')) return 100;
    if (text.includes('عشر مرات')) return 10;

    const match = text.match(/(\d+)\s*(مرة|مرات)/);
    if (match) {
        return parseInt(match[1], 10) || 1;
    }
    return 1;
}

async function calculateAzkarProgressPercent() {
    const counts = JSON.parse(localStorage.getItem('zikrCounts') || '{}');
    if (!counts || typeof counts !== 'object') return 0;

    let totalTarget = 0;
    let totalCurrent = 0;

    try {
        const response = await fetch('data/azkar.json');
        const data = await response.json();

        Object.entries(data || {}).forEach(([categoryKey, category]) => {
            if (!category || !Array.isArray(category.azkar)) return;

            category.azkar.forEach((zikr, index) => {
                const target = getAzkarTargetCountFromText(zikr.repeat);
                const current = parseInt(counts[`${categoryKey}_${index}`], 10) || 0;
                totalTarget += target;
                totalCurrent += Math.min(current, target);
            });
        });
    } catch (_error) {
        const roughTotal = Object.values(counts).reduce((sum, value) => sum + (parseInt(value, 10) || 0), 0);
        return Math.min(100, Math.round((roughTotal / 300) * 100));
    }

    if (totalTarget <= 0) return 0;
    return Math.round((totalCurrent / totalTarget) * 100);
}

async function renderHabitDashboard() {
    const hasHabitUi = document.getElementById('habitDashboardSection');
    if (!hasHabitUi) return;

    const quranStreak = window.getHabitStreak
        ? window.getHabitStreak('quran')
        : { current: 0, best: 0 };
    const quranSummary = window.getHabitSummary
        ? window.getHabitSummary('quran', 7)
        : { percent: 0, activeDays: 0, windowDays: 7 };
    const azkarSummary = window.getHabitSummary
        ? window.getHabitSummary('azkar', 7)
        : { percent: 0, activeDays: 0, windowDays: 7 };
    const masbahaSummary = window.getHabitSummary
        ? window.getHabitSummary('masbaha', 7)
        : { percent: 0, activeDays: 0, windowDays: 7 };

    const streakNumberEl = document.getElementById('quranStreakNumber');
    const bestStreakEl = document.getElementById('quranBestStreakMeta');
    if (streakNumberEl) streakNumberEl.textContent = quranStreak.current || 0;
    if (bestStreakEl) bestStreakEl.textContent = `أفضل سلسلة: ${quranStreak.best || 0} يوم`;

    applyHabitRing('Quran', quranSummary);
    applyHabitRing('Azkar', azkarSummary);
    applyHabitRing('Masbaha', masbahaSummary);

    const azkarProgressEl = document.getElementById('azkarProgressMeta');
    if (azkarProgressEl) {
        const azkarProgress = await calculateAzkarProgressPercent();
        azkarProgressEl.textContent = `تقدّم الأذكار: ${azkarProgress}%`;
    }
}

const KHATMA_TOTAL_PAGES = 604;
const KHATMA_PLAN_KEY = 'khatmaPlanV1';

function toDateInputValue(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseDateOnly(str) {
    const [y, m, d] = String(str || '').split('-').map(Number);
    return new Date(y, m - 1, d);
}

function diffDaysInclusive(startDate, endDate) {
    const msPerDay = 86400000;
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.round((end - start) / msPerDay) + 1;
}

function loadKhatmaPlan() {
    try {
        return JSON.parse(localStorage.getItem(KHATMA_PLAN_KEY) || 'null');
    } catch (_error) {
        return null;
    }
}

function saveKhatmaPlan(plan) {
    localStorage.setItem(KHATMA_PLAN_KEY, JSON.stringify(plan));
}

function createKhatmaPlan() {
    const startInput = document.getElementById('khatmaStartDate');
    const endInput = document.getElementById('khatmaEndDate');
    if (!startInput || !endInput) return;

    const startDate = startInput.value;
    const endDate = endInput.value;

    if (!startDate || !endDate) {
        alert('يرجى اختيار تاريخ البداية والنهاية');
        return;
    }

    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (end < start) {
        alert('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
        return;
    }

    const plan = {
        startDate,
        endDate,
        totalPages: KHATMA_TOTAL_PAGES,
        completedPages: 0,
        updatedAt: Date.now()
    };

    saveKhatmaPlan(plan);
    renderKhatmaPlanner();
}

function getKhatmaStatus(plan) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = parseDateOnly(plan.startDate);
    const end = parseDateOnly(plan.endDate);

    const totalDays = Math.max(1, diffDaysInclusive(start, end));
    const completedPages = Math.max(0, Math.min(plan.totalPages, plan.completedPages || 0));
    const remainingPages = Math.max(0, plan.totalPages - completedPages);

    const started = today >= start;
    const finishedWindow = today > end;

    const elapsedDays = started ? Math.min(totalDays, diffDaysInclusive(start, today)) : 0;
    // Pages that should have been finished by the END of yesterday; today's
    // own share is not a backlog until the day is over.
    const fullDaysElapsed = finishedWindow ? totalDays : Math.max(0, elapsedDays - 1);
    const expectedByToday = started ? Math.ceil((plan.totalPages * fullDaysElapsed) / totalDays) : 0;
    const backlogPages = Math.max(0, expectedByToday - completedPages);
    const todayDone = plan.lastCompletedDate === toDateInputValue(today);

    let remainingDays = 0;
    let todayTargetPages = 0;

    if (!started) {
        remainingDays = totalDays;
        todayTargetPages = Math.ceil(plan.totalPages / totalDays);
    } else if (finishedWindow) {
        remainingDays = 0;
        todayTargetPages = remainingPages;
    } else {
        remainingDays = diffDaysInclusive(today, end);
        todayTargetPages = Math.ceil(remainingPages / Math.max(1, remainingDays));
    }

    const todayStartPage = remainingPages > 0 ? completedPages + 1 : plan.totalPages;
    const todayEndPage = Math.min(plan.totalPages, completedPages + todayTargetPages);
    const progressPercent = Math.round((completedPages / plan.totalPages) * 100);

    return {
        started,
        finishedWindow,
        totalDays,
        completedPages,
        remainingPages,
        remainingDays,
        expectedByToday,
        backlogPages,
        todayTargetPages,
        todayStartPage,
        todayEndPage,
        progressPercent,
        todayDone
    };
}

function addKhatmaProgress(overridePages) {
    const plan = loadKhatmaPlan();
    if (!plan) return;

    const input = document.getElementById('khatmaPagesReadInput');
    const pages = overridePages || parseInt((input && input.value) || '0', 10);
    if (!pages || pages < 1) {
        alert('أدخل عدد صفحات صحيح');
        return;
    }

    plan.completedPages = Math.min(plan.totalPages, (plan.completedPages || 0) + pages);
    plan.updatedAt = Date.now();
    saveKhatmaPlan(plan);

    if (input) input.value = '';
    renderKhatmaPlanner();
}

function markTodayKhatmaDone() {
    const plan = loadKhatmaPlan();
    if (!plan) return;

    const status = getKhatmaStatus(plan);
    if (status.todayTargetPages <= 0 || status.todayDone) return;

    plan.lastCompletedDate = toDateInputValue(new Date());
    saveKhatmaPlan(plan);
    addKhatmaProgress(status.todayTargetPages);
}

function resetKhatmaPlan() {
    const shouldReset = confirm('هل تريد إعادة تعيين خطة الختمة؟');
    if (!shouldReset) return;

    localStorage.removeItem(KHATMA_PLAN_KEY);
    renderKhatmaPlanner();
}

function renderKhatmaPlanner() {
    const setupView = document.getElementById('khatmaSetupView');
    const summaryView = document.getElementById('khatmaSummaryView');
    const startInput = document.getElementById('khatmaStartDate');
    const endInput = document.getElementById('khatmaEndDate');

    if (!setupView || !summaryView || !startInput || !endInput) return;

    const today = new Date();
    const defaultStart = toDateInputValue(today);
    const defaultEnd = toDateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()));

    if (!startInput.value) startInput.value = defaultStart;
    if (!endInput.value) endInput.value = defaultEnd;

    const plan = loadKhatmaPlan();
    if (!plan) {
        setupView.style.display = 'block';
        summaryView.style.display = 'none';
        return;
    }

    const status = getKhatmaStatus(plan);

    setupView.style.display = 'none';
    summaryView.style.display = 'block';

    const completedEl = document.getElementById('khatmaCompletedPages');
    const remainingPagesEl = document.getElementById('khatmaRemainingPages');
    const remainingDaysEl = document.getElementById('khatmaRemainingDays');
    const todayPagesEl = document.getElementById('khatmaTodayPages');
    const progressBar = document.getElementById('khatmaProgressBar');
    const textEl = document.getElementById('khatmaTodayTargetText');

    if (completedEl) completedEl.textContent = status.completedPages;
    if (remainingPagesEl) remainingPagesEl.textContent = status.remainingPages;
    if (remainingDaysEl) remainingDaysEl.textContent = status.remainingDays;
    if (todayPagesEl) todayPagesEl.textContent = status.todayTargetPages;
    if (progressBar) progressBar.style.width = `${status.progressPercent}%`;

    if (!textEl) return;

    if (status.completedPages >= plan.totalPages) {
        textEl.textContent = 'تمت الختمة بنجاح! بارك الله فيك.';
    } else if (!status.started) {
        textEl.textContent = `لم تبدأ الخطة بعد. الهدف اليومي سيكون ${status.todayTargetPages} صفحات.`;
    } else if (status.finishedWindow && status.remainingPages > 0) {
        textEl.textContent = `انتهت المدة. للتعويض الآن تحتاج ${status.todayTargetPages} صفحات.`;
    } else if (status.todayDone) {
        textEl.textContent = `أنجزت ورد اليوم، بارك الله فيك. غداً: من صفحة ${status.todayStartPage} إلى ${status.todayEndPage}.`;
    } else {
        const backlogText = status.backlogPages > 0 ? ` • تعويض متراكم: ${status.backlogPages}` : '';
        textEl.textContent = `هدف اليوم: من صفحة ${status.todayStartPage} إلى ${status.todayEndPage} (${status.todayTargetPages} صفحات)${backlogText}`;
    }

    const doneBtn = document.querySelector('[onclick*="markTodayKhatmaDone"]');
    if (doneBtn) {
        const disabled = status.todayDone || status.completedPages >= plan.totalPages;
        doneBtn.disabled = disabled;
        doneBtn.setAttribute('aria-disabled', String(disabled));
    }
}

window.createKhatmaPlan = createKhatmaPlan;
window.addKhatmaProgress = addKhatmaProgress;
window.markTodayKhatmaDone = markTodayKhatmaDone;
window.resetKhatmaPlan = resetKhatmaPlan;

renderHabitDashboard();
renderKhatmaPlanner();

document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    renderHabitDashboard();
    renderKhatmaPlanner();
});

window.addEventListener('storage', (event) => {
    if (event.key === KHATMA_PLAN_KEY || event.key === 'appHabitLogsV1' || event.key === 'zikrCounts') {
        renderHabitDashboard();
        renderKhatmaPlanner();
    }
});
