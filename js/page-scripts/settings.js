let deferredPrompt;
        let notifications = [];
        const fontSizes = ['صغير جداً', 'صغير', 'متوسط', 'كبير', 'كبير جداً', 'ضخم', 'ضخم جداً'];
        const fontSizeValues = [12, 14, 16, 18, 20, 24, 28];
        let currentFontSizeIndex = 2;

        function loadSettings() {
            const featureFlags = window.APP_FEATURE_FLAGS || {};
            const ramadanEnabled = featureFlags.ramadanStreak !== false;

            // Dark mode
            const darkMode = localStorage.getItem('darkMode') === 'true';
            if (darkMode) {
                document.documentElement.setAttribute('data-theme', 'dark');
                document.getElementById('darkModeToggle').classList.add('active');
            }

            // Color
            const color = localStorage.getItem('primaryColor') || '#1B5E20';
            applyColor(color);

            // Font size
            const fontSize = localStorage.getItem('fontSize') || '1';
            currentFontSizeIndex = parseInt(fontSize);
            updateFontSize();

            // Font weight
            loadFontWeight();

            // Notifications
            const notifEnabled = localStorage.getItem('notificationsEnabled') === 'true';
            if (notifEnabled) {
                document.getElementById('notificationsToggle').classList.add('active');
                document.getElementById('notificationSettings').style.display = 'block';
            }

            notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
            renderNotifications();

            // Ramadan settings section visibility
            const ramadanSection = document.getElementById('ramadanSettingsSection');
            if (ramadanSection && !ramadanEnabled) {
                ramadanSection.style.display = 'none';
            }

            // Ramadan Start
            if (ramadanEnabled) {
                const ramadanStart = localStorage.getItem('ramadanStartDate') || '2026-02-18';
                const ramadanSelect = document.getElementById('ramadanStartSelect');
                if (ramadanSelect) {
                    ramadanSelect.value = ramadanStart;
                }
            }
        }

        function changeRamadanStart() {
            const select = document.getElementById('ramadanStartSelect');
            if (select) {
                localStorage.setItem('ramadanStartDate', select.value);
            }
        }

        function toggleDarkMode() {
            const toggle = document.getElementById('darkModeToggle');
            const isDark = toggle.classList.toggle('active');

            if (isDark) {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }

            localStorage.setItem('darkMode', isDark);

            // Update shadow colors when theme changes
            const currentColor = localStorage.getItem('primaryColor') || '#1B5E20';
            applyColor(currentColor);
        }

        function changeColor(color) {
            document.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('active');
                if (opt.getAttribute('data-color') === color) {
                    opt.classList.add('active');
                }
            });

            applyColor(color);
            localStorage.setItem('primaryColor', color);
        }

        function applyColor(color) {
            const lightColor = adjustColor(color, 30);
            document.documentElement.style.setProperty('--primary-color', color);
            document.documentElement.style.setProperty('--primary-light', lightColor);

            // Update shadow colors based on theme color
            const rgb = hexToRgb(color);
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const shadowLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.25 : 0.15})`;
            const shadowHeavy = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.45 : 0.35})`;
            document.documentElement.style.setProperty('--shadow', shadowLight);
            document.documentElement.style.setProperty('--shadow-heavy', shadowHeavy);

            // Update color picker active state
            document.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.toggle('active', opt.getAttribute('data-color') === color);
            });
        }

        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 27, g: 94, b: 32 };
        }

        function adjustColor(color, percent) {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255))
                .toString(16).slice(1);
        }

        function increaseFontSize() {
            if (currentFontSizeIndex < fontSizes.length - 1) {
                currentFontSizeIndex++;
                updateFontSize();

                // Font weight
                loadFontWeight();
            }
        }

        function decreaseFontSize() {
            if (currentFontSizeIndex > 0) {
                currentFontSizeIndex--;
                updateFontSize();

                // Font weight
                loadFontWeight();
            }
        }

        function updateFontSize() {
            const baseSize = fontSizeValues[currentFontSizeIndex];
            document.documentElement.style.setProperty('--font-size-base', baseSize + 'px');
            document.documentElement.style.setProperty('--font-size-ayah', (baseSize + 8) + 'px');
            document.documentElement.style.setProperty('--font-size-header', (baseSize + 6) + 'px');
            document.getElementById('fontSizeDisplay').textContent = fontSizes[currentFontSizeIndex];
            localStorage.setItem('fontSize', currentFontSizeIndex);
        }


        // Font Weight Control
        const fontWeights = [300, 400, 500, 600, 700];
        const fontWeightLabels = ['خفيف', 'عادي', 'متوسط', 'سميك', 'سميك جداً'];
        let currentFontWeightIndex = 1;

        function loadFontWeight() {
            const saved = localStorage.getItem('fontWeight');
            if (saved !== null) {
                currentFontWeightIndex = parseInt(saved);
            }
            updateFontWeight();
        }

        function updateFontWeight() {
            const weight = fontWeights[currentFontWeightIndex];
            document.documentElement.style.setProperty('--font-weight', weight);
            const display = document.getElementById('fontWeightDisplay');
            if (display) {
                display.textContent = fontWeightLabels[currentFontWeightIndex];
            }
            const previewText = document.getElementById('previewText');
            if (previewText) {
                previewText.style.fontWeight = weight;
            }
            localStorage.setItem('fontWeight', currentFontWeightIndex);
        }

        function increaseFontWeight() {
            if (currentFontWeightIndex < fontWeights.length - 1) {
                currentFontWeightIndex++;
                updateFontWeight();
            }
        }

        function decreaseFontWeight() {
            if (currentFontWeightIndex > 0) {
                currentFontWeightIndex--;
                updateFontWeight();
            }
        }
        async function toggleNotifications() {
            const toggle = document.getElementById('notificationsToggle');
            const isEnabled = toggle.classList.toggle('active');

            if (isEnabled) {
                // Request permission
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    document.getElementById('notificationSettings').style.display = 'block';
                    localStorage.setItem('notificationsEnabled', 'true');
                } else {
                    toggle.classList.remove('active');
                    showModal({
                        type: 'warning',
                        icon: '⚠',
                        title: 'تنبيه',
                        message: 'يجب السماح بالإشعارات في إعدادات المتصفح'
                    });
                }
            } else {
                document.getElementById('notificationSettings').style.display = 'none';
                localStorage.setItem('notificationsEnabled', 'false');
            }
        }

        function showAddNotification() {
            const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const selectedDays = [];

            showModal({
                type: 'info',
                icon: '🔔',
                title: 'إضافة تنبيه',
                message: `
                    <div style="text-align: right;">
                        <label style="display: block; margin-bottom: 10px;">اختر الوقت:</label>
                        <input type="time" id="notifTime" class="time-input" style="width: 100%;">
                        
                        <label style="display: block; margin: 15px 0 10px;">اختر الأيام:</label>
                        <div class="days-selector" id="daysSelector">
                            ${daysAr.map((day, i) => `
                                <button class="day-btn" onclick="toggleDay(${i})">${day}</button>
                            `).join('')}
                        </div>
                    </div>
                `,
                confirmText: 'إضافة',
                cancelText: 'إلغاء',
                onConfirm: () => {
                    const time = document.getElementById('notifTime').value;
                    const days = [];
                    document.querySelectorAll('#daysSelector .day-btn.active').forEach(btn => {
                        days.push(parseInt(btn.getAttribute('data-day')));
                    });

                    if (time && days.length > 0) {
                        notifications.push({ time, days });
                        localStorage.setItem('notifications', JSON.stringify(notifications));
                        renderNotifications();
                        scheduleNotifications();
                    }
                }
            });
        }

        window.toggleDay = function (dayIndex) {
            const buttons = document.querySelectorAll('#daysSelector .day-btn');
            const btn = buttons[dayIndex];
            btn.classList.toggle('active');
            btn.setAttribute('data-day', dayIndex);
        };

        function renderNotifications() {
            const list = document.getElementById('notificationList');
            const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

            if (notifications.length === 0) {
                list.innerHTML = '<div style="text-align: center; padding: 20px; opacity: 0.5;">لا توجد تنبيهات</div>';
                return;
            }

            list.innerHTML = notifications.map((notif, index) => `
                <div class="notification-item">
                    <div class="notification-info">
                        <div class="notification-time">${notif.time}</div>
                        <div class="notification-days">${notif.days.map(d => daysAr[d]).join(' • ')}</div>
                    </div>
                    <button class="delete-notification-btn" onclick="deleteNotification(${index})">حذف</button>
                </div>
            `).join('');
        }

        function deleteNotification(index) {
            showModal({
                type: 'warning',
                icon: '⚠',
                title: 'تأكيد الحذف',
                message: 'هل تريد حذف هذا التنبيه؟',
                confirmText: 'حذف',
                cancelText: 'إلغاء',
                onConfirm: () => {
                    notifications.splice(index, 1);
                    localStorage.setItem('notifications', JSON.stringify(notifications));
                    renderNotifications();
                }
            });
        }

        function scheduleNotifications() {
            // This would integrate with the service worker for actual scheduling
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                navigator.serviceWorker.ready.then(registration => {
                    // Schedule notifications based on saved times
                    notifications.forEach(notif => {
                        const [hours, minutes] = notif.time.split(':');
                        const now = new Date();
                        const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
                            parseInt(hours), parseInt(minutes));

                        if (scheduledTime > now && notif.days.includes(now.getDay())) {
                            const delay = scheduledTime - now;
                            setTimeout(() => {
                                registration.showNotification('القرآن الكريم', {
                                    body: 'حان وقت قراءة القرآن والأذكار',
                                    icon: 'assets/icons/icon-192.png',
                                    badge: 'assets/icons/icon-192.png',
                                    vibrate: [200, 100, 200],
                                    dir: 'rtl',
                                    lang: 'ar'
                                });
                            }, delay);
                        }
                    });
                });
            }
        }

        function saveSettings() {
            showModal({
                type: 'success',
                icon: '',
                title: 'تم الحفظ',
                message: 'تم حفظ جميع الإعدادات بنجاح'
            });
        }

        // PWA Installation
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const installBtn = document.getElementById('installBtn');
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.textContent = '⬇️';
            }
        });

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            const installBtn = document.getElementById('installBtn');
            if (installBtn) {
                installBtn.textContent = '✅';
                installBtn.disabled = true;
                installBtn.style.opacity = '0.6';
            }
        }

        function installApp() {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        showModal({
                            type: 'success',
                            icon: '📱',
                            title: 'تم التثبيت',
                            message: 'تم تثبيت التطبيق على جهازك بنجاح'
                        });
                    } else {
                        showModal({
                            type: 'info',
                            icon: 'ℹ️',
                            title: 'تم الإلغاء',
                            message: 'تم إلغاء تثبيت التطبيق'
                        });
                    }
                    deferredPrompt = null;
                    document.getElementById('installBtn').style.display = 'none';
                });
            } else {
                // Check if already installed
                if (window.matchMedia('(display-mode: standalone)').matches) {
                    showModal({
                        type: 'info',
                        icon: '✅',
                        title: 'مثبت بالفعل',
                        message: 'التطبيق مثبت بالفعل على جهازك'
                    });
                } else {
                    // Provide manual installation instructions
                    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                    const isChrome = /Chrome|CriOS/i.test(navigator.userAgent);
                    const isMobile = isIOS || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                    if (isIOS) {
                        showModal({
                            type: 'info',
                            icon: '📱',
                            title: 'تثبيت على iPhone',
                            message: 'اضغط على زر "مشاركة" (Square with Arrow) ← ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen)'
                        });
                    } else if (isMobile && isChrome) {
                        showModal({
                            type: 'info',
                            icon: '📱',
                            title: 'تثبيت يدوي',
                            message: 'اضغط على ⋮ (القائمة) في أعلى اليمين ← ثم اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"'
                        });
                    } else if (isMobile) {
                        showModal({
                            type: 'warning',
                            icon: '⚠️',
                            title: 'تنبيه التثبيت',
                            message: 'لأفضل تجربة، يرجى استخدام متصفح Safari على iPhone أو Chrome على Android لتثبيت التطبيق.'
                        });
                    } else {
                        showModal({
                            type: 'warning',
                            icon: '⚠️',
                            title: 'تثبيت الكمبيوتر',
                            message: 'يرجى استخدام متصفح Chrome أو Edge والنقر على أيقونة التثبيت في شريط العنوان.'
                        });
                    }
                }
            }
        }

        async function clearCache() {
            try {
                // Clear service worker caches
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    const registration = await navigator.serviceWorker.ready;
                    const channel = new MessageChannel();

                    const response = await new Promise((resolve, reject) => {
                        channel.port1.onmessage = event => {
                            if (event.data.success) {
                                resolve();
                            } else {
                                reject(new Error(event.data.error));
                            }
                        };

                        registration.active.postMessage({ type: 'CLEAR_CACHE' }, [channel.port2]);

                        // Timeout after 5 seconds
                        setTimeout(() => reject(new Error('Timeout')), 5000);
                    });
                } else {
                    // Fallback: clear caches directly
                    const cacheNames = await caches.keys();
                    await Promise.all(
                        cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                }

                // Clear localStorage (except for user preferences)
                const keysToKeep = ['darkMode', 'primaryColor', 'fontSize', 'fontWeight', 'notificationsEnabled', 'notifications', 'ramadanStartDate'];
                const allKeys = Object.keys(localStorage);

                allKeys.forEach(key => {
                    if (!keysToKeep.includes(key)) {
                        localStorage.removeItem(key);
                    }
                });

                showModal({
                    type: 'success',
                    icon: '🗑️',
                    title: 'تم مسح الذاكرة',
                    message: 'تم مسح جميع البيانات المخزنة مؤقتاً بنجاح'
                });

                // Reload the page after a short delay to ensure clean state
                setTimeout(() => {
                    window.location.reload();
                }, 1500);

            } catch (error) {
                console.error('Error clearing cache:', error);
                showModal({
                    type: 'error',
                    icon: '❌',
                    title: 'خطأ',
                    message: 'حدث خطأ أثناء مسح الذاكرة'
                });
            }
        }

        async function checkForUpdates() {
            try {
                if (!('serviceWorker' in navigator)) {
                    showModal({
                        type: 'warning',
                        icon: '⚠️',
                        title: 'غير مدعوم',
                        message: 'متصفحك لا يدعم Service Worker'
                    });
                    return;
                }

                if (typeof window.triggerSwUpdateCheck !== 'function') {
                    showModal({
                        type: 'warning',
                        icon: '⚠️',
                        title: 'تعذر التحقق',
                        message: 'تعذر الوصول إلى خدمة التحقق من التحديثات'
                    });
                    return;
                }

                showModal({
                    type: 'info',
                    icon: '⏳',
                    title: 'جارٍ التحقق',
                    message: 'يتم الآن التحقق من وجود تحديثات...'
                });

                const result = await window.triggerSwUpdateCheck();

                if (!result || !result.success) {
                    showModal({
                        type: 'error',
                        icon: '❌',
                        title: 'فشل التحقق',
                        message: 'تعذر التحقق من التحديثات حالياً، حاول مرة أخرى'
                    });
                    return;
                }

                if (result.hasUpdate) {
                    showModal({
                        type: 'success',
                        icon: '⬆️',
                        title: 'تحديث متاح',
                        message: 'تم العثور على تحديث جديد. ستظهر لك نافذة التحديث الآن.'
                    });
                } else {
                    showModal({
                        type: 'info',
                        icon: '✅',
                        title: 'أنت على أحدث إصدار',
                        message: 'لا يوجد تحديث جديد حالياً.'
                    });
                }
            } catch (error) {
                console.error('Error checking updates:', error);
                showModal({
                    type: 'error',
                    icon: '❌',
                    title: 'خطأ',
                    message: 'حدث خطأ أثناء التحقق من التحديثات'
                });
            }
        }

        // Initialize
        loadSettings();
        scheduleNotifications();
