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

            // Font size. A missing key means the CSS default (16px = "متوسط");
            // this used to default to index 1 and then persist it, so merely
            // opening Settings shrank every page to 14px.
            const storedFontSize = parseInt(localStorage.getItem('fontSize'), 10);
            currentFontSizeIndex = Number.isInteger(storedFontSize) && fontSizeValues[storedFontSize]
                ? storedFontSize
                : 2;
            updateFontSize(false);

            // Font weight
            loadFontWeight();

            // Notifications
            const notifEnabled = localStorage.getItem('notificationsEnabled') === 'true';
            setSwitchState(document.getElementById('notificationsToggle'), notifEnabled);
            if (notifEnabled) {
                document.getElementById('notificationSettings').style.display = 'block';
            }

            try {
                const parsed = JSON.parse(localStorage.getItem('notifications') || '[]');
                notifications = Array.isArray(parsed)
                    ? parsed.filter(item => item && typeof item.time === 'string')
                        .map(item => ({ time: item.time, days: Array.isArray(item.days) ? item.days.map(Number) : [] }))
                    : [];
            } catch (_error) {
                notifications = [];
            }
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

        function updateFontSize(persist = true) {
            const baseSize = fontSizeValues[currentFontSizeIndex];
            document.documentElement.style.setProperty('--font-size-base', baseSize + 'px');
            document.documentElement.style.setProperty('--font-size-ayah', (baseSize + 8) + 'px');
            document.documentElement.style.setProperty('--font-size-header', (baseSize + 6) + 'px');
            document.getElementById('fontSizeDisplay').textContent = fontSizes[currentFontSizeIndex];
            if (persist) localStorage.setItem('fontSize', currentFontSizeIndex);
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
                    await updateNotifySetting({ enabled: true });
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
                await updateNotifySetting({ enabled: false });
            }
        }

        /* ==================================================================
           Prayer, iqama and khatma reminders
           ================================================================== */

        // Mirror of the stored settings, so the toggles can render without an
        // await on every repaint.
        let notifySettings = null;

        async function updateNotifySetting(patch) {
            if (!window.NotifyStore) return;

            notifySettings = Object.assign({}, notifySettings || window.NotifyStore.DEFAULT_SETTINGS, patch);
            await window.NotifyStore.setSettings(notifySettings);
            renderNotifySettings();

            // Rebuilding is what actually (re)installs the browser-side
            // triggers, so every change has to go through it.
            if (window.AppNotifications) {
                const result = await window.AppNotifications.refresh({ force: true });
                renderNotifyStatus(result);
            }
        }

        function togglePrayerAlerts() {
            const toggle = document.getElementById('prayerAlertsToggle');
            const on = toggle.getAttribute('aria-checked') !== 'true';
            const prayers = { Fajr: on, Dhuhr: on, Asr: on, Maghrib: on, Isha: on };
            updateNotifySetting({ prayers });
        }

        function togglePrayer(key) {
            const current = (notifySettings || window.NotifyStore.DEFAULT_SETTINGS).prayers;
            const prayers = Object.assign({}, current);
            prayers[key] = !prayers[key];
            updateNotifySetting({ prayers });
        }

        function setPrayerOffset(minutes) {
            updateNotifySetting({ offsetMinutes: minutes });
        }

        function toggleIqamaReminder() {
            const toggle = document.getElementById('iqamaToggle');
            updateNotifySetting({ iqamaReminder: toggle.getAttribute('aria-checked') !== 'true' });
        }

        function toggleKhatmaReminder() {
            const toggle = document.getElementById('khatmaAlertToggle');
            updateNotifySetting({ khatma: toggle.getAttribute('aria-checked') !== 'true' });
        }

        function renderNotifySettings() {
            const settings = notifySettings || (window.NotifyStore || {}).DEFAULT_SETTINGS;
            if (!settings) return;

            const labels = (window.AppNotifications || {}).PRAYER_LABELS || {};
            const anyPrayer = Object.keys(settings.prayers).some(key => settings.prayers[key]);

            setSwitchState(document.getElementById('prayerAlertsToggle'), anyPrayer);
            const options = document.getElementById('prayerAlertsOptions');
            if (options) options.style.display = anyPrayer ? 'block' : 'none';

            const group = document.getElementById('prayerPickGroup');
            if (group) {
                group.innerHTML = Object.keys(labels).map(key => {
                    const on = Boolean(settings.prayers[key]);
                    return `<button type="button" class="prayer-pick-chip${on ? ' is-active' : ''}"
                        data-prayer="${key}" aria-pressed="${on}" onclick="togglePrayer('${key}')">
                        ${labels[key]}
                    </button>`;
                }).join('');
            }

            document.querySelectorAll('#prayerOffsetGroup [data-offset]').forEach(button => {
                const isActive = Number(button.getAttribute('data-offset')) === settings.offsetMinutes;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });

            setSwitchState(document.getElementById('iqamaToggle'), Boolean(settings.iqamaReminder));
            setSwitchState(document.getElementById('khatmaAlertToggle'), Boolean(settings.khatma));
        }

        // Says plainly how reminders will be delivered. Without a push server
        // this genuinely differs by browser, and quietly promising delivery
        // that will not happen is worse than saying so.
        function renderNotifyStatus(result) {
            const element = document.getElementById('notifyStatus');
            if (!element || !window.AppNotifications) return;

            if (!readSavedLocationName()) {
                element.className = 'notify-status is-warn';
                element.textContent = 'حدّد موقعك من صفحة المواقيت أولاً حتى تُحسب أوقات التنبيه.';
                return;
            }

            const count = result && typeof result.count === 'number' ? result.count : null;
            const scheduled = count === null ? '' : ` (${count} تنبيهاً خلال ٤٨ ساعة)`;

            if (window.AppNotifications.supportsTriggers()) {
                element.className = 'notify-status is-ok';
                element.textContent = `التنبيهات مجدولة وستصل حتى لو كان التطبيق مغلقاً${scheduled}.`;
            } else {
                element.className = 'notify-status is-warn';
                element.textContent = `متصفحك لا يدعم جدولة التنبيهات في الخلفية، لذا قد تصل عند فتح التطبيق${scheduled}. ثبّت التطبيق على الشاشة الرئيسية لتحسين ذلك.`;
            }
        }

        async function testNotification() {
            if (!window.AppNotifications) return;

            const sent = await window.AppNotifications.sendTestNotification();
            if (!sent) {
                showModal({
                    type: 'warning',
                    icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
                    title: 'غير مسموح',
                    message: 'يجب السماح بالإشعارات من إعدادات الجهاز أولاً.'
                });
            }
        }

        /* ==================================================================
           Offline Quran downloads
           ================================================================== */

        let juzBusy = false;

        function formatOfflineUsage(info) {
            if (!info.surahs) return 'لم تُحمَّل أي أجزاء بعد';
            return `${formatBytes(info.bytes)} • ${info.surahs} سورة`;
        }

        async function renderOfflineUsage() {
            const desc = document.getElementById('offlineUsageDesc');
            if (!desc || !window.OfflineQuran) return;
            try {
                desc.textContent = formatOfflineUsage(await window.OfflineQuran.usage());
            } catch (_error) {
                desc.textContent = 'غير متاح';
            }
        }

        function toggleJuzGrid() {
            const grid = document.getElementById('juzGrid');
            const toggle = document.getElementById('juzToggle');
            if (!grid || !toggle) return;

            const willOpen = grid.hidden;
            grid.hidden = !willOpen;
            toggle.setAttribute('aria-expanded', String(willOpen));
            toggle.classList.toggle('is-open', willOpen);
        }

        async function renderJuzGrid() {
            const grid = document.getElementById('juzGrid');
            if (!grid || !window.OfflineQuran) return;

            let statuses;
            try {
                statuses = await window.OfflineQuran.allStatus();
            } catch (_error) {
                // No Cache API (plain http:// on a LAN, some private modes).
                grid.innerHTML = '<p class="offline-unavailable">التحميل للقراءة بلا إنترنت غير متاح في هذا المتصفح.</p>';
                return;
            }

            const meta = document.getElementById('juzToggleMeta');
            if (meta) {
                const complete = statuses.filter(status => status.complete).length;
                meta.textContent = complete ? `${complete} / 30` : '';
            }
            grid.innerHTML = statuses.map((status, index) => {
                const juz = index + 1;
                const percent = status.total ? Math.round((status.done / status.total) * 100) : 0;
                const partial = !status.complete && status.done > 0;
                const classes = ['juz-chip'];
                if (status.complete) classes.push('is-done');
                if (partial) classes.push('is-partial');
                return `
                    <button type="button" class="${classes.join(' ')}" id="juzChip${juz}"
                        aria-pressed="${status.complete}" onclick="toggleJuzDownload(${juz})">
                        <span class="juz-chip-num">${juz}</span>
                        <span class="juz-chip-state" id="juzState${juz}">${
                            status.complete ? '<i class="bi bi-check-lg" aria-hidden="true"></i>'
                                : partial ? `${percent}%`
                                    : '<i class="bi bi-download" aria-hidden="true"></i>'
                        }</span>
                    </button>
                `;
            }).join('');
        }

        async function toggleJuzDownload(juzNumber) {
            if (juzBusy || !window.OfflineQuran) return;

            const status = await window.OfflineQuran.juzStatus(juzNumber);

            if (status.complete) {
                await window.OfflineQuran.removeJuz(juzNumber);
                await renderJuzGrid();
                await renderOfflineUsage();
                return;
            }

            juzBusy = true;
            const state = document.getElementById(`juzState${juzNumber}`);
            const chip = document.getElementById(`juzChip${juzNumber}`);
            if (chip) chip.classList.add('is-loading');

            let result;
            try {
                result = await window.OfflineQuran.downloadJuz(juzNumber, (done, total) => {
                    if (state) state.textContent = `${Math.round((done / total) * 100)}%`;
                });
            } catch (_error) {
                result = { ok: false };
            } finally {
                juzBusy = false;
            }
            await renderJuzGrid().catch(() => { });
            await renderOfflineUsage();

            if (!result.ok) {
                showModal({
                    type: 'error',
                    icon: '<i class="bi bi-wifi-off"></i>',
                    title: 'تعذّر التحميل',
                    message: 'انقطع الاتصال أثناء التحميل. ما تم تحميله محفوظ، ويمكنك المتابعة لاحقاً.'
                });
            }
        }

        async function downloadAllJuz() {
            if (juzBusy || !window.OfflineQuran) return;

            juzBusy = true;
            const button = document.getElementById('downloadAllBtn');
            const original = button ? button.innerHTML : '';

            let result;
            try {
                result = await window.OfflineQuran.downloadAll((juz) => {
                    if (button) button.textContent = `جاري التحميل… الجزء ${juz} من ٣٠`;
                });
            } catch (_error) {
                result = { ok: false, stoppedAt: '?' };
            } finally {
                juzBusy = false;
            }
            if (button) button.innerHTML = original;
            await renderJuzGrid();
            await renderOfflineUsage();

            showModal(result.ok ? {
                type: 'success',
                icon: '<i class="bi bi-check-circle-fill"></i>',
                title: 'اكتمل التحميل',
                message: 'المصحف كاملاً متاح الآن بلا إنترنت.'
            } : {
                type: 'error',
                icon: '<i class="bi bi-wifi-off"></i>',
                title: 'توقّف التحميل',
                message: `انقطع الاتصال عند الجزء ${result.stoppedAt}. ما تم تحميله محفوظ.`
            });
        }

        function removeAllOffline() {
            showModal({
                type: 'warning',
                icon: '<i class="bi bi-trash-fill"></i>',
                title: 'حذف الأجزاء المحمّلة',
                message: 'سيتم حذف كل ما حمّلته للقراءة بلا إنترنت. هل تريد المتابعة؟',
                confirmText: 'حذف',
                cancelText: 'إلغاء',
                onConfirm: async () => {
                    await window.OfflineQuran.removeAll();
                    await renderJuzGrid();
                    await renderOfflineUsage();
                }
            });
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
                        return;
                    }
                    showModal({
                        type: 'warning',
                        icon: '<i class="bi bi-exclamation-triangle-fill"></i>',
                        title: 'لم يُضف التذكير',
                        message: !time ? 'اختر وقتاً للتذكير أولاً.' : 'اختر يوماً واحداً على الأقل.',
                        confirmText: 'حسناً',
                        onConfirm: showAddNotification
                    });
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
                    scheduleNotifications();
                }
            });
        }

        // Custom reminders are delivered by the shared scheduler
        // (js/notifications.js) together with the prayer reminders, so they
        // fire on the chosen days whether or not this page is still open.
        function scheduleNotifications() {
            if (window.AppNotifications) {
                window.AppNotifications.refresh({ force: true }).catch(() => { });
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
                } else if (window.caches) {
                    // Fallback: clear caches directly, but keep the surahs the
                    // user deliberately downloaded (the worker path does too).
                    const offlineCache = window.OfflineQuran ? window.OfflineQuran.CACHE_NAME : null;
                    const cacheNames = await caches.keys();
                    await Promise.all(
                        cacheNames
                            .filter(cacheName => cacheName !== offlineCache)
                            .map(cacheName => caches.delete(cacheName))
                    );
                }

                // Only cached copies of re-fetchable content. This used to be an
                // allow-list of seven preference keys, which deleted bookmarks,
                // the khatma plan, habit logs, azkar counts and the reader
                // position — the opposite of what the button promises.
                Object.keys(localStorage).forEach(key => {
                    if (BACKUP_EXCLUDED_PREFIXES.some(prefix => key.startsWith(prefix))) {
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

        /* ==================================================================
           Theme mode — light / dark / auto
           ================================================================== */

        const THEME_MODE_KEY = 'themeMode';

        function getThemeMode() {
            const stored = localStorage.getItem(THEME_MODE_KEY);
            if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
            // Upgrading from the old boolean: derive the equivalent mode.
            return localStorage.getItem('darkMode') === 'true' ? 'dark' : 'light';
        }

        function setThemeMode(mode) {
            localStorage.setItem(THEME_MODE_KEY, mode);
            // syncAppTheme resolves 'auto' against the OS, writes the legacy
            // darkMode key and re-derives the accent for the resulting theme.
            if (window.syncAppTheme) window.syncAppTheme();
            applyColor(localStorage.getItem('primaryColor') || '#1B5E20');
            renderThemeMode();
        }

        function renderThemeMode() {
            const mode = getThemeMode();
            document.querySelectorAll('[data-theme-mode]').forEach(button => {
                const isActive = button.getAttribute('data-theme-mode') === mode;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        }

        /* ==================================================================
           Reader default view + haptics
           ================================================================== */

        const READER_DISPLAY_MODE_KEY = 'quranReaderDisplayModeV1';
        const HAPTICS_KEY = 'hapticsEnabled';

        function setReaderDefaultMode(mode) {
            localStorage.setItem(READER_DISPLAY_MODE_KEY, mode);
            renderReaderDefaultMode();
        }

        function renderReaderDefaultMode() {
            const mode = localStorage.getItem(READER_DISPLAY_MODE_KEY) === 'mushaf' ? 'mushaf' : 'text';
            document.querySelectorAll('[data-reader-mode]').forEach(button => {
                const isActive = button.getAttribute('data-reader-mode') === mode;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        }

        /* ==================================================================
           Quran reading font
           ================================================================== */

        const QURAN_FONT_KEY = 'quranFontFamily';

        function renderQuranFontPicker() {
            const picker = document.getElementById('quranFontPicker');
            const fonts = window.QURAN_FONTS;
            if (!picker || !fonts) return;

            const current = localStorage.getItem(QURAN_FONT_KEY) || 'amiri';
            picker.innerHTML = Object.entries(fonts).map(([key, font]) => {
                const isActive = key === current;
                return `
                    <button type="button" class="quran-font-option${isActive ? ' is-active' : ''}"
                        data-quran-font="${key}" aria-pressed="${isActive}"
                        style="font-family: ${font.stack}"
                        onclick="setQuranFont('${key}')">
                        <span class="quran-font-sample">بِسْمِ ٱللَّهِ</span>
                        <span class="quran-font-name">${font.label}</span>
                    </button>
                `;
            }).join('');

            applyPreviewFont(fonts[current] ? fonts[current].stack : fonts.amiri.stack);
        }

        // The preview above doubles as the font preview, so it must not keep
        // inheriting the UI font once a reading face is chosen.
        function applyPreviewFont(stack) {
            const preview = document.getElementById('previewText');
            if (preview) preview.style.fontFamily = stack;
        }

        function setQuranFont(key) {
            localStorage.setItem(QURAN_FONT_KEY, key);
            if (window.syncQuranFont) window.syncQuranFont();
            renderQuranFontPicker();
        }

        function toggleHaptics() {
            const toggle = document.getElementById('hapticsToggle');
            const enabled = toggle.getAttribute('aria-checked') !== 'true';
            setSwitchState(toggle, enabled);
            localStorage.setItem(HAPTICS_KEY, String(enabled));
            // Confirm the change the way the setting itself works.
            if (enabled && navigator.vibrate) navigator.vibrate(15);
        }

        /* ==================================================================
           Prayer calculation preferences
           ================================================================== */

        const PRAYER_METHOD_KEY = 'prayerMethod';
        const PRAYER_SCHOOL_KEY = 'prayerSchool';

        function changePrayerMethod() {
            const select = document.getElementById('prayerMethodSelect');
            if (!select) return;
            localStorage.setItem(PRAYER_METHOD_KEY, select.value);
            invalidatePrayerCaches();
        }

        function setAsrSchool(school) {
            localStorage.setItem(PRAYER_SCHOOL_KEY, String(school));
            renderAsrSchool();
            invalidatePrayerCaches();
        }

        function renderAsrSchool() {
            const school = localStorage.getItem(PRAYER_SCHOOL_KEY) === '1' ? '1' : '0';
            document.querySelectorAll('[data-asr]').forEach(button => {
                const isActive = button.getAttribute('data-asr') === school;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        }

        // Timings are memoised per day; a method change must drop them or the
        // old angles keep showing until midnight.
        function invalidatePrayerCaches() {
            Object.keys(localStorage)
                .filter(key => key.startsWith('prayerTimesCache'))
                .forEach(key => localStorage.removeItem(key));
        }

        // The location is spread over three keys: `userLocation` holds only
        // lat/lng, the human-readable name lives in `locationText`, and a manual
        // country pick is stored whole under `selectedCountryV2`. Reading only
        // `userLocation.name` — which never exists — always showed "no location".
        function readSavedLocationName() {
            try {
                const country = JSON.parse(
                    localStorage.getItem('preferredManualCountryV1') || localStorage.getItem('selectedCountry') || 'null'
                );
                if (country && country.name) return country.name;
            } catch (_error) { /* fall through */ }

            const label = localStorage.getItem('locationText');
            if (label) return label;

            try {
                const coords = JSON.parse(localStorage.getItem('userLocation') || 'null');
                if (coords && typeof coords.latitude === 'number') {
                    return `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`;
                }
            } catch (_error) { /* fall through */ }

            return null;
        }

        function renderSavedLocation() {
            const desc = document.getElementById('savedLocationDesc');
            if (!desc) return;
            desc.textContent = readSavedLocationName() || 'لم يتم تحديد موقع بعد';
        }

        function clearSavedLocation() {
            showModal({
                type: 'warning',
                icon: '<i class="bi bi-geo-alt-fill"></i>',
                title: 'حذف الموقع المحفوظ',
                message: 'سيُطلب تحديد الموقع من جديد عند فتح صفحة المواقيت. هل تريد المتابعة؟',
                confirmText: 'حذف',
                cancelText: 'إلغاء',
                onConfirm: () => {
                    // Clear every key the location is spread across, or the page
                    // would re-resolve the old city from whichever one survived.
                    ['userLocation', 'locationText', 'preferredManualCountryV1', 'selectedCountry']
                        .forEach(key => localStorage.removeItem(key));
                    invalidatePrayerCaches();
                    renderSavedLocation();
                }
            });
        }

        /* ==================================================================
           Backup, restore and storage usage
           ================================================================== */

        // Everything worth carrying to another device: progress, bookmarks,
        // memorisation, habits and preferences. Caches are deliberately left
        // out — they are re-fetchable and would bloat the file.
        const BACKUP_EXCLUDED_PREFIXES = ['prayerTimesCache', 'quranSurahCache', 'tafsirCache'];
        const BACKUP_VERSION = 1;

        function collectBackupData() {
            const data = {};
            Object.keys(localStorage).forEach(key => {
                if (BACKUP_EXCLUDED_PREFIXES.some(prefix => key.startsWith(prefix))) return;
                data[key] = localStorage.getItem(key);
            });
            return data;
        }

        function exportBackup() {
            const payload = {
                app: 'quran-pwa',
                version: BACKUP_VERSION,
                exportedAt: new Date().toISOString(),
                data: collectBackupData()
            };

            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const stamp = new Date().toISOString().slice(0, 10);
            const link = document.createElement('a');
            link.href = url;
            link.download = `نسخة-احتياطية-${stamp}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            showModal({
                type: 'success',
                icon: '<i class="bi bi-box-arrow-down"></i>',
                title: 'تم التصدير',
                message: `تم حفظ ${Object.keys(payload.data).length} عنصراً في ملف النسخة الاحتياطية.`
            });
        }

        function importBackup(input) {
            const file = input.files && input.files[0];
            // Reset first so re-picking the same file still fires `change`.
            input.value = '';
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                let payload;
                try {
                    payload = JSON.parse(String(reader.result));
                } catch (_error) {
                    payload = null;
                }

                if (!payload || payload.app !== 'quran-pwa' || !payload.data || typeof payload.data !== 'object') {
                    showModal({
                        type: 'error',
                        icon: '<i class="bi bi-x-circle-fill"></i>',
                        title: 'ملف غير صالح',
                        message: 'هذا الملف ليس نسخة احتياطية من هذا التطبيق.'
                    });
                    return;
                }

                const count = Object.keys(payload.data).length;
                showModal({
                    type: 'warning',
                    icon: '<i class="bi bi-box-arrow-up"></i>',
                    title: 'استعادة النسخة',
                    message: `سيتم استبدال بياناتك الحالية بـ ${count} عنصراً من النسخة. هل تريد المتابعة؟`,
                    confirmText: 'استعادة',
                    cancelText: 'إلغاء',
                    onConfirm: () => {
                        Object.entries(payload.data).forEach(([key, value]) => {
                            if (typeof value === 'string') localStorage.setItem(key, value);
                        });
                        window.location.reload();
                    }
                });
            };
            reader.readAsText(file);
        }

        function formatBytes(bytes) {
            if (!bytes) return '0 ك.ب';
            const gb = bytes / (1024 * 1024 * 1024);
            if (gb >= 1) return `${gb.toFixed(1)} ج.ب`;
            const mb = bytes / (1024 * 1024);
            if (mb >= 1) return `${mb.toFixed(1)} م.ب`;
            return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
        }

        async function renderStorageUsage() {
            const usedLabel = document.getElementById('storageUsedLabel');
            const percentLabel = document.getElementById('storagePercentLabel');
            const fill = document.getElementById('storageMeterFill');
            if (!usedLabel) return;

            if (!navigator.storage || !navigator.storage.estimate) {
                usedLabel.textContent = 'حجم التخزين غير متاح على هذا المتصفح';
                if (fill) fill.style.width = '0%';
                return;
            }

            try {
                const { usage = 0, quota = 0 } = await navigator.storage.estimate();
                const percent = quota ? Math.min(100, (usage / quota) * 100) : 0;
                usedLabel.textContent = `${formatBytes(usage)} مستخدمة من ${formatBytes(quota)}`;
                if (percentLabel) percentLabel.textContent = `${percent < 1 ? '<1' : Math.round(percent)}%`;
                // Keep a hairline visible so the meter never looks broken.
                if (fill) fill.style.width = `${Math.max(2, percent)}%`;
            } catch (_error) {
                usedLabel.textContent = 'تعذر حساب حجم التخزين';
            }
        }

        // Clear the per-page "seen" flags so every page introduces itself again,
        // then replay this page's tour immediately as confirmation.
        function replayTours() {
            if (!window.AppTour) return;
            window.AppTour.resetAll();
            // Also replay the first-run wizard, so "show me the intro again"
            // means the whole introduction and not just the coach marks.
            if (window.AppOnboarding) window.AppOnboarding.reset();
            showModal({
                type: 'success',
                icon: '<i class="bi bi-signpost-2-fill"></i>',
                title: 'تم التفعيل',
                message: 'ستظهر الجولة التعريفية من جديد في كل صفحة، وشاشة الترحيب عند فتح الرئيسية.'
            });
            setTimeout(() => window.AppTour.replay('settings'), 900);
        }

        function loadExtendedSettings() {
            renderThemeMode();
            renderQuranFontPicker();
            renderReaderDefaultMode();
            renderAsrSchool();
            renderSavedLocation();
            renderStorageUsage();

            const method = localStorage.getItem(PRAYER_METHOD_KEY) || '4';
            const methodSelect = document.getElementById('prayerMethodSelect');
            if (methodSelect) methodSelect.value = method;

            // Haptics default to on — the masbaha has always vibrated.
            const haptics = localStorage.getItem(HAPTICS_KEY) !== 'false';
            setSwitchState(document.getElementById('hapticsToggle'), haptics);

            loadNotifySettings();
            renderJuzGrid();
            renderOfflineUsage();
        }

        async function loadNotifySettings() {
            if (!window.NotifyStore) return;
            notifySettings = await window.NotifyStore.getSettings();
            renderNotifySettings();
            renderNotifyStatus(null);
        }

        // Initialize
        loadSettings();
        loadExtendedSettings();
        scheduleNotifications();
