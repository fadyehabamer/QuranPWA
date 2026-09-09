let count = 0;
let target = 0;
let soundEnabled = true;
let selectedSound = 'beep';
let vibrationEnabled = true;
let lifetimeCount = 0;
let history = [];
let audioContext = null;

let selectedDhikrKey = 'custom';
let selectedDhikrLabel = 'مخصص';
let autoCountEnabled = false;
let autoCountInterval = null;
let lastIncrementAmount = 0;
let dailyCounts = {};

const DAILY_COUNTS_KEY = 'masbahaDailyCounts';
const CURRENT_STATE_KEY = 'masbahaCurrentState';
const AUTO_INTERVAL_MS = 700;

const dhikrConfig = {
    subhan_allah: { label: 'سبحان الله', target: 33 },
    alhamdulillah: { label: 'الحمد لله', target: 33 },
    allahu_akbar: { label: 'الله أكبر', target: 33 },
    la_ilaha_illa_allah: { label: 'لا إله إلا الله', target: 100 },
    astaghfirullah: { label: 'أستغفر الله', target: 100 },
    salat_nabi: { label: 'صلى على النبي', target: 10 },
    custom: { label: 'مخصص', target: 0 }
};

const circle = document.getElementById('progressCircle');

function updateCircumference() {
    if (!circle) return 0;
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;
    return circumference;
}

let circumference = updateCircumference();

function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayCount() {
    return dailyCounts[getTodayKey()] || 0;
}

function updateTodayCount(delta) {
    const todayKey = getTodayKey();
    const current = dailyCounts[todayKey] || 0;
    dailyCounts[todayKey] = Math.max(0, current + delta);
    queuePersist();
}

// Keep the per-day history bounded; it grew by one key per day forever and
// was re-serialised on every tap.
function pruneDailyCounts() {
    const keys = Object.keys(dailyCounts).sort();
    while (keys.length > 60) {
        delete dailyCounts[keys.shift()];
    }
}

let persistTimer = null;
let habitRecordedThisSession = false;

function flushPersist() {
    persistTimer = null;
    localStorage.setItem(DAILY_COUNTS_KEY, JSON.stringify(dailyCounts));
    localStorage.setItem('masbahaLifetime', lifetimeCount);
    localStorage.setItem(CURRENT_STATE_KEY, JSON.stringify({
        count,
        target,
        selectedDhikrKey,
        selectedDhikrLabel
    }));
}

function queuePersist() {
    if (persistTimer) return;
    persistTimer = setTimeout(flushPersist, 250);
}

window.addEventListener('pagehide', () => { if (persistTimer) { clearTimeout(persistTimer); flushPersist(); } });
document.addEventListener('visibilitychange', () => {
    if (document.hidden && persistTimer) { clearTimeout(persistTimer); flushPersist(); }
});

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {
            // Ignore resume errors.
        });
    }
}

function playClickSound() {
    if (!soundEnabled) return;

    initAudio();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (selectedSound === 'beep') {
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } else if (selectedSound === 'click') {
        oscillator.frequency.value = 1200;
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.05);
    } else if (selectedSound === 'water') {
        oscillator.frequency.value = 600;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
        oscillator.frequency.linearRampToValueAtTime(300, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }
}

function playSuccessSound() {
    if (!soundEnabled) return;

    initAudio();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 600;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.2);
    oscillator.stop(audioContext.currentTime + 0.5);
}

