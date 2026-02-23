// Modal Functions
function showModal(options) {
    const modal = document.getElementById('customModal');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    const message = document.getElementById('modalMessage');
    const actions = document.getElementById('modalActions');

    // Set icon
    icon.className = `modal-icon ${options.type || 'info'}`;
    if (options.icon && options.icon.includes('<')) {
        icon.innerHTML = options.icon;
    } else {
        icon.textContent = options.icon || '✓';
    }

    // Set content
    title.textContent = options.title || '';
    message.innerHTML = options.message || '';

    // Set actions
    actions.innerHTML = '';

    if (options.confirmText) {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'modal-btn modal-btn-primary';
        confirmBtn.textContent = options.confirmText;
        confirmBtn.onclick = () => {
            hideModal();
            if (options.onConfirm) options.onConfirm();
        };
        actions.appendChild(confirmBtn);
    }

    if (options.cancelText) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'modal-btn modal-btn-secondary';
        cancelBtn.textContent = options.cancelText;
        cancelBtn.onclick = () => {
            hideModal();
            if (options.onCancel) options.onCancel();
        };
        actions.appendChild(cancelBtn);
    }

    if (!options.confirmText && !options.cancelText) {
        const okBtn = document.createElement('button');
        okBtn.className = 'modal-btn modal-btn-primary';
        okBtn.textContent = 'حسناً';
        okBtn.onclick = hideModal;
        actions.appendChild(okBtn);
    }

    modal.classList.add('active');
}

function hideModal() {
    const modal = document.getElementById('customModal');
    modal.classList.remove('active');
}

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('customModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
    }

    // Load visitor count
    loadVisitorCount();
});

