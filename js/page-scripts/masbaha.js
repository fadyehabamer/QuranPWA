let count = 0;
        let target = 0;
        let soundEnabled = true;
        let selectedSound = 'beep';
        let vibrationEnabled = true;
        let lifetimeCount = 0;
        let history = [];
        let audioContext = null;

        const circle = document.getElementById('progressCircle');

        function updateCircumference() {
            const radius = circle.r.baseVal.value;
            const circumference = radius * 2 * Math.PI;
            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            circle.style.strokeDashoffset = circumference;
            return circumference;
        }

        let circumference = updateCircumference();

        function initAudio() {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }

        function playClickSound() {
            if (!soundEnabled) return;

            initAudio();
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

        function updateDisplay() {
            document.getElementById('counterValue').textContent = count;

            if (target > 0) {
                const progress = Math.min(count / target, 1);
                const offset = circumference - (progress * circumference);
                circle.style.strokeDashoffset = offset;
                document.getElementById('targetDisplay').textContent = `الهدف: ${count} / ${target}`;
            } else {
                circle.style.strokeDashoffset = circumference;
                document.getElementById('targetDisplay').textContent = 'الهدف: غير محدد';
            }
        }

        function increment() {
            count++;
            lifetimeCount++;
            updateDisplay();
            playClickSound();

            // Ripple effect
            const btn = document.getElementById('tapButton');
            btn.classList.remove('ripple');
            void btn.offsetWidth; // Trigger reflow
            btn.classList.add('ripple');

            triggerVibration();
            saveLifetimeCount();

            if (window.recordHabitActivity) {
                window.recordHabitActivity('masbaha');
            }

            if (target > 0 && count === target) {
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
                    updateDisplay();
                }
            });
        }

        function setTarget(value) {
            target = value;
            updateDisplay();

            // Update active preset button
            document.querySelectorAll('.preset-btn').forEach(btn => {
                if (parseInt(btn.textContent) === value) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        function setCustomTarget() {
            const input = document.getElementById('customTargetInput');
            const value = parseInt(input.value);

            if (value && value > 0) {
                target = value;
                updateDisplay();
                input.value = '';

                // Remove active class from preset buttons
                document.querySelectorAll('.preset-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
            }
        }

        function toggleSoundMenu() {
            const selector = document.getElementById('soundSelector');
            if (selector.style.display === 'block') {
                selector.style.display = 'none';
            } else {
                selector.style.display = 'block';
                // Ensure sound is enabled when opening menu
                if (!soundEnabled) {
                    toggleSound();
                }
            }
        }

        function toggleSound() {
            soundEnabled = !soundEnabled;
            const toggle = document.getElementById('soundToggle');
            const icon = document.getElementById('soundIcon');

            if (soundEnabled) {
                toggle.classList.add('active');
                icon.textContent = '🔊';
            } else {
                toggle.classList.remove('active');
                icon.textContent = '🔇';
            }
            localStorage.setItem('masbahaSound', soundEnabled);
        }

        function changeSound(value) {
            selectedSound = value;
            localStorage.setItem('masbahaSoundType', value);
            playClickSound();
            // Hide selector after selection
            setTimeout(() => {
                document.getElementById('soundSelector').style.display = 'none';
            }, 200);
        }

        function toggleVibration() {
            vibrationEnabled = !vibrationEnabled;
            const toggle = document.getElementById('vibrationToggle');

            if (vibrationEnabled) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }

            localStorage.setItem('masbahaVibration', vibrationEnabled);
        }

        function triggerVibration() {
            if (vibrationEnabled && navigator.vibrate) {
                navigator.vibrate(30);
            }
        }

        function saveLifetimeCount() {
            localStorage.setItem('masbahaLifetime', lifetimeCount);
            document.querySelector('#lifetimeCounter span').textContent = `مجموع التسبيحات: ${lifetimeCount}`;
        }

        function selectDhikr(value, element) {
            const dhikrTargets = {
                'subhan_allah': 33,
                'alhamdulillah': 33,
                'allahu_akbar': 33,
                'la_ilaha_illa_allah': 100,
                'astaghfirullah': 100,
                'salat_nabi': 10
            };

            // Update active chip
            if (element) {
                document.querySelectorAll('.dhikr-chip').forEach(chip => chip.classList.remove('active'));
                element.classList.add('active');
            }

            if (value === 'custom') {
                // Keep current target or reset? Let's keep current for now or set to 0
                // target = 0;
            } else if (dhikrTargets[value]) {
                setTarget(dhikrTargets[value]);
                count = 0; // Reset count when changing dhikr? Usually yes.
            }
            updateDisplay();
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
                count: count,
                target: target,
                time: timeString,
                timestamp: now.getTime()
            });

            // Keep only last 10 entries
            if (history.length > 10) {
                history = history.slice(0, 10);
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
            const clearBtn = document.getElementById('clearHistoryBtn');

            if (history.length === 0) {
                list.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">لا يوجد سجل بعد</div>';
                if (clearBtn) clearBtn.style.display = 'none';
                return;
            }

            if (clearBtn) clearBtn.style.display = 'block';
            let html = '';
            history.forEach((item, index) => {
                const targetText = item.target > 0 ? ` / ${item.target}` : '';
                html += `
    <div class="history-item">
        <div class="history-info">
            <div class="history-icon">
                <i class="bi bi-check-lg"></i>
            </div>
            <div class="history-details">
                <div class="history-count">${item.count}${targetText}</div>
                <div class="history-time">${item.time}</div>
            </div>
        </div>
        <div class="history-actions">
            <button class="delete-btn" onclick="deleteHistoryItem(${index})">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    </div>
    `;
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

        function loadData() {
            // Load sound preference
            const savedSound = localStorage.getItem('masbahaSound');
            if (savedSound !== null) {
                soundEnabled = savedSound === 'true';
                const toggle = document.getElementById('soundToggle');
                const icon = document.getElementById('soundIcon');
                if (soundEnabled) {
                    toggle.classList.add('active');
                    icon.textContent = '🔊';
                } else {
                    toggle.classList.remove('active');
                    icon.textContent = '🔇';
                }
            }

            // Load sound type
            const savedSoundType = localStorage.getItem('masbahaSoundType');
            if (savedSoundType) {
                selectedSound = savedSoundType;
                const selector = document.querySelector('.sound-select');
                if (selector) selector.value = selectedSound;
            }

            // Load vibration preference
            const savedVibration = localStorage.getItem('masbahaVibration');
            if (savedVibration !== null) {
                vibrationEnabled = savedVibration === 'true';
            }
            const vibToggle = document.getElementById('vibrationToggle');
            if (vibrationEnabled) {
                vibToggle.classList.add('active');
            } else {
                vibToggle.classList.remove('active');
            }

            // Load lifetime count
            const savedLifetime = localStorage.getItem('masbahaLifetime');
            if (savedLifetime) {
                lifetimeCount = parseInt(savedLifetime);
                document.querySelector('#lifetimeCounter span').textContent = `مجموع التسبيحات: ${lifetimeCount}`;
            }

            // Load history
            const savedHistory = localStorage.getItem('masbahaHistory');
            if (savedHistory) {
                history = JSON.parse(savedHistory);
                renderHistory();
            }
        }

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                increment();
            }
        });

        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : {
                r: 27,
                g: 94,
                b: 32
            };
        }

        // Initialize
        updateDisplay();
        loadData();

        // Handle window resize to recalculate progress ring
        window.addEventListener('resize', () => {
            circumference = updateCircumference();
            updateDisplay();
        });

        // Load theme settings
        (function () {
            const darkMode = localStorage.getItem('darkMode') === 'true';
            if (darkMode) document.documentElement.setAttribute('data-theme', 'dark');

            const color = localStorage.getItem('primaryColor');
            if (color) {
                const num = parseInt(color.replace('#', ''), 16);
                const amt = Math.round(2.55 * 30);
                const R = (num >> 16) + amt;
                const G = (num >> 8 & 0x00FF) + amt;
                const B = (num & 0x0000FF) + amt;
                const lightColor = '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) *
                    0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
                document.documentElement.style.setProperty('--primary-color', color);
                document.documentElement.style.setProperty('--primary-light', lightColor); // Update shadow colors const
                rgb = hexToRgb(color); const shadowLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.25 : 0.15})`; const
                    shadowHeavy = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.45 : 0.35})`;
                document.documentElement.style.setProperty('--shadow', shadowLight);
                document.documentElement.style.setProperty('--shadow-heavy', shadowHeavy);
            } const
                fontSize = localStorage.getItem('fontSize'); if (fontSize !== null) {
                    const fontSizes = [12, 14, 16, 18, 20, 24, 28];
                    const baseSize = fontSizes[parseInt(fontSize)] || 16;
                    document.documentElement.style.setProperty('--font-size-base', baseSize + 'px');
                    document.documentElement.style.setProperty('--font-size-ayah', (baseSize + 8) + 'px');
                    document.documentElement.style.setProperty('--font-size-header', (baseSize + 6) + 'px');
                }
        })(); if
            ('serviceWorker' in navigator) { navigator.serviceWorker.register('/js/sw.js', { scope: '/' }); }