function triggerVibration(duration = 30) {
    if (!vibrationEnabled) return;

    if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

function saveLifetimeCount() {
    queuePersist();
    const lifetimeCounter = document.querySelector('#lifetimeCounter span');
    if (lifetimeCounter) {
        lifetimeCounter.textContent = `مجموع التسبيحات: ${lifetimeCount}`;
    }
}

function getMotivationText() {
    if (target <= 0) {
        return 'حدد هدفاً أو استمر بدون هدف';
    }

    if (count <= 0) {
        return `ابدأ الآن: ${selectedDhikrLabel}`;
    }

    if (count < target) {
        return `متبقي ${target - count} للوصول إلى الهدف`;
    }

    return 'أحسنت، أتممت الهدف الحالي';
}

function updateInsights() {
    const selectedLabel = document.getElementById('selectedDhikrLabel');
    const remainingLabel = document.getElementById('remainingLabel');
    const todayCountLabel = document.getElementById('todayCountLabel');
    const motivation = document.getElementById('motivationText');
    const undoBtn = document.getElementById('undoBtn');

    if (selectedLabel) {
        selectedLabel.textContent = `الذكر: ${selectedDhikrLabel}`;
    }

    if (remainingLabel) {
        remainingLabel.textContent = target > 0 ? `المتبقي: ${Math.max(target - count, 0)}` : 'المتبقي: --';
    }

    if (todayCountLabel) {
        todayCountLabel.textContent = `تسبيحات اليوم: ${getTodayCount()}`;
    }

    if (motivation) {
        motivation.textContent = getMotivationText();
    }

    if (undoBtn) {
        undoBtn.disabled = count === 0 || lastIncrementAmount === 0;
    }
}

function updateDisplay() {
    const counterValue = document.getElementById('counterValue');
    const targetDisplay = document.getElementById('targetDisplay');

    if (counterValue) {
        counterValue.textContent = count;
    }

    if (target > 0) {
        const progress = Math.min(count / target, 1);
        const offset = circumference - (progress * circumference);
        if (circle) {
            circle.style.strokeDashoffset = offset;
        }
        if (targetDisplay) {
            targetDisplay.textContent = `الهدف: ${count} / ${target}`;
        }
    } else {
        if (circle) {
            circle.style.strokeDashoffset = circumference;
        }
        if (targetDisplay) {
            targetDisplay.textContent = 'الهدف: غير محدد';
        }
    }

    updateInsights();
    syncQuickTapVisibility();
}

// Observed once instead of measured on every tap (which forced a layout
// right after the DOM writes above).
let quickTapObserver = null;

function syncQuickTapVisibility() {
    const mainButton = document.getElementById('tapButton');
    const quickButton = document.getElementById('quickTapFab');
    if (!mainButton || !quickButton) return;

    if (quickTapObserver || !('IntersectionObserver' in window)) {
        if (!quickTapObserver) {
            const rect = mainButton.getBoundingClientRect();
            quickButton.classList.toggle('hidden', rect.top < (window.innerHeight - 90) && rect.bottom > 80);
        }
        return;
    }

    quickTapObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            quickButton.classList.toggle('hidden', entry.isIntersecting);
        });
    }, { rootMargin: '-80px 0px -90px 0px', threshold: 0.2 });
    quickTapObserver.observe(mainButton);
}

function persistCurrentState() {
    queuePersist();
}

let rippleTimer = null;

function animateTapButton() {
    const button = document.getElementById('tapButton');
    if (!button) return;
    // Restart the animation without a forced synchronous layout.
    button.classList.remove('ripple');
    clearTimeout(rippleTimer);
    requestAnimationFrame(() => button.classList.add('ripple'));
    rippleTimer = setTimeout(() => button.classList.remove('ripple'), 400);
}

