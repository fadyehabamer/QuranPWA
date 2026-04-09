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
    localStorage.setItem(DAILY_COUNTS_KEY, JSON.stringify(dailyCounts));
}

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
    if (vibrationEnabled && navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

function saveLifetimeCount() {
    localStorage.setItem('masbahaLifetime', lifetimeCount);
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

function syncQuickTapVisibility() {
    const mainButton = document.getElementById('tapButton');
    const quickButton = document.getElementById('quickTapFab');
    if (!mainButton || !quickButton) return;

    const rect = mainButton.getBoundingClientRect();
    const visibleTop = rect.top < (window.innerHeight - 90);
    const visibleBottom = rect.bottom > 80;
    const isMainVisible = visibleTop && visibleBottom;

    quickButton.classList.toggle('hidden', isMainVisible);
}

function persistCurrentState() {
    localStorage.setItem(CURRENT_STATE_KEY, JSON.stringify({
        count,
        target,
        selectedDhikrKey,
        selectedDhikrLabel
    }));
}

function animateTapButton() {
    const button = document.getElementById('tapButton');
    if (!button) return;
    button.classList.remove('ripple');
    void button.offsetWidth;
    button.classList.add('ripple');
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
    if (appliedDelta <= 0) return;

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

    if (recordHabit && window.recordHabitActivity) {
        window.recordHabitActivity('masbaha');
    }

    if (target > 0 && previousCount < target && count >= target) {
        stopAutoCount();
        playSuccessSound();

        showModal({
            type: 'success',
            icon: '',
            title: 'بارك الله فيك',
            message: `أتممت ${target} تسبيحة!\nهل تريد البدء من جديد؟`,
            confirmText: 'نعم',
            cancelText: 'لا',
            onConfirm: () => {
                saveCount();
                reset();
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

function reset() {
    showModal({
        type: 'warning',
        icon: '⚠',
        title: 'تأكيد',
        message: 'هل تريد إعادة تعيين العداد؟',
        confirmText: 'نعم',
        cancelText: 'لا',
        onConfirm: () => {
            count = 0;
            lastIncrementAmount = 0;
            stopAutoCount();
            updateDisplay();
            persistCurrentState();
        }
    });
}

function setTarget(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return;

    target = numericValue;
    if (count > target) {
        count = target;
    }

    document.querySelectorAll('.preset-btn').forEach((button) => {
        if (parseInt(button.textContent, 10) === numericValue) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    updateDisplay();
    persistCurrentState();
}

function setCustomTarget() {
    const input = document.getElementById('customTargetInput');
    const value = parseInt(input.value, 10);
    if (!value || value <= 0) return;

    target = value;
    if (count > target) {
        count = target;
    }

    document.querySelectorAll('.preset-btn').forEach((button) => {
        button.classList.remove('active');
    });

    input.value = '';
    updateDisplay();
    persistCurrentState();
}

function setActiveDhikrChip(value) {
    document.querySelectorAll('.dhikr-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.dhikr === value);
    });
}

function selectDhikr(value, element) {
    const config = dhikrConfig[value] || dhikrConfig.custom;
    selectedDhikrKey = value;
    selectedDhikrLabel = config.label;

    if (element) {
        document.querySelectorAll('.dhikr-chip').forEach((chip) => chip.classList.remove('active'));
        element.classList.add('active');
    } else {
        setActiveDhikrChip(value);
    }

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
    autoButton.innerHTML = autoCountEnabled
        ? '<i class="bi bi-pause-fill"></i> إيقاف تلقائي'
        : '<i class="bi bi-cpu"></i> تلقائي';

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

function toggleSoundMenu() {
    const selector = document.getElementById('soundSelector');
    if (!selector) return;

    selector.classList.toggle('show');

    if (selector.classList.contains('show') && !soundEnabled) {
        toggleSound();
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const toggle = document.getElementById('soundToggle');
    const icon = document.getElementById('soundIcon');

    if (toggle) {
        toggle.classList.toggle('active', soundEnabled);
    }

    if (icon) {
        icon.textContent = soundEnabled ? '🔊' : '🔇';
    }

    localStorage.setItem('masbahaSound', String(soundEnabled));
}

function changeSound(value) {
    selectedSound = value;
    localStorage.setItem('masbahaSoundType', value);
    playClickSound();

    const selector = document.getElementById('soundSelector');
    if (selector) {
        selector.classList.remove('show');
    }
}

function toggleVibration() {
    vibrationEnabled = !vibrationEnabled;
    const toggle = document.getElementById('vibrationToggle');

    if (toggle) {
        toggle.classList.toggle('active', vibrationEnabled);
    }

    localStorage.setItem('masbahaVibration', String(vibrationEnabled));
}

function saveCount() {
    if (count === 0) {
        showModal({
            type: 'info',
            icon: 'ℹ',
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
        list.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">لا يوجد سجل بعد</div>';
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
        <div class="history-icon">
            <i class="bi bi-check-lg"></i>
        </div>
        <div class="history-details">
            <div class="history-count">${item.count}${targetText}</div>
            ${dhikrText}
            <div class="history-time">${item.time}</div>
        </div>
    </div>
    <div class="history-actions">
        <button class="delete-btn" onclick="deleteHistoryItem(${index})">
            <i class="bi bi-trash"></i>
        </button>
    </div>
</div>`;
    });

    list.innerHTML = html;
}

function deleteHistoryItem(index) {
    showModal({
        type: 'warning',
        icon: '🗑',
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
        icon: '🗑',
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
    const soundIcon = document.getElementById('soundIcon');
    if (soundToggle) soundToggle.classList.toggle('active', soundEnabled);
    if (soundIcon) soundIcon.textContent = soundEnabled ? '🔊' : '🔇';

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

    loadCurrentSessionState();
    updateAutoToggleButton();
}

document.addEventListener('keydown', (event) => {
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

// Load theme settings
(function () {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    const color = localStorage.getItem('primaryColor');
    if (color) {
        const num = parseInt(color.replace('#', ''), 16);
        const amount = Math.round(2.55 * 30);

        const red = (num >> 16) + amount;
        const green = ((num >> 8) & 0x00FF) + amount;
        const blue = (num & 0x0000FF) + amount;

        const lightColor = '#'
            + (
                0x1000000
                + (red < 255 ? (red < 1 ? 0 : red) : 255) * 0x10000
                + (green < 255 ? (green < 1 ? 0 : green) : 255) * 0x100
                + (blue < 255 ? (blue < 1 ? 0 : blue) : 255)
            )
                .toString(16)
                .slice(1);

        document.documentElement.style.setProperty('--primary-color', color);
        document.documentElement.style.setProperty('--primary-light', lightColor);

        const rgb = hexToRgb(color);
        const shadowLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.25 : 0.15})`;
        const shadowHeavy = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.45 : 0.35})`;

        document.documentElement.style.setProperty('--shadow', shadowLight);
        document.documentElement.style.setProperty('--shadow-heavy', shadowHeavy);
    }

    const fontSize = localStorage.getItem('fontSize');
    if (fontSize !== null) {
        const fontSizes = [12, 14, 16, 18, 20, 24, 28];
        const baseSize = fontSizes[parseInt(fontSize, 10)] || 16;
        document.documentElement.style.setProperty('--font-size-base', `${baseSize}px`);
        document.documentElement.style.setProperty('--font-size-ayah', `${baseSize + 8}px`);
        document.documentElement.style.setProperty('--font-size-header', `${baseSize + 6}px`);
    }
})();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
}