// ===== Ramadan Streak Tracker =====
(function initRamadanStreak() {
    const savedStart = localStorage.getItem('ramadanStartDate');
    const RAMADAN_START = savedStart ? new Date(savedStart) : null;
    const RAMADAN_END = RAMADAN_START ? new Date(RAMADAN_START.getTime() + 30 * 86400000) : null;

    function toDateStr(d) {
        return d.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    function today() { return toDateStr(new Date()); }

    function recordVisit() {
        const todayStr = today();
        const raw = localStorage.getItem('ramadanVisits');
        const visits = raw ? JSON.parse(raw) : [];
        if (!visits.includes(todayStr)) {
            visits.push(todayStr);
            localStorage.setItem('ramadanVisits', JSON.stringify(visits));
        }
        return visits;
    }

    function calcStreak(visits) {
        const set = new Set(visits);
        let streak = 0;
        const d = new Date();
        // if today not visited yet, start from yesterday
        if (!set.has(toDateStr(d))) d.setDate(d.getDate() - 1);
        while (set.has(toDateStr(d))) {
            streak++;
            d.setDate(d.getDate() - 1);
        }
        return streak;
    }

    function calcBest(visits) {
        if (!visits.length) return 0;
        const sorted = [...visits].sort();
        let best = 1, cur = 1;
        for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1]);
            const curr = new Date(sorted[i]);
            const diff = (curr - prev) / 86400000;
            if (diff === 1) { cur++; best = Math.max(best, cur); }
            else if (diff > 1) cur = 1;
        }
        return best;
    }

    function ramadanDay() {
        if (!RAMADAN_START) return 1;
        const now = new Date();
        const diff = Math.floor((now - RAMADAN_START) / 86400000) + 1;
        return Math.max(1, Math.min(diff, 30));
    }

    function inRamadan() {
        if (!RAMADAN_START) return true; // Always show if not configured
        const now = new Date();
        return now >= RAMADAN_START && now <= new Date(RAMADAN_END.getTime() + 86400000);
    }

    function buildCalendar(visits) {
        if (!RAMADAN_START) return '';
        const set = new Set(visits);
        let html = '<div class="rstreak-cal">';
        for (let i = 0; i < 30; i++) {
            const d = new Date(RAMADAN_START);
            d.setDate(d.getDate() + i);
            const ds = toDateStr(d);
            const now = new Date();
            const isFuture = d > now;
            const isVisited = set.has(ds);
            const isToday = ds === today();
            let cls = 'rscal-day';
            if (isToday) cls += ' today';
            else if (isFuture) cls += ' future';
            else if (isVisited) cls += ' visited';
            else cls += ' missed';
            html += `<div class="${cls}" title="يوم ${i + 1}">${i + 1}</div>`;
        }
        html += '</div>';
        return html;
    }

    const CSS = `
        .rstreak-fab {
            position: fixed;
            bottom: 145px;
            left: 20px;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: linear-gradient(135deg, #e65c00, #f9d423);
            color: #fff;
            border: none;
            font-size: 22px;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(230,92,0,0.45);
            z-index: 1100;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            line-height: 1;
            transition: transform 0.2s;
        }
        .rstreak-fab:hover { transform: scale(1.1); }
        .rstreak-fab-count {
            font-size: 10px;
            font-weight: 700;
            line-height: 1;
            margin-top: 1px;
        }
        .rstreak-panel {
            position: fixed;
            bottom: 210px;
            left: 20px;
            width: 310px;
            background: var(--card-bg, #fff);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.18);
            z-index: 1099;
            overflow: hidden;
            display: none;
            flex-direction: column;
            border: 1px solid var(--border-color, #e8e8e8);
            font-family: 'Cairo', sans-serif;
        }
        .rstreak-panel.open { display: flex; }
        .rstreak-header {
            background: linear-gradient(135deg, #e65c00, #f9d423);
            color: #fff;
            padding: 12px 16px;
            font-weight: 700;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .rstreak-stats {
            display: flex;
            gap: 0;
            border-bottom: 1px solid var(--border-color, #e8e8e8);
        }
        .rstreak-stat {
            flex: 1;
            padding: 12px 8px;
            text-align: center;
            border-left: 1px solid var(--border-color, #e8e8e8);
        }
        .rstreak-stat:last-child { border-left: none; }
        .rstreak-stat-val {
            font-size: 26px;
            font-weight: 700;
            color: #e65c00;
            line-height: 1;
        }
        .rstreak-stat-lbl {
            font-size: 11px;
            color: var(--text-secondary, #666);
            margin-top: 3px;
        }
        .rstreak-cal-wrap { padding: 10px 12px 12px; }
        .rstreak-cal-title {
            font-size: 12px;
            color: var(--text-secondary, #666);
            margin-bottom: 6px;
            text-align: center;
        }
        .rstreak-cal {
            display: grid;
            grid-template-columns: repeat(10, 1fr);
            gap: 3px;
        }
        .rscal-day {
            aspect-ratio: 1;
            border-radius: 4px;
            font-size: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
        }
        .rscal-day.visited { background: #e65c00; color: #fff; }
        .rscal-day.today   { background: #f9d423; color: #333; box-shadow: 0 0 0 2px #e65c00; }
        .rscal-day.missed  { background: #f0f0f0; color: #aaa; }
        .rscal-day.future  { background: transparent; border: 1px dashed #ddd; color: #ccc; }
        .rstreak-msg {
            text-align: center;
            font-size: 12px;
            padding: 0 12px 12px;
            color: var(--text-secondary, #666);
        }
        [data-theme="dark"] .rscal-day.missed { background: #2a2a2a; color: #555; }
        [data-theme="dark"] .rscal-day.future { border-color: #333; color: #444; }

        .rstreak-setup {
            padding: 20px 16px;
            text-align: center;
        }
        .rstreak-setup-desc {
            font-size: 13px;
            color: var(--text-secondary, #666);
            margin-bottom: 16px;
        }
        .rstreak-select {
            width: 100%;
            padding: 10px;
            border-radius: 8px;
            border: 1px solid var(--border-color, #e8e8e8);
            background: var(--card-bg, #fff);
            color: var(--text-color, #333);
            font-family: inherit;
            margin-bottom: 16px;
            font-size: 14px;
        }
        .rstreak-btn {
            width: 100%;
            padding: 10px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #e65c00, #f9d423);
            color: #fff;
            font-weight: 700;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        .rstreak-btn:hover { opacity: 0.9; }

        @media (max-width: 768px) {
            .rstreak-fab, .rstreak-panel { display: none !important; }
        }
    `;

    function inject() {
        if (!inRamadan()) return;

        const visits = recordVisit();
        const streak = calcStreak(visits);
        const best = calcBest(visits);
        const total = visits.length;
        const rDay = ramadanDay();

        const styleEl = document.createElement('style');
        styleEl.textContent = CSS;
        document.head.appendChild(styleEl);

        const fab = document.createElement('button');
        fab.className = 'rstreak-fab';
        fab.id = 'rstreakFab';
        fab.title = 'تتبع رمضان';
        fab.innerHTML = `🔥<span class="rstreak-fab-count">${streak}</span>`;
        fab.onclick = toggleStreakPanel;

        const encouragements = [
            'أنت رائع! واصل المسيرة 💪',
            'استمر في القراءة! بارك الله فيك ✨',
            'كل يوم خطوة نحو الله 🌙',
            'رمضان فرصة، لا تضيّعها ⭐',
        ];
        const msg = encouragements[streak % encouragements.length];

        const panel = document.createElement('div');
        panel.className = 'rstreak-panel';
        panel.id = 'rstreakPanel';

        if (!RAMADAN_START) {
            panel.innerHTML = `
                <div class="rstreak-header">🔥 إعداد تتبع رمضان</div>
                <div class="rstreak-setup">
                    <div class="rstreak-setup-desc">اختر بداية شهر رمضان المبارك لضبط عداد التتبع</div>
                    <select class="rstreak-select" id="rstreakDateSelect">
                        <option value="2026-02-18">18 فبراير (السعودية ودول أخرى)</option>
                        <option value="2026-02-19">19 فبراير (مصر ودول أخرى)</option>
                    </select>
                    <button class="rstreak-btn" id="rstreakSaveBtn">حفظ وضبط</button>
                </div>
            `;
            setTimeout(() => {
                const saveBtn = document.getElementById('rstreakSaveBtn');
                if (saveBtn) {
                    saveBtn.onclick = () => {
                        const select = document.getElementById('rstreakDateSelect');
                        localStorage.setItem('ramadanStartDate', select.value);
                        location.reload();
                    };
                }
            }, 0);
        } else {
            panel.innerHTML = `
                <div class="rstreak-header">🔥 تتبع رمضان ${new Date().getFullYear()}</div>
                <div class="rstreak-stats">
                    <div class="rstreak-stat">
                        <div class="rstreak-stat-val">${streak}</div>
                        <div class="rstreak-stat-lbl">الحالي 🔥</div>
                    </div>
                    <div class="rstreak-stat">
                        <div class="rstreak-stat-val">${best}</div>
                        <div class="rstreak-stat-lbl">الأفضل ⭐</div>
                    </div>
                    <div class="rstreak-stat">
                        <div class="rstreak-stat-val">${total}</div>
                        <div class="rstreak-stat-lbl">إجمالي أيام</div>
                    </div>
                    <div class="rstreak-stat">
                        <div class="rstreak-stat-val">${rDay}</div>
                        <div class="rstreak-stat-lbl">يوم رمضان</div>
                    </div>
                </div>
                <div class="rstreak-cal-wrap">
                    <div class="rstreak-cal-title">أيام رمضان الثلاثون</div>
                    ${buildCalendar(visits)}
                </div>
                <div class="rstreak-msg">${msg}</div>
            `;
        }

        document.body.appendChild(fab);
        document.body.appendChild(panel);
    }

    let _open = false;
    function toggleStreakPanel() {
        _open = !_open;
        const panel = document.getElementById('rstreakPanel');
        if (panel) panel.classList.toggle('open', _open);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();

// ===== Ramadan Decorations =====
(function initRamadanDecor() {
    const style = document.createElement('style');
    style.textContent = `
        .ramadan-corner {
            position: fixed;
            top: 0;
            z-index: 50;
            pointer-events: none;
            display: flex;
            align-items: flex-start;
        }
        .ramadan-corner-left  { left: 0; }
        .ramadan-corner-right { right: 0; flex-direction: row-reverse; }

        .ramadan-rope {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .ramadan-rope::before {
            content: '';
            display: block;
            width: 2px;
            height: 28px;
            background: linear-gradient(to bottom, #aaa 0%, #666 100%);
        }
        .ramadan-rope:nth-child(2) { margin-top: 18px; }

        .ramadan-lantern {
            transform-origin: top center;
            animation: lanternSwing 3.6s ease-in-out infinite;
        }
        .ramadan-rope:nth-child(1) .ramadan-lantern { animation-delay: 0s; }
        .ramadan-rope:nth-child(2) .ramadan-lantern { animation-delay: -1.8s; }

        @keyframes lanternSwing {
            0%,100% { transform: rotate(-9deg); }
            50%      { transform: rotate(9deg);  }
        }

        /* twinkling stars row */
        .ramadan-stars {
            position: fixed;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 18px;
            pointer-events: none;
            z-index: 40;
        }
        .ramadan-star {
            font-size: 14px;
            color: #FFD700;
            animation: starTwinkle 2s ease-in-out infinite;
        }
        .ramadan-star:nth-child(2) { animation-delay: 0.4s; font-size: 10px; }
        .ramadan-star:nth-child(3) { animation-delay: 0.8s; font-size: 16px; }
        .ramadan-star:nth-child(4) { animation-delay: 1.2s; font-size: 10px; }
        .ramadan-star:nth-child(5) { animation-delay: 1.6s; font-size: 14px; }
        @keyframes starTwinkle {
            0%,100% { opacity: 1;   transform: scale(1);    }
            50%      { opacity: 0.3; transform: scale(0.75); }
        }
    `;
    document.head.appendChild(style);

    function lanternSVG(body, cap, glyph) {
        return `<svg width="42" height="66" viewBox="0 0 42 66" xmlns="http://www.w3.org/2000/svg">
            <rect x="15" y="0" width="12" height="5" rx="2" fill="${cap}"/>
            <path d="M10 5 Q21 3 32 5 L36 14 Q21 11 6 14Z" fill="${cap}"/>
            <ellipse cx="21" cy="36" rx="15" ry="22" fill="${body}" opacity="0.92"/>
            <ellipse cx="21" cy="36" rx="15" ry="22" fill="url(#lg_${glyph.charCodeAt(0)})" opacity="0.18"/>
            <line x1="7"  y1="24" x2="35" y2="24" stroke="${cap}" stroke-width="1.4" opacity="0.55"/>
            <line x1="6"  y1="36" x2="36" y2="36" stroke="${cap}" stroke-width="1.4" opacity="0.55"/>
            <line x1="7"  y1="48" x2="35" y2="48" stroke="${cap}" stroke-width="1.4" opacity="0.55"/>
            <text x="21" y="41" text-anchor="middle" font-size="13" fill="#FFD700" opacity="0.95">${glyph}</text>
            <path d="M10 55 Q21 58 32 55 L36 50 Q21 53 6 50Z" fill="${cap}"/>
            <circle cx="21" cy="60" r="4" fill="#FFD700" opacity="0.7"/>
            <circle cx="21" cy="60" r="7" fill="#FFD700" opacity="0.15"/>
            <defs>
                <radialGradient id="lg_${glyph.charCodeAt(0)}" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#FFFFFF"/>
                    <stop offset="100%" stop-color="transparent"/>
                </radialGradient>
            </defs>
        </svg>`;
    }

    const lanterns = [
        { body: '#D4820A', cap: '#9A5F07', glyph: '✦' }, // golden-orange
        { body: '#C0392B', cap: '#922B21', glyph: '★' }, // red
        { body: '#F1C40F', cap: '#B7950B', glyph: '✦' }, // golden
        { body: '#27AE60', cap: '#1E8449', glyph: '★' }, // green
    ];

    function makeCorner(l1, l2) {
        const div = document.createElement('div');
        div.className = 'ramadan-corner';
        div.innerHTML = `
            <div class="ramadan-rope"><div class="ramadan-lantern">${lanternSVG(l1.body, l1.cap, l1.glyph)}</div></div>
            <div class="ramadan-rope"><div class="ramadan-lantern">${lanternSVG(l2.body, l2.cap, l2.glyph)}</div></div>
        `;
        return div;
    }

    const starsRow = document.createElement('div');
    starsRow.className = 'ramadan-stars';
    starsRow.innerHTML = '★✦★✦★'.split('').map(s => `<span class="ramadan-star">${s}</span>`).join('');

    const leftCorner = makeCorner(lanterns[0], lanterns[1]);
    leftCorner.classList.add('ramadan-corner-left');
    const rightCorner = makeCorner(lanterns[2], lanterns[3]);
    rightCorner.classList.add('ramadan-corner-right');

    function inject() {
        document.body.appendChild(leftCorner);
        document.body.appendChild(rightCorner);
        document.body.appendChild(starsRow);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();

function loadVisitorCount() {
    const el = document.getElementById('visitorCount');
    if (el) el.style.display = 'none';
}

// ===== Quran Radio Player =====
(function initRadioPlayer() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .radio-fab {
            position: fixed;
            bottom: 80px;
            left: 20px;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary-color, #1B5E20), var(--primary-light, #2E7D32));
            color: #fff;
            border: none;
            font-size: 22px;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(0,0,0,0.25);
            z-index: 1100;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        }
        .radio-fab:hover { transform: scale(1.1); }
        .radio-panel {
            position: fixed;
            bottom: 145px;
            left: 20px;
            width: 290px;
            background: var(--card-bg, #fff);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.18);
            z-index: 1099;
            overflow: hidden;
            display: none;
            flex-direction: column;
            border: 1px solid var(--border-color, #e8e8e8);
        }
        .radio-panel.open { display: flex; }
        .radio-panel-header {
            background: linear-gradient(135deg, var(--primary-color, #1B5E20), var(--primary-light, #2E7D32));
            color: #fff;
            padding: 12px 14px;
            font-weight: 700;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .radio-now {
            padding: 10px 14px 6px;
            font-size: 13px;
            color: var(--text-secondary, #666);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            border-bottom: 1px solid var(--border-color, #e8e8e8);
        }
        .radio-now strong { color: var(--text-color, #1a1a1a); font-size: 14px; }
        .radio-controls {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border-bottom: 1px solid var(--border-color, #e8e8e8);
        }
        .radio-play-btn {
            width: 40px; height: 40px;
            border-radius: 50%;
            border: none;
            background: var(--primary-color, #1B5E20);
            color: #fff;
            font-size: 18px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .radio-volume { flex: 1; accent-color: var(--primary-color, #1B5E20); }
        .radio-stations { list-style: none; max-height: 190px; overflow-y: auto; padding: 6px 0; }
        .radio-stations li {
            padding: 9px 14px;
            font-size: 13px;
            cursor: pointer;
            color: var(--text-color, #1a1a1a);
            transition: background 0.15s;
            display: flex; align-items: center; gap: 8px;
        }
        .radio-stations li:hover { background: var(--bg-color, #f8f9fa); }
        .radio-stations li.active { background: rgba(27,94,32,0.1); font-weight: 600; color: var(--primary-color, #1B5E20); }
        .radio-stations li .rdot {
            width: 8px; height: 8px; border-radius: 50%;
            background: var(--border-color, #e8e8e8); flex-shrink: 0;
        }
        .radio-stations li.active .rdot { background: var(--primary-color, #1B5E20); animation: rdotPulse 1.2s ease infinite; }
        .radio-loading { text-align: center; padding: 16px; color: var(--text-secondary, #666); font-size: 13px; }
        @keyframes rdotPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:0.5} }

        @media (max-width: 768px) {
            .radio-fab, .radio-panel { display: none !important; }
        }
    `;
    document.head.appendChild(style);

    const STATIONS = [
        { name: 'إذاعة القرآن الكريم - القاهرة', url: 'https://n05.radiojar.com/8s5u5tpdtwzuv?rj-ttl=5&rj-tok=AAABnItaNF8Ast9L_3iEQzei5w' },
        { name: 'إذاعة القرآن الكريم - السعودية', url: 'https://live.mp3quran.net/saudi' },
        { name: 'إذاعة نور القرآن', url: 'https://stream.radiojar.com/0tpy1h0kxtzuv' },
    ];

    let _audio = null;
    let _activeIdx = -1;
    let _playing = false;
    let _panelOpen = false;

    function inject() {
        const fab = document.createElement('button');
        fab.className = 'radio-fab';
        fab.id = 'radioFab';
        fab.title = 'راديو القرآن الكريم';
        fab.innerHTML = '<i class="bi bi-broadcast"></i>';
        fab.onclick = togglePanel;

        const panel = document.createElement('div');
        panel.className = 'radio-panel';
        panel.id = 'radioPanel';
        panel.innerHTML = `
            <div class="radio-panel-header"><i class="bi bi-broadcast-pin"></i> راديو القرآن الكريم</div>
            <div class="radio-now" id="radioNowPlaying">اختر محطة للبدء</div>
            <div class="radio-controls">
                <button class="radio-play-btn" id="radioPlayBtn">
                    <i class="bi bi-play-fill" id="radioPlayIcon"></i>
                </button>
                <input type="range" class="radio-volume" id="radioVolume" min="0" max="1" step="0.05" value="0.8">
                <i class="bi bi-volume-up-fill" style="color:var(--text-secondary,#666);font-size:16px"></i>
            </div>
            <ul class="radio-stations" id="radioStationList"></ul>
        `;

        _audio = document.createElement('audio');
        _audio.id = 'quranRadioAudio';
        _audio.preload = 'none';

        document.body.appendChild(fab);
        document.body.appendChild(panel);
        document.body.appendChild(_audio);

        document.getElementById('radioPlayBtn').onclick = togglePlay;
        document.getElementById('radioVolume').oninput = function () { if (_audio) _audio.volume = parseFloat(this.value); };

        renderStations();
    }

    function renderStations() {
        const list = document.getElementById('radioStationList');
        if (!list) return;
        list.innerHTML = STATIONS.map((s, i) => `
            <li onclick="window._radioSelectStation(${i})" class="${i === _activeIdx ? 'active' : ''}">
                <span class="rdot"></span>${s.name}
            </li>`).join('');
    }

    window._radioSelectStation = function (idx) {
        _activeIdx = idx;
        const s = STATIONS[idx];
        const nowEl = document.getElementById('radioNowPlaying');
        if (nowEl) nowEl.innerHTML = `<strong>${s.name}</strong>`;

        if (_audio) {
            _audio.pause();
            _audio.src = s.url;
            _audio.volume = parseFloat(document.getElementById('radioVolume')?.value || 0.8);
            const playPromise = _audio.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // stream might need retry
                    setTimeout(() => _audio.play().catch(() => { }), 1000);
                });
            }
        }
        _playing = true;
        const icon = document.getElementById('radioPlayIcon');
        if (icon) icon.className = 'bi bi-pause-fill';
        renderStations();
    };

    function togglePlay() {
        if (_activeIdx === -1) { window._radioSelectStation(0); return; }
        if (!_audio) return;
        if (_audio.paused) {
            _audio.play().catch(() => { });
            _playing = true;
            const icon = document.getElementById('radioPlayIcon');
            if (icon) icon.className = 'bi bi-pause-fill';
        } else {
            _audio.pause();
            _playing = false;
            const icon = document.getElementById('radioPlayIcon');
            if (icon) icon.className = 'bi bi-play-fill';
        }
    }

    function togglePanel() {
        _panelOpen = !_panelOpen;
        const panel = document.getElementById('radioPanel');
        if (panel) panel.classList.toggle('open', _panelOpen);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();
// Theme & Settings Management
function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('darkMode', 'false');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('darkMode', 'true');
    }
}

function initTheme() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Apply primary color if set
    const primaryColor = localStorage.getItem('primaryColor');
    if (primaryColor) {
        document.documentElement.style.setProperty('--primary-color', primaryColor);
        // Also update RGB for transparency if needed
    }
}

// Initialize on Every Page
initTheme();

// ===== New Landing Page Features =====
document.addEventListener('DOMContentLoaded', () => {
    // 1. Hadith of the Day
    initHadith();

    // 2. Home Prayer Widget
    if (document.getElementById('homePrayerWidget')) {
        initHomePrayerWidget();
    }

    // 3. Hero Search
    const heroSearch = document.getElementById('heroSearch');
    if (heroSearch) {
        heroSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    location.href = `quran?search=${encodeURIComponent(query)}`;
                }
            }
        });
    }
});

// Prayer Utils (Extracted for reuse)
function formatTime(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'م' : 'ص';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

function calculateRemainingTime(prayerTime) {
    const now = new Date();
    const [hours, minutes] = prayerTime.split(':');
    const prayerDate = new Date();
    prayerDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    if (prayerDate <= now) prayerDate.setDate(prayerDate.getDate() + 1);
    const diff = prayerDate - now;
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hoursLeft > 0 ? `${hoursLeft} س و ${minutesLeft} د` : `${minutesLeft} د`;
}

function getNextPrayer(timings) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const prayers = [
        { name: 'Fajr', label: 'الفجر', time: timings.Fajr },
        { name: 'Dhuhr', label: 'الظهر', time: timings.Dhuhr },
        { name: 'Asr', label: 'العصر', time: timings.Asr },
        { name: 'Maghrib', label: 'المغرب', time: timings.Maghrib },
        { name: 'Isha', label: 'العشاء', time: timings.Isha }
    ];
    for (const prayer of prayers) {
        const [h, m] = prayer.time.split(':');
        if ((parseInt(h) * 60 + parseInt(m)) > currentTime) return prayer;
    }
    return { ...prayers[0], tomorrow: true };
}

function initHadith() {
    const HADITHS = [
        "قال رسول الله صلى الله عليه وسلم: (خيركم من تعلم القرآن وعلمه)",
        "قال رسول الله صلى الله عليه وسلم: (الدال على الخير كفاعله)",
        "قال رسول الله صلى الله عليه وسلم: (إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى)",
        "قال رسول الله صلى الله عليه وسلم: (اتق الله حيثما كنت، وأتبع السيئة الحسنة تمحها، وخالق الناس بخلق حسن)",
        "قال رسول الله صلى الله عليه وسلم: (لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه)"
    ];
    const el = document.getElementById('dailyHadith');
    if (el) {
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        el.textContent = HADITHS[dayOfYear % HADITHS.length];
    }
}

async function initHomePrayerWidget() {
    const body = document.getElementById('pwBody');
    const locationEl = document.getElementById('pwLocation');
    const nextEl = document.getElementById('pwNextPrayer');

    let location = localStorage.getItem('userLocation');
    if (!location) {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(pos => {
                const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                localStorage.setItem('userLocation', JSON.stringify(loc));
                updatePrayerUI(loc);
            }, () => {
                locationEl.textContent = 'الموقع غير محدد';
                body.innerHTML = '<a href="prayer-times" style="font-size:12px;color:var(--primary-color);text-decoration:none">اضغط لتحديد موقعك</a>';
            });
        }
    } else {
        updatePrayerUI(JSON.parse(location));
    }

    async function updatePrayerUI(loc) {
        try {
            const prayerNames = { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`https://api.aladhan.com/v1/timings/${today}?latitude=${loc.latitude}&longitude=${loc.longitude}&method=2`);
            const data = await response.json();

            if (data.code === 200) {
                const timings = data.data.timings;
                locationEl.textContent = localStorage.getItem('locationText') || 'موقعك المكتشف';

                const next = getNextPrayer(timings);
                const remaining = calculateRemainingTime(next.time);

                let html = '';
                Object.keys(prayerNames).forEach(key => {
                    const isActive = next.name === key;
                    html += `
                        <div class="pw-item ${isActive ? 'active' : ''}">
                            <div class="pw-name">${prayerNames[key]}</div>
                            <div class="pw-time">${timings[key]}</div>
                        </div>
                    `;
                });
                body.innerHTML = html;
                nextEl.innerHTML = `الصلاة القادمة: <strong>${next.label}</strong> خلال ${remaining}`;
            }
        } catch (e) {
            body.innerHTML = '<p style="font-size:12px;opacity:0.5">فشل تحميل المواقيت</p>';
        }
    }
}