function applyIncrement(amount = 1, options = {}) {
    const {
        playSound = true,
        animate = true,
        vibrate = true,
        recordHabit = true
    } = options;

    if (!Number.isFinite(amount) || amount <= 0) return;

    const previousCount = count;
    let nextCount = previousCount + amount;

    if (target > 0 && nextCount > target) {
        nextCount = target;
    }

    const appliedDelta = nextCount - previousCount;
    if (appliedDelta <= 0) {
        // Target already reached: say so rather than swallowing the tap.
        if (animate) animateTapButton();
        if (vibrate) triggerVibration(15);
        if (window.A11y) window.A11y.announce(`اكتمل الهدف ${target}. اضغط إعادة التعيين للبدء من جديد.`);
        return;
    }

    count = nextCount;
    lifetimeCount += appliedDelta;
    lastIncrementAmount = appliedDelta;

    updateTodayCount(appliedDelta);
    updateDisplay();
    saveLifetimeCount();
    persistCurrentState();

    if (playSound) {
        playClickSound();
    }

    if (animate) {
        animateTapButton();
    }

    if (vibrate) {
        triggerVibration();
    }

    if (recordHabit && window.recordHabitActivity && !habitRecordedThisSession) {
        habitRecordedThisSession = true;
        window.recordHabitActivity('masbaha');
    }

    // The counter is no longer an aria-live region (five taps a second queued
    // dozens of announcements); announce round numbers instead.
    if (window.A11y && (count % 10 === 0 || count === target)) {
        window.A11y.announce(target > 0 ? `${count} من ${target}` : String(count));
    }

    if (target > 0 && previousCount < target && count >= target) {
        stopAutoCount();
        playSuccessSound();
        if (vibrationEnabled && navigator.vibrate) {
            navigator.vibrate([30, 50, 30]);
        }

        showModal({
            type: 'success',
            icon: '',
            title: 'بارك الله فيك',
            message: `أتممت ${target} تسبيحة!\nهل تريد البدء من جديد؟`,
            confirmText: 'نعم',
            cancelText: 'لا',
            onConfirm: () => {
                const saved = count;
                saveCount({ silent: true });
                performReset();
                showModal({
                    type: 'success',
                    icon: '',
                    title: 'تم الحفظ',
                    message: `حُفظت ${saved} تسبيحة في السجل، وبدأ عدّ جديد.`
                });
            }
        });
    }
}

function increment() {
    applyIncrement(1);
}

function addBulk(amount) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;

    applyIncrement(numericAmount, {
        playSound: false,
        animate: true,
        vibrate: false,
        recordHabit: false
    });

    playClickSound();
    triggerVibration(20);
}

function undoLastIncrement() {
    if (count <= 0 || lastIncrementAmount <= 0) return;

    const rollback = Math.min(count, lastIncrementAmount);
    count -= rollback;
    lifetimeCount = Math.max(0, lifetimeCount - rollback);
    updateTodayCount(-rollback);
    lastIncrementAmount = 0;

    updateDisplay();
    saveLifetimeCount();
    persistCurrentState();
}

function performReset() {
    count = 0;
    lastIncrementAmount = 0;
    stopAutoCount();
    updateDisplay();
    persistCurrentState();
}

function reset() {
    if (count === 0) return;
    showModal({
        type: 'warning',
        icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
        title: 'تأكيد',
        message: 'هل تريد إعادة تعيين العداد؟',
        confirmText: 'نعم',
        cancelText: 'لا',
        onConfirm: performReset
    });
}

function setTarget(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return;

    target = numericValue;
    if (count > target) {
        count = target;
    }

    highlightPresetForTarget();
    updateDisplay();
    persistCurrentState();
}

