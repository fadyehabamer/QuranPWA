let deferredPrompt;
        let notifications = [];

        // The two toggles render as <button role="switch">, so the visual
        // `.active` class and `aria-checked` must always move together.
        function setSwitchState(element, isOn) {
            if (!element) return;
            element.classList.toggle('active', isOn);
            element.setAttribute('aria-checked', String(isOn));
        }

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
            }
            setSwitchState(document.getElementById('darkModeToggle'), darkMode);

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
            setSwitchState(document.getElementById('notificationsToggle'), notifEnabled);
            if (notifEnabled) {
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
            const isDark = toggle.getAttribute('aria-checked') !== 'true';
            setSwitchState(toggle, isDark);

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
            setActiveColorOption(color);

            applyColor(color);
            localStorage.setItem('primaryColor', color);
        }

        function applyColor(color) {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

            // Delegated to the shared helper in theme-preload.js, which also
            // derives --primary-rgb and --on-primary. Setting --primary-color
            // alone left every rgba(var(--primary-rgb)) tint on the default
            // green, and left a dark accent unreadable in dark mode because an
            // inline style outranks the [data-theme="dark"] rule.
            if (window.applyAccentColor) {
                window.applyAccentColor(color, isDark);
            } else {
                document.documentElement.style.setProperty('--primary-color', color);
                document.documentElement.style.setProperty('--primary-light', adjustColor(color, 30));
            }

            // --shadow / --shadow-heavy are complete box-shadow values, not
            // colours. Assigning a bare rgba() here produced an invalid
            // declaration wherever they were used, so they are left alone.

            setActiveColorOption(color);
        }

        // The swatches are toggle buttons, so the selected one is exposed via
        // aria-pressed as well as the `.active` class.
        function setActiveColorOption(color) {
            document.querySelectorAll('.color-option').forEach(opt => {
                const isSelected = opt.getAttribute('data-color') === color;
                opt.classList.toggle('active', isSelected);
                opt.setAttribute('aria-pressed', String(isSelected));
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
            const isEnabled = toggle.getAttribute('aria-checked') !== 'true';
            setSwitchState(toggle, isEnabled);

            if (isEnabled) {
                const granted = ('Notification' in window)
                    ? (await Notification.requestPermission()) === 'granted'
                    : false;

                if (granted) {
                    document.getElementById('notificationSettings').style.display = 'block';
                    localStorage.setItem('notificationsEnabled', 'true');
                    scheduleNotifications();
                } else {
                    setSwitchState(toggle, false);
                    showModal({
                        type: 'warning',
                        icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
                        title: 'تنبيه',
                        message: 'يجب السماح بالإشعارات من إعدادات الجهاز'
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
                icon: '<i class="bi bi-bell-fill"></i>',
                title: 'إضافة تنبيه',
                message: `
                    <div style="text-align: start;">
                        <label for="notifTime" style="display: block; margin-bottom: 10px;">اختر الوقت:</label>
                        <input type="time" id="notifTime" class="time-input" style="width: 100%;">

                        <div id="daysSelectorLabel" style="margin: 15px 0 10px;">اختر الأيام:</div>
                        <div class="days-selector" id="daysSelector" role="group" aria-labelledby="daysSelectorLabel">
                            ${daysAr.map((day, i) => `
                                <button type="button" class="day-btn" aria-pressed="false" onclick="toggleDay(${i})">${day}</button>
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
            const isSelected = btn.classList.toggle('active');
            btn.setAttribute('aria-pressed', String(isSelected));
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
                icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
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
            if (localStorage.getItem('notificationsEnabled') !== 'true') return;

            const items = (notifications || []).map((notif, index) => {
                const [hours, minutes] = (notif.time || '00:00').split(':');
                return {
                    id: index + 1,
                    title: 'القرآن الكريم',
                    body: 'حان وقت قراءة القرآن والأذكار',
                    hour: parseInt(hours, 10) || 0,
                    minute: parseInt(minutes, 10) || 0,
                    days: Array.isArray(notif.days) ? notif.days : []
                };
            });

            if (!('Notification' in window) || Notification.permission !== 'granted') return;

            // Web notifications can't schedule recurring alerts without a push
            // backend, so fire a one-shot reminder for any time still ahead today.
            items.forEach((item) => {
                const today = new Date();
                const target = new Date(today.getFullYear(), today.getMonth(), today.getDate(),
                    item.hour, item.minute);
                const delay = target.getTime() - Date.now();
                if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
                setTimeout(() => {
                    try {
                        if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.ready.then((reg) => {
                                reg.showNotification(item.title, {
                                    body: item.body,
                                    icon: '/assets/icons/icon-192.png',
                                    badge: '/assets/icons/icon-192.png'
                                });
                            });
                        } else {
                            new Notification(item.title, { body: item.body, icon: '/assets/icons/icon-192.png' });
                        }
                    } catch (_) {}
                }, delay);
            });
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
                installBtn.innerHTML = '<i class="bi bi-download" aria-hidden="true"></i>';
                installBtn.setAttribute('aria-label', 'تثبيت التطبيق');
            }
        });

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            const installBtn = document.getElementById('installBtn');
            if (installBtn) {
                installBtn.innerHTML = '<i class="bi bi-check-circle-fill" aria-hidden="true"></i>';
                installBtn.setAttribute('aria-label', 'التطبيق مثبت بالفعل');
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
                            icon: '<i class="bi bi-phone-fill"></i>',
                            title: 'تم التثبيت',
                            message: 'تم تثبيت التطبيق على جهازك بنجاح'
                        });
                    } else {
                        showModal({
                            type: 'info',
                            icon: '<i class="bi bi-info-circle-fill"></i>',
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
                        icon: '<i class="bi bi-check-circle-fill"></i>',
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
                            icon: '<i class="bi bi-phone-fill"></i>',
                            title: 'تثبيت على iPhone',
                            message: 'اضغط على زر "مشاركة" (Square with Arrow) ← ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen)'
                        });
                    } else if (isMobile && isChrome) {
                        showModal({
                            type: 'info',
                            icon: '<i class="bi bi-phone-fill"></i>',
                            title: 'تثبيت يدوي',
                            message: 'اضغط على ⋮ (القائمة) في أعلى اليمين ← ثم اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"'
                        });
                    } else if (isMobile) {
                        showModal({
                            type: 'warning',
                            icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
                            title: 'تنبيه التثبيت',
                            message: 'لأفضل تجربة، يرجى استخدام متصفح Safari على iPhone أو Chrome على Android لتثبيت التطبيق.'
                        });
                    } else {
                        showModal({
                            type: 'warning',
                            icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
                            title: 'تثبيت الكمبيوتر',
                            message: 'يرجى استخدام متصفح Chrome أو Edge والنقر على أيقونة التثبيت في شريط العنوان.'
                        });
                    }
                }
            }
        }

        // Destructive: wipes caches and non-preference localStorage, then
        // reloads. It used to run straight off the button press with no
        // confirmation step.
        function clearCache() {
            showModal({
                type: 'warning',
                icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
                title: 'مسح ذاكرة التخزين المؤقت',
                message: 'سيتم حذف البيانات المخزنة مؤقتاً وإعادة تحميل التطبيق. هل تريد المتابعة؟',
                confirmText: 'مسح',
                cancelText: 'إلغاء',
                onConfirm: performClearCache
            });
        }

        async function performClearCache() {
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
                    icon: '<i class="bi bi-trash-fill"></i>',
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
                    icon: '<i class="bi bi-x-circle-fill"></i>',
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
                        icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
                        title: 'غير مدعوم',
                        message: 'متصفحك لا يدعم Service Worker'
                    });
                    return;
                }

                if (typeof window.triggerSwUpdateCheck !== 'function') {
                    showModal({
                        type: 'warning',
                        icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
                        title: 'تعذر التحقق',
                        message: 'تعذر الوصول إلى خدمة التحقق من التحديثات'
                    });
                    return;
                }

                showModal({
                    type: 'info',
                    icon: '<i class="bi bi-hourglass-split"></i>',
                    title: 'جارٍ التحقق',
                    message: 'يتم الآن التحقق من وجود تحديثات...'
                });

                const result = await window.triggerSwUpdateCheck();

                if (!result || !result.success) {
                    showModal({
                        type: 'error',
                        icon: '<i class="bi bi-x-circle-fill"></i>',
                        title: 'فشل التحقق',
                        message: 'تعذر التحقق من التحديثات حالياً، حاول مرة أخرى'
                    });
                    return;
                }

                if (result.hasUpdate) {
                    showModal({
                        type: 'success',
                        icon: '<i class="bi bi-arrow-up-circle-fill"></i>',
                        title: 'تحديث متاح',
                        message: 'تم العثور على تحديث جديد. ستظهر لك نافذة التحديث الآن.'
                    });
                } else {
                    showModal({
                        type: 'info',
                        icon: '<i class="bi bi-check-circle-fill"></i>',
                        title: 'أنت على أحدث إصدار',
                        message: 'لا يوجد تحديث جديد حالياً.'
                    });
                }
            } catch (error) {
                console.error('Error checking updates:', error);
                showModal({
                    type: 'error',
                    icon: '<i class="bi bi-x-circle-fill"></i>',
                    title: 'خطأ',
                    message: 'حدث خطأ أثناء التحقق من التحديثات'
                });
            }
        }

        // Initialize
        loadSettings();
        scheduleNotifications();
