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

// ===== Ramadan Decorations =====
(function initRamadanDecor() {
    const style = document.createElement('style');
    style.textContent = `
        .ramadan-corner {
            position: fixed;
            top: 0;
            z-index: 9998;
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
            z-index: 9997;
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

    const leftCorner  = makeCorner(lanterns[0], lanterns[1]);
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

// Fetch visitor count from GoatCounter
async function loadVisitorCount() {
    const countElement = document.getElementById('visitorCount');
    if (!countElement) return;
    
    try {
        const response = await fetch('https://fadyehabamer.goatcounter.com/counter/' + encodeURIComponent(window.location.pathname) + '.json');
        const data = await response.json();
        countElement.textContent = (data.count || 0).toLocaleString('ar-EG');
    } catch (error) {
        try {
            // Fallback: get total count
            const response = await fetch('https://fadyehabamer.goatcounter.com/counter/.json');
            const data = await response.json();
            const total = Object.values(data).reduce((sum, val) => sum + (val.count || 0), 0);
            countElement.textContent = total.toLocaleString('ar-EG');
        } catch (e) {
            countElement.textContent = '—';
        }
    }
}