function highlightPresetForTarget() {
    document.querySelectorAll('.preset-btn').forEach((button) => {
        const isActive = parseInt(button.textContent, 10) === target;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

function setCustomTarget() {
    const input = document.getElementById('customTargetInput');
    const value = parseInt(input.value, 10);
    if (!value || value <= 0) return;

    target = value;
    if (count > target) {
        count = target;
    }

    highlightPresetForTarget();

    input.value = '';
    updateDisplay();
    persistCurrentState();
}

// The chips are <button aria-pressed>, so the selection has to be exposed to
// assistive tech as well as painted.
function setActiveDhikrChip(value) {
    document.querySelectorAll('.dhikr-chip').forEach((chip) => {
        const isSelected = chip.dataset.dhikr === value;
        chip.classList.toggle('active', isSelected);
        chip.setAttribute('aria-pressed', String(isSelected));
    });
}

function selectDhikr(value, element, options = {}) {
    const config = dhikrConfig[value] || dhikrConfig.custom;
    if (value === selectedDhikrKey) return;

    // A brush against a neighbouring chip used to wipe 80/100 with no way back.
    if (count > 0 && value !== 'custom' && !options.confirmed) {
        showModal({
            type: 'warning',
            icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
            title: 'تغيير الذكر',
            message: `سيبدأ عدّ جديد لـ «${config.label}» ويُفقد العدّ الحالي (${count}). هل تريد المتابعة؟`,
            confirmText: 'نعم',
            cancelText: 'لا',
            onConfirm: () => selectDhikr(value, element, { confirmed: true })
        });
        return;
    }

    selectedDhikrKey = value;
    selectedDhikrLabel = config.label;

    setActiveDhikrChip(value);

    if (value !== 'custom') {
        target = config.target;
        count = 0;
        lastIncrementAmount = 0;

        document.querySelectorAll('.preset-btn').forEach((button) => {
            if (parseInt(button.textContent, 10) === target) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    updateDisplay();
    persistCurrentState();
}

function updateAutoToggleButton() {
    const autoButton = document.getElementById('autoToggleBtn');
    const tapButton = document.getElementById('tapButton');
    if (!autoButton) return;

    autoButton.classList.toggle('active', autoCountEnabled);
    autoButton.setAttribute('aria-pressed', String(autoCountEnabled));
    autoButton.innerHTML = autoCountEnabled
        ? '<i class="bi bi-pause-fill" aria-hidden="true"></i> إيقاف تلقائي'
        : '<i class="bi bi-cpu" aria-hidden="true"></i> تلقائي';

    if (tapButton) {
        tapButton.classList.toggle('auto-running', autoCountEnabled);
    }
}

function startAutoCount() {
    if (autoCountInterval) return;
    if (target > 0 && count >= target) return;

    autoCountEnabled = true;
    autoCountInterval = setInterval(() => {
        applyIncrement(1, {
            playSound: false,
            animate: false,
            vibrate: false,
            recordHabit: false
        });
    }, AUTO_INTERVAL_MS);

    updateAutoToggleButton();
}

function stopAutoCount() {
    autoCountEnabled = false;

    if (autoCountInterval) {
        clearInterval(autoCountInterval);
        autoCountInterval = null;
    }

    updateAutoToggleButton();
}

function toggleAutoCount() {
    if (autoCountEnabled) {
        stopAutoCount();
    } else {
        startAutoCount();
    }
}

// The button labelled "الصوت" only ever opened the type picker and could
// switch sound ON but never off. It now toggles mute; the picker is shown
// while sound is on.
function toggleSoundMenu() {
    toggleSound();
    syncSoundMenu();
}

function syncSoundMenu() {
    const selector = document.getElementById('soundSelector');
    const toggle = document.getElementById('soundToggle');
    if (selector) selector.classList.toggle('show', soundEnabled);
    if (toggle) {
        toggle.setAttribute('aria-expanded', String(soundEnabled));
        toggle.setAttribute('aria-pressed', String(soundEnabled));
    }
}

// The speaker glyph is a Bootstrap Icon, so on/off swaps the class rather
// than the text content.
function setSoundIcon(isOn) {
    const icon = document.getElementById('soundIcon');
    if (!icon) return;
    icon.className = isOn ? 'bi bi-volume-up-fill' : 'bi bi-volume-mute-fill';
    icon.setAttribute('aria-hidden', 'true');
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const toggle = document.getElementById('soundToggle');

    if (toggle) {
        toggle.classList.toggle('active', soundEnabled);
    }

    setSoundIcon(soundEnabled);

    localStorage.setItem('masbahaSound', String(soundEnabled));
}

function changeSound(value) {
    selectedSound = value;
    localStorage.setItem('masbahaSoundType', value);
    playClickSound();
}

function toggleVibration() {
    vibrationEnabled = !vibrationEnabled;
    const toggle = document.getElementById('vibrationToggle');

    if (toggle) {
        toggle.classList.toggle('active', vibrationEnabled);
        toggle.setAttribute('aria-pressed', String(vibrationEnabled));
    }

    localStorage.setItem('masbahaVibration', String(vibrationEnabled));
}

function saveCount(options = {}) {
    if (count === 0) {
        showModal({
            type: 'info',
            icon: '<i class="bi bi-info-circle-fill"></i>',
            title: 'تنبيه',
            message: 'العداد فارغ، لا يوجد شيء للحفظ'
        });
        return;
    }

    const now = new Date();
    const timeString = now.toLocaleString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    history.unshift({
        count,
        target,
        dhikr: selectedDhikrLabel,
        time: timeString,
        timestamp: now.getTime()
    });

    if (history.length > 20) {
        history = history.slice(0, 20);
    }

    localStorage.setItem('masbahaHistory', JSON.stringify(history));
    renderHistory();

    if (options.silent) return;
    showModal({
        type: 'success',
        icon: '',
        title: 'تم الحفظ',
        message: `تم حفظ ${count} تسبيحة في السجل`
    });
}

function renderHistory() {
    const list = document.getElementById('historyList');
    const clearButton = document.getElementById('clearHistoryBtn');
    if (!list) return;

    if (history.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">لا يوجد سجل بعد</div>';
        if (clearButton) clearButton.style.display = 'none';
        return;
    }

    if (clearButton) clearButton.style.display = 'block';

    let html = '';
    history.forEach((item, index) => {
        const targetText = item.target > 0 ? ` / ${item.target}` : '';
        const dhikrText = item.dhikr ? `<div class="history-dhikr">${item.dhikr}</div>` : '';

        html += `
<div class="history-item">
    <div class="history-info">
        <div class="history-icon" aria-hidden="true">
            <i class="bi bi-check-lg"></i>
        </div>
        <div class="history-details">
            <div class="history-count">${item.count}${targetText}</div>
            ${dhikrText}
            <div class="history-time">${item.time}</div>
        </div>
    </div>
    <div class="history-actions">
        <button type="button" class="delete-btn" aria-label="حذف" onclick="deleteHistoryItem(${index})">
            <i class="bi bi-trash" aria-hidden="true"></i>
        </button>
    </div>
</div>`;
    });

    list.innerHTML = html;
}

function deleteHistoryItem(index) {
    showModal({
        type: 'warning',
        icon: '<i class="bi bi-trash"></i>',
        title: 'حذف',
        message: 'هل أنت متأكد من حذف هذا السجل؟',
        confirmText: 'حذف',
        cancelText: 'إلغاء',
        onConfirm: () => {
            history.splice(index, 1);
            localStorage.setItem('masbahaHistory', JSON.stringify(history));
            renderHistory();
        }
    });
}

function clearHistory() {
    showModal({
        type: 'warning',
        icon: '<i class="bi bi-trash"></i>',
        title: 'مسح الكل',
        message: 'هل أنت متأكد من مسح كل السجل؟',
        confirmText: 'مسح',
        cancelText: 'إلغاء',
        onConfirm: () => {
            history = [];
            localStorage.setItem('masbahaHistory', JSON.stringify(history));
            renderHistory();
        }
    });
}

function loadCurrentSessionState() {
    const savedState = localStorage.getItem(CURRENT_STATE_KEY);
    if (!savedState) return;

    try {
        const parsedState = JSON.parse(savedState);
        count = Number(parsedState.count) || 0;
        target = Number(parsedState.target) || 0;
        selectedDhikrKey = parsedState.selectedDhikrKey || 'custom';
        selectedDhikrLabel = parsedState.selectedDhikrLabel || (dhikrConfig[selectedDhikrKey]?.label || 'مخصص');
        setActiveDhikrChip(selectedDhikrKey);
        highlightPresetForTarget();
    } catch (error) {
        console.error('Error loading masbaha session state:', error);
    }
}

function loadData() {
    const savedSound = localStorage.getItem('masbahaSound');
    if (savedSound !== null) {
        soundEnabled = savedSound === 'true';
    }

    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) soundToggle.classList.toggle('active', soundEnabled);
    setSoundIcon(soundEnabled);
    syncSoundMenu();

    const savedSoundType = localStorage.getItem('masbahaSoundType');
    if (savedSoundType) {
        selectedSound = savedSoundType;
    }

    const soundSelect = document.querySelector('.sound-select');
    if (soundSelect) {
        soundSelect.value = selectedSound;
    }

    const savedVibration = localStorage.getItem('masbahaVibration');
    if (savedVibration !== null) {
        vibrationEnabled = savedVibration === 'true';
    }

    const vibrationToggle = document.getElementById('vibrationToggle');
    if (vibrationToggle) {
        vibrationToggle.classList.toggle('active', vibrationEnabled);
        vibrationToggle.setAttribute('aria-pressed', String(vibrationEnabled));
    }

    const savedLifetime = localStorage.getItem('masbahaLifetime');
    if (savedLifetime) {
        lifetimeCount = parseInt(savedLifetime, 10) || 0;
    }
    saveLifetimeCount();

    const savedHistory = localStorage.getItem('masbahaHistory');
    if (savedHistory) {
        try {
            history = JSON.parse(savedHistory);
        } catch (error) {
            history = [];
        }
    }
    renderHistory();

    const savedDaily = localStorage.getItem(DAILY_COUNTS_KEY);
    if (savedDaily) {
        try {
            dailyCounts = JSON.parse(savedDaily);
        } catch (error) {
            dailyCounts = {};
        }
    }
    pruneDailyCounts();

    // Enter in the custom-target field saves it (there is no <form>).
    const customInput = document.getElementById('customTargetInput');
    if (customInput) {
        customInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                setCustomTarget();
            }
        });
    }

    loadCurrentSessionState();
    updateAutoToggleButton();
}

// Space/Backspace are page-level shortcuts, but they must never be stolen
// from a control that already owns them: preventDefault() with no target
// check made Space unable to activate any focused button and Backspace unable
// to delete a character in #customTargetInput.
document.addEventListener('keydown', (event) => {
    const target = event.target;
    const tagName = target && target.tagName;

    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return;
    }

    if (target && target.isContentEditable) {
        return;
    }

    // A focused button/link owns Space (and Enter) for its own activation.
    if (tagName === 'BUTTON' || tagName === 'A' || (target && target.getAttribute && target.getAttribute('role') === 'button')) {
        return;
    }

    // Do not count taps behind an open dialog.
    if (document.querySelector('.modal-overlay.active')) {
        return;
    }

    if (event.code === 'Space') {
        event.preventDefault();
        increment();
    }

    if (event.key === 'Backspace') {
        event.preventDefault();
        undoLastIncrement();
    }
});

document.addEventListener('click', (event) => {
    const selector = document.getElementById('soundSelector');
    const toggle = document.getElementById('soundToggle');
    if (!selector || !toggle) return;

    if (!selector.contains(event.target) && !toggle.contains(event.target)) {
        selector.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
    }
});

window.addEventListener('resize', () => {
    circumference = updateCircumference();
    updateDisplay();
});

window.addEventListener('scroll', () => {
    syncQuickTapVisibility();
}, { passive: true });

window.addEventListener('beforeunload', () => {
    stopAutoCount();
});

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        return { r: 27, g: 94, b: 32 };
    }

    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    };
}

// Initialize
loadData();
updateDisplay();

/* Theme, accent colour and font preferences are applied before first paint by
   js/theme-preload.js. The block that used to live here re-set --primary-color
   to the raw stored hex, undoing the contrast tuning. */

