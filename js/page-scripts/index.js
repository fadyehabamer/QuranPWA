function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 27, g: 94, b: 32 };
        }

        // Load theme settings
        (function () {
            const darkMode = localStorage.getItem('darkMode') === 'true';
            if (darkMode) document.documentElement.setAttribute('data-theme', 'dark');

            const color = localStorage.getItem('primaryColor');
            const rgb = hexToRgb(color || '#1B5E20');
            document.documentElement.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

            if (color) {
                const num = parseInt(color.replace('#', ''), 16);
                const amt = Math.round(2.55 * 30);
                const R = (num >> 16) + amt;
                const G = (num >> 8 & 0x00FF) + amt;
                const B = (num & 0x0000FF) + amt;
                const lightColor = '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);

                document.documentElement.style.setProperty('--primary-color', color);
                document.documentElement.style.setProperty('--primary-light', lightColor);

                const shadowLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.25 : 0.15})`;
                const shadowHeavy = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.45 : 0.35})`;
                document.documentElement.style.setProperty('--shadow', shadowLight);
                document.documentElement.style.setProperty('--shadow-heavy', shadowHeavy);
            }

            const fontSize = localStorage.getItem('fontSize');
            if (fontSize !== null) {
                const fontSizes = [12, 14, 16, 18, 20, 24, 28];
                const baseSize = fontSizes[parseInt(fontSize)] || 16;
                document.documentElement.style.setProperty('--font-size-base', baseSize + 'px');
                document.documentElement.style.setProperty('--font-size-ayah', (baseSize + 8) + 'px');
                document.documentElement.style.setProperty('--font-size-header', (baseSize + 6) + 'px');
            }
        })();

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
        // Daily Verse Logic
        function pushAyahToWidget(verseData) {
            if (!verseData || !window.NativeBridge || typeof window.NativeBridge.setAyahOfDay !== 'function') return;
            window.NativeBridge.setAyahOfDay({
                text: verseData.text,
                surah: verseData.surah,
                ayah: verseData.numberInSurah || 0
            });
        }

        async function loadDailyVerse() {
            const section = document.getElementById('dailyVerseSection');
            const textElement = document.getElementById('dailyVerseText');
            const infoElement = document.getElementById('dailyVerseInfo');

            // Check if we have a cached verse for today
            const today = new Date().toDateString();
            const cachedVerse = localStorage.getItem('dailyVerse');

            if (cachedVerse) {
                const data = JSON.parse(cachedVerse);
                if (data.date === today) {
                    textElement.textContent = data.text;
                    infoElement.textContent = `${data.surah} - آية ${data.numberInSurah}`;
                    section.style.display = 'block';
                    pushAyahToWidget(data);
                    return;
                }
            }

            // Fetch new verse
            try {
                const randomVerse = Math.floor(Math.random() * 6236) + 1;
                const response = await fetch(`https://api.alquran.cloud/v1/ayah/${randomVerse}/ar.alafasy`);
                const data = await response.json();

                if (data.code === 200) {
                    const verse = data.data;
                    const verseData = {
                        date: today,
                        text: verse.text,
                        surah: verse.surah.name,
                        numberInSurah: verse.numberInSurah
                    };

                    localStorage.setItem('dailyVerse', JSON.stringify(verseData));
                    textElement.textContent = verseData.text;
                    infoElement.textContent = `${verseData.surah} - آية ${verseData.numberInSurah}`;
                    section.style.display = 'block';
                    pushAyahToWidget(verseData);
                }
            } catch (error) {
                console.error('Error fetching daily verse:', error);
                section.style.display = 'none';
            }
        }

        // Resume Reading Logic
        const HOME_SURAH_NAMES = [
            'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال',
            'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'ابراهيم', 'الحجر', 'النحل', 'الإسراء',
            'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء',
            'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبإ', 'فاطر',
            'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية',
            'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر',
            'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة',
            'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج',
            'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الانسان', 'المرسلات', 'النبإ',
            'النازعات', 'عبس', 'التكوير', 'الإنفطار', 'المطففين', 'الإنشقاق', 'البروج', 'الطارق',
            'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين',
            'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر',
            'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد',
            'الإخلاص', 'الفلق', 'الناس'
        ];

        function getHomeBookmarks() {
            if (window.loadBookmarkLibrary) {
                return window.loadBookmarkLibrary();
            }

            try {
                const raw = JSON.parse(localStorage.getItem('quranBookmarks') || '[]');
                return Array.isArray(raw) ? raw : [];
            } catch (_error) {
                return [];
            }
        }

        function getSurahNameByNumber(surahNumber) {
            return HOME_SURAH_NAMES[(parseInt(surahNumber, 10) || 1) - 1] || 'سورة';
        }

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
                // If azkar data is unavailable, gracefully fall back to a rough indicator.
                const roughTotal = Object.values(counts).reduce((sum, value) => sum + (parseInt(value, 10) || 0), 0);
                return Math.min(100, Math.round((roughTotal / 300) * 100));
            }

            if (totalTarget <= 0) return 0;
            return Math.round((totalCurrent / totalTarget) * 100);
        }

        function syncPrayerDashboardCard() {
            const prayerValue = document.getElementById('dashboardPrayerValue');
            const prayerMeta = document.getElementById('dashboardPrayerMeta');
            const nextPrayerText = (document.getElementById('pwNextPrayer')?.textContent || '').trim();
            const locationText = (document.getElementById('pwLocation')?.textContent || '').trim();

            if (!prayerValue || !prayerMeta) return;

            if (nextPrayerText && nextPrayerText !== '--:--') {
                prayerValue.textContent = nextPrayerText.replace('الصلاة القادمة:', '').trim();
                prayerMeta.textContent = locationText || 'حسب موقعك';
            } else {
                prayerValue.textContent = 'جاري تحديد الصلاة القادمة...';
                prayerMeta.textContent = 'يرجى السماح بالموقع';
            }
        }

        function initPrayerDashboardSync() {
            const nextPrayerEl = document.getElementById('pwNextPrayer');
            const locationEl = document.getElementById('pwLocation');
            if (!nextPrayerEl && !locationEl) return;

            const observer = new MutationObserver(() => {
                syncPrayerDashboardCard();
            });

            if (nextPrayerEl) {
                observer.observe(nextPrayerEl, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            }

            if (locationEl) {
                observer.observe(locationEl, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            }
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

        function renderSmartDashboard() {
            const bookmarks = getHomeBookmarks().slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const section = document.getElementById('resumeReadingSection');
            const details = document.getElementById('resumeDetails');
            const continueCard = document.getElementById('dashboardContinueCard');
            const continueValue = document.getElementById('dashboardContinueValue');
            const lastBookmarkValue = document.getElementById('dashboardLastBookmarkValue');
            const lastBookmarkMeta = document.getElementById('dashboardLastBookmarkMeta');
            const bookmarksCount = document.getElementById('dashboardBookmarksCount');
            const bookmarksMeta = document.getElementById('dashboardBookmarksMeta');

            const bookmarkFolders = window.getBookmarkFolders ? window.getBookmarkFolders() : [];
            const recentBookmarks = window.getRecentBookmarks ? window.getRecentBookmarks(5) : [];

            if (bookmarksCount) {
                bookmarksCount.textContent = `${bookmarks.length} موضع محفوظ`;
            }
            if (bookmarksMeta) {
                bookmarksMeta.textContent = `${bookmarkFolders.length} مجلد • ${recentBookmarks.length} زيارة حديثة`;
            }

            if (bookmarks.length === 0) {
                if (section) section.style.display = 'none';
                if (continueCard) continueCard.style.display = 'none';
                if (lastBookmarkValue) lastBookmarkValue.textContent = 'لا يوجد موضع محفوظ';
                if (lastBookmarkMeta) lastBookmarkMeta.textContent = 'ابدأ القراءة ثم احفظ الموضع';
                window.lastBookmark = null;
                return;
            }

            const lastBookmark = bookmarks[0];
            const surahName = getSurahNameByNumber(lastBookmark.surah);
            const pageLabel = `صفحة ${(lastBookmark.page || 0) + 1}`;
            const locationLabel = `${surahName} - ${pageLabel}`;

            if (details) details.textContent = locationLabel;
            if (section) section.style.display = 'block';
            if (continueCard) continueCard.style.display = 'flex';
            if (continueValue) continueValue.textContent = locationLabel;

            if (lastBookmarkValue) {
                lastBookmarkValue.textContent = surahName;
            }
            if (lastBookmarkMeta) {
                const tags = Array.isArray(lastBookmark.tags) && lastBookmark.tags.length > 0
                    ? ` • ${lastBookmark.tags.slice(0, 2).join('، ')}`
                    : '';
                const folder = lastBookmark.folder || 'عام';
                lastBookmarkMeta.textContent = `${pageLabel} • مجلد ${folder}${tags}`;
            }

            window.lastBookmark = lastBookmark;
            syncPrayerDashboardCard();
        }

        function checkResumeReading() {
            renderSmartDashboard();
        }

        function resumeReading() {
            if (window.lastBookmark) {
                const bookmarkQuery = window.lastBookmark.id
                    ? `&bookmark=${encodeURIComponent(window.lastBookmark.id)}`
                    : '';
                window.location.href = `quran.html?surah=${window.lastBookmark.surah}&page=${window.lastBookmark.page}${bookmarkQuery}`;
            }
        }

        // Khatma Planner Logic
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
            const [y, m, d] = str.split('-').map(Number);
            return new Date(y, m - 1, d);
        }

        function diffDaysInclusive(startDate, endDate) {
            const msPerDay = 86400000;
            const start = new Date(startDate);
            const end = new Date(endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            return Math.floor((end - start) / msPerDay) + 1;
        }

        function loadKhatmaPlan() {
            try {
                return JSON.parse(localStorage.getItem(KHATMA_PLAN_KEY) || 'null');
            } catch (error) {
                return null;
            }
        }

        function saveKhatmaPlan(plan) {
            localStorage.setItem(KHATMA_PLAN_KEY, JSON.stringify(plan));
        }

        function createKhatmaPlan() {
            const startDate = document.getElementById('khatmaStartDate').value;
            const endDate = document.getElementById('khatmaEndDate').value;

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
                updatedAt: Date.now(),
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
            const expectedByToday = started ? Math.ceil((plan.totalPages * elapsedDays) / totalDays) : 0;
            const backlogPages = Math.max(0, expectedByToday - completedPages);

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
            };
        }

        function addKhatmaProgress(overridePages) {
            const plan = loadKhatmaPlan();
            if (!plan) return;

            const input = document.getElementById('khatmaPagesReadInput');
            const pages = overridePages || parseInt(input.value, 10);
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
            if (status.todayTargetPages <= 0) {
                return;
            }

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

            if (!setupView || !summaryView || !startInput || !endInput) {
                return;
            }

            const today = new Date();
            const defaultStart = toDateInputValue(today);
            const defaultEnd = toDateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()));

            if (startInput && !startInput.value) startInput.value = defaultStart;
            if (endInput && !endInput.value) endInput.value = defaultEnd;

            const plan = loadKhatmaPlan();
            if (!plan) {
                setupView.style.display = 'block';
                summaryView.style.display = 'none';
                return;
            }

            const status = getKhatmaStatus(plan);

            setupView.style.display = 'none';
            summaryView.style.display = 'block';

            document.getElementById('khatmaCompletedPages').textContent = status.completedPages;
            document.getElementById('khatmaRemainingPages').textContent = status.remainingPages;
            document.getElementById('khatmaRemainingDays').textContent = status.remainingDays;
            document.getElementById('khatmaTodayPages').textContent = status.todayTargetPages;
            document.getElementById('khatmaProgressBar').style.width = `${status.progressPercent}%`;

            const textEl = document.getElementById('khatmaTodayTargetText');
            if (status.completedPages >= plan.totalPages) {
                textEl.textContent = 'تمت الختمة بنجاح! بارك الله فيك.';
            } else if (!status.started) {
                textEl.textContent = `لم تبدأ الخطة بعد. الهدف اليومي سيكون ${status.todayTargetPages} صفحات.`;
            } else if (status.finishedWindow && status.remainingPages > 0) {
                textEl.textContent = `انتهت المدة. للتعويض الآن تحتاج ${status.todayTargetPages} صفحات.`;
            } else {
                const backlogText = status.backlogPages > 0 ? ` • تعويض متراكم: ${status.backlogPages}` : '';
                textEl.textContent = `هدف اليوم: من صفحة ${status.todayStartPage} إلى ${status.todayEndPage} (${status.todayTargetPages} صفحات)${backlogText}`;
            }
        }

        const MOOD_SUPPORT_PROFILES = [
            {
                id: 'sadness',
                label: 'حزن',
                title: 'للتخفيف من الحزن',
                keywords: [
                    { term: 'حزين', weight: 1.6 },
                    { term: 'حزن', weight: 1.5 },
                    { term: 'مكتئب', weight: 1.8 },
                    { term: 'كئيب', weight: 1.7 },
                    { term: 'مكسور', weight: 1.4 },
                    { term: 'sad', weight: 1.3 },
                    { term: 'depressed', weight: 1.8 }
                ],
                context: 'الحزن مفهوم، والقرآن يذكّر أن الضيق مؤقت، وأن رحمته سبحانه أوسع من كل ما يثقل القلب.',
                verses: [
                    { surah: 94, ayah: 5, ref: 'الشرح 5-6', text: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا' },
                    { surah: 2, ayah: 286, ref: 'البقرة 286', text: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا' },
                    { surah: 12, ayah: 87, ref: 'يوسف 87', text: 'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ' },
                    { surah: 93, ayah: 3, ref: 'الضحى 3', text: 'مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ' }
                ]
            },
            {
                id: 'anxiety',
                label: 'قلق',
                title: 'للسكينة وقت القلق',
                keywords: [
                    { term: 'قلق', weight: 1.8 },
                    { term: 'متوتر', weight: 1.6 },
                    { term: 'توتر', weight: 1.5 },
                    { term: 'خايف', weight: 1.3 },
                    { term: 'خوف', weight: 1.4 },
                    { term: 'anxiety', weight: 1.8 },
                    { term: 'panic', weight: 1.8 },
                    { term: 'worried', weight: 1.3 }
                ],
                context: 'القلق يهدأ حين يتذكر القلب أن تدبير الله أرحم من كل الاحتمالات التي تُتعب الفكر.',
                verses: [
                    { surah: 13, ayah: 28, ref: 'الرعد 28', text: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ' },
                    { surah: 65, ayah: 3, ref: 'الطلاق 3', text: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ' },
                    { surah: 3, ayah: 173, ref: 'آل عمران 173', text: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ' },
                    { surah: 2, ayah: 153, ref: 'البقرة 153', text: 'اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ' }
                ]
            },
            {
                id: 'stress',
                label: 'ضغط',
                title: 'لتخفيف الضغط والتوتر',
                keywords: [
                    { term: 'ضغط', weight: 1.8 },
                    { term: 'مضغوط', weight: 1.9 },
                    { term: 'مأزوم', weight: 1.4 },
                    { term: 'مرهق', weight: 1.3 },
                    { term: 'stress', weight: 1.8 },
                    { term: 'stressed', weight: 1.8 }
                ],
                context: 'عند تزاحم المسؤوليات، ذكّر نفسك أن الله لا يكلّفك فوق طاقتك، وأن الفرج قريب بإذنه.',
                verses: [
                    { surah: 94, ayah: 5, ref: 'الشرح 5-6', text: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا' },
                    { surah: 2, ayah: 286, ref: 'البقرة 286', text: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا' },
                    { surah: 65, ayah: 2, ref: 'الطلاق 2-3', text: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا' },
                    { surah: 20, ayah: 25, ref: 'طه 25-26', text: 'رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي' }
                ]
            },
            {
                id: 'anger',
                label: 'غضب',
                title: 'لتهدئة الغضب',
                keywords: [
                    { term: 'غضبان', weight: 1.8 },
                    { term: 'غضب', weight: 1.7 },
                    { term: 'معصب', weight: 1.7 },
                    { term: 'منفعل', weight: 1.5 },
                    { term: 'angry', weight: 1.7 },
                    { term: 'mad', weight: 1.6 }
                ],
                context: 'قوة المؤمن تظهر في ضبط النفس عند الغضب، لا في اندفاعها. التنفس والذكر يفتحان باب السكينة.',
                verses: [
                    { surah: 3, ayah: 134, ref: 'آل عمران 134', text: 'وَالْكَاظِمِينَ الْغَيْظَ وَالْعَافِينَ عَنِ النَّاسِ ۗ وَاللَّهُ يُحِبُّ الْمُحْسِنِينَ' },
                    { surah: 42, ayah: 43, ref: 'الشورى 43', text: 'وَلَمَن صَبَرَ وَغَفَرَ إِنَّ ذَٰلِكَ لَمِنْ عَزْمِ الْأُمُورِ' },
                    { surah: 24, ayah: 22, ref: 'النور 22', text: 'وَلْيَعْفُوا وَلْيَصْفَحُوا ۗ أَلَا تُحِبُّونَ أَن يَغْفِرَ اللَّهُ لَكُمْ' },
                    { surah: 41, ayah: 34, ref: 'فصلت 34', text: 'ادْفَعْ بِالَّتِي هِيَ أَحْسَنُ' }
                ]
            },
            {
                id: 'guilt',
                label: 'ذنب',
                title: 'لعلاج الذنب والندم',
                keywords: [
                    { term: 'ذنب', weight: 1.8 },
                    { term: 'ندم', weight: 1.7 },
                    { term: 'خجلان', weight: 1.4 },
                    { term: 'قصرت', weight: 1.3 },
                    { term: 'guilt', weight: 1.8 },
                    { term: 'regret', weight: 1.7 }
                ],
                context: 'الشعور بالذنب يمكن أن يكون بداية رجوع جميل؛ باب التوبة مفتوح ما دامت الروح في الجسد.',
                verses: [
                    { surah: 39, ayah: 53, ref: 'الزمر 53', text: 'لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا' },
                    { surah: 66, ayah: 8, ref: 'التحريم 8', text: 'يَا أَيُّهَا الَّذِينَ آمَنُوا تُوبُوا إِلَى اللَّهِ تَوْبَةً نَّصُوحًا' },
                    { surah: 25, ayah: 70, ref: 'الفرقان 70', text: 'فَأُولَٰئِكَ يُبَدِّلُ اللَّهُ سَيِّئَاتِهِمْ حَسَنَاتٍ' },
                    { surah: 11, ayah: 114, ref: 'هود 114', text: 'إِنَّ الْحَسَنَاتِ يُذْهِبْنَ السَّيِّئَاتِ' }
                ]
            },
            {
                id: 'grief',
                label: 'فقد',
                title: 'للتعامل مع الفقد',
                keywords: [
                    { term: 'فقد', weight: 2.0 },
                    { term: 'فراق', weight: 1.8 },
                    { term: 'مات', weight: 1.7 },
                    { term: 'رحل', weight: 1.7 },
                    { term: 'grief', weight: 2.0 },
                    { term: 'loss', weight: 1.8 },
                    { term: 'bereaved', weight: 1.8 }
                ],
                context: 'ألم الفقد شديد، لكن الله مع الصابرين، ويجبر القلوب التي صدقت في الاستعانة به.',
                verses: [
                    { surah: 2, ayah: 156, ref: 'البقرة 156-157', text: 'إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ' },
                    { surah: 12, ayah: 86, ref: 'يوسف 86', text: 'إِنَّمَا أَشْكُو بَثِّي وَحُزْنِي إِلَى اللَّهِ' },
                    { surah: 57, ayah: 22, ref: 'الحديد 22-23', text: 'مَا أَصَابَ مِن مُّصِيبَةٍ فِي الْأَرْضِ وَلَا فِي أَنفُسِكُمْ إِلَّا فِي كِتَابٍ' },
                    { surah: 65, ayah: 5, ref: 'الطلاق 5', text: 'وَمَن يَتَّقِ اللَّهَ يُكَفِّرْ عَنْهُ سَيِّئَاتِهِ وَيُعْظِمْ لَهُ أَجْرًا' }
                ]
            },
            {
                id: 'burnout',
                label: 'إنهاك',
                title: 'عند الإرهاق والاحتراق النفسي',
                keywords: [
                    { term: 'منهك', weight: 1.9 },
                    { term: 'تعبان', weight: 1.5 },
                    { term: 'احتراق', weight: 2.0 },
                    { term: 'مطفي', weight: 1.5 },
                    { term: 'burnout', weight: 2.0 },
                    { term: 'exhausted', weight: 1.8 },
                    { term: 'drained', weight: 1.7 }
                ],
                context: 'الإرهاق لا يعني الضعف، بل يعني أنك تحتاج رحمة بنفسك وعودة هادئة إلى الله بخطوات بسيطة.',
                verses: [
                    { surah: 20, ayah: 2, ref: 'طه 2', text: 'مَا أَنْزَلْنَا عَلَيْكَ الْقُرْآنَ لِتَشْقَىٰ' },
                    { surah: 17, ayah: 82, ref: 'الإسراء 82', text: 'وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ' },
                    { surah: 73, ayah: 20, ref: 'المزمل 20', text: 'فَاقْرَؤُوا مَا تَيَسَّرَ مِنَ الْقُرْآنِ' },
                    { surah: 2, ayah: 286, ref: 'البقرة 286', text: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا' }
                ]
            },
            {
                id: 'lonely',
                label: 'وحدة',
                title: 'عند شعور الوحدة',
                keywords: [
                    { term: 'وحيد', weight: 1.8 },
                    { term: 'وحدة', weight: 1.8 },
                    { term: 'لوحدي', weight: 1.8 },
                    { term: 'منعزل', weight: 1.6 },
                    { term: 'lonely', weight: 1.8 },
                    { term: 'alone', weight: 1.6 }
                ],
                context: 'حتى إن غاب الناس، قرب الله لا يغيب. في الذكر والدعاء أنس عميق يطمئن القلب.',
                verses: [
                    { surah: 2, ayah: 186, ref: 'البقرة 186', text: 'فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ' },
                    { surah: 50, ayah: 16, ref: 'ق 16', text: 'وَنَحْنُ أَقْرَبُ إِلَيْهِ مِنْ حَبْلِ الْوَرِيدِ' },
                    { surah: 9, ayah: 40, ref: 'التوبة 40', text: 'لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا' },
                    { surah: 57, ayah: 4, ref: 'الحديد 4', text: 'وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ' }
                ]
            },
            {
                id: 'hope',
                label: 'أمل',
                title: 'لتجديد الأمل',
                keywords: [
                    { term: 'امل', weight: 1.8 },
                    { term: 'تفاؤل', weight: 1.8 },
                    { term: 'رجاء', weight: 1.7 },
                    { term: 'فرج', weight: 1.6 },
                    { term: 'hope', weight: 1.8 },
                    { term: 'optimistic', weight: 1.5 }
                ],
                context: 'الأمل عبادة قلبية، وكلما اشتدت العتمة اقترب الفجر، ووعد الله حق لا يتخلف.',
                verses: [
                    { surah: 12, ayah: 87, ref: 'يوسف 87', text: 'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ' },
                    { surah: 39, ayah: 53, ref: 'الزمر 53', text: 'لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ' },
                    { surah: 65, ayah: 2, ref: 'الطلاق 2-3', text: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا ۝ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ' },
                    { surah: 94, ayah: 6, ref: 'الشرح 6', text: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا' }
                ]
            },
            {
                id: 'gratitude',
                label: 'امتنان',
                title: 'لتثبيت الامتنان',
                keywords: [
                    { term: 'ممتن', weight: 1.7 },
                    { term: 'شكر', weight: 1.7 },
                    { term: 'امتنان', weight: 1.8 },
                    { term: 'الحمد', weight: 1.6 },
                    { term: 'grateful', weight: 1.7 },
                    { term: 'gratitude', weight: 1.7 }
                ],
                context: 'الامتنان يفتح بصيرة القلب، ويحوّل النظر من النقص إلى النعمة، ومن القلق إلى الرضا.',
                verses: [
                    { surah: 14, ayah: 7, ref: 'إبراهيم 7', text: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ' },
                    { surah: 55, ayah: 13, ref: 'الرحمن 13', text: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ' },
                    { surah: 16, ayah: 18, ref: 'النحل 18', text: 'وَإِن تَعُدُّوا نِعْمَةَ اللَّهِ لَا تُحْصُوهَا' },
                    { surah: 2, ayah: 152, ref: 'البقرة 152', text: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ' }
                ]
            }
        ];

        function normalizeMoodText(text) {
            return String(text || '')
                .toLowerCase()
                .normalize('NFKD')
                .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
                .replace(/[إأآٱ]/g, 'ا')
                .replace(/ى/g, 'ي')
                .replace(/ؤ/g, 'و')
                .replace(/ئ/g, 'ي')
                .replace(/ة/g, 'ه')
                .trim();
        }

        function countKeywordMatches(text, keyword) {
            if (!text || !keyword) return 0;
            let count = 0;
            let index = 0;
            while (true) {
                index = text.indexOf(keyword, index);
                if (index === -1) break;
                count += 1;
                index += keyword.length;
            }
            return count;
        }

        function scoreMoodProfile(normalizedText, profile) {
            let score = 0;
            profile.keywords.forEach(keywordRule => {
                const term = normalizeMoodText(keywordRule.term || '');
                const weight = Number(keywordRule.weight || 1);
                const hits = countKeywordMatches(normalizedText, term);
                if (hits > 0) {
                    score += hits * weight;
                }
            });
            return score;
        }

        function classifyMood(feelingText) {
            const normalized = normalizeMoodText(feelingText);
            if (!normalized) return null;

            const ranked = MOOD_SUPPORT_PROFILES
                .map(profile => ({
                    ...profile,
                    rawScore: scoreMoodProfile(normalized, profile)
                }))
                .filter(item => item.rawScore > 0)
                .sort((a, b) => b.rawScore - a.rawScore);

            if (ranked.length === 0) {
                const fallback = MOOD_SUPPORT_PROFILES.find(profile => profile.id === 'anxiety') || MOOD_SUPPORT_PROFILES[0];
                return {
                    selected: [fallback],
                    ranked: [{ ...fallback, confidence: 52 }]
                };
            }

            const topRaw = ranked[0].rawScore || 1;
            const rankedWithConfidence = ranked.slice(0, 3).map((item, index) => {
                const relative = item.rawScore / topRaw;
                const confidence = Math.max(36, Math.min(97, Math.round((relative * 100) - (index * 3))));
                return {
                    ...item,
                    confidence
                };
            });

            const selected = [rankedWithConfidence[0]];
            if (rankedWithConfidence[1] && rankedWithConfidence[1].rawScore >= rankedWithConfidence[0].rawScore * 0.58) {
                selected.push(rankedWithConfidence[1]);
            }

            return {
                selected,
                ranked: rankedWithConfidence
            };
        }

        function shuffleArray(list) {
            const copy = [...list];
            for (let i = copy.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        function buildAyahSet(selectedProfiles) {
            const selectedIds = selectedProfiles.map(profile => profile.id);
            const perProfileCount = selectedProfiles.length > 1 ? 3 : 5;
            const maxCount = selectedProfiles.length > 1 ? 6 : 5;
            const verseMap = new Map();

            selectedProfiles.forEach(profile => {
                const verses = shuffleArray(profile.verses);
                let localAdded = 0;
                verses.forEach(verse => {
                    if (localAdded >= perProfileCount) return;
                    const key = `${verse.surah}:${verse.ayah}`;
                    if (!verseMap.has(key)) {
                        verseMap.set(key, {
                            ...verse,
                            sourceMood: profile.label
                        });
                        localAdded += 1;
                    }
                });
            });

            if (verseMap.size < maxCount) {
                MOOD_SUPPORT_PROFILES
                    .filter(profile => !selectedIds.includes(profile.id))
                    .forEach(profile => {
                        if (verseMap.size >= maxCount) return;
                        const verses = shuffleArray(profile.verses);
                        verses.forEach(verse => {
                            if (verseMap.size >= maxCount) return;
                            const key = `${verse.surah}:${verse.ayah}`;
                            if (!verseMap.has(key)) {
                                verseMap.set(key, {
                                    ...verse,
                                    sourceMood: profile.label
                                });
                            }
                        });
                    });
            }

            return Array.from(verseMap.values()).slice(0, maxCount);
        }

        function createMoodSummary(selectedProfiles) {
            if (selectedProfiles.length > 1) {
                return `تم التقاط مزيج مشاعر: ${selectedProfiles[0].label} + ${selectedProfiles[1].label}`;
            }
            return `تم التقاط الشعور الأقرب: ${selectedProfiles[0].label}`;
        }

        const MOOD_ANALYSIS_STEPS = [
            'تنظيف النص المدخل',
            'تحليل الكلمات والمشاعر',
            'مطابقة أفضل الآيات',
            'تجهيز رسالة الدعم'
        ];
        const MOOD_RUN_CANCELLED = 'MOOD_RUN_CANCELLED';
        let moodGenerationRunId = 0;

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        function getMoodElements() {
            return {
                input: document.getElementById('moodInput'),
                result: document.getElementById('moodResult'),
                status: document.getElementById('moodStatus'),
                button: document.getElementById('moodGenerateBtn')
            };
        }

        function setMoodButtonLoading(isLoading, label) {
            const { button } = getMoodElements();
            if (!button) return;

            if (!button.dataset.defaultText) {
                button.dataset.defaultText = button.textContent.trim();
            }

            if (isLoading) {
                button.disabled = true;
                button.classList.add('is-loading');
                button.innerHTML = `<span class="mood-btn-spinner" aria-hidden="true"></span><span>${label || 'جارٍ التحليل...'}</span>`;
                return;
            }

            button.disabled = false;
            button.classList.remove('is-loading');
            button.textContent = button.dataset.defaultText || 'ولّد آيات مناسبة';
        }

        function renderMoodStatus(stepIndex, headline, mode = 'progress') {
            const { status } = getMoodElements();
            if (!status) return;

            const safeStepIndex = Math.max(0, Math.min(MOOD_ANALYSIS_STEPS.length - 1, stepIndex));
            const isSuccess = mode === 'success';
            const isError = mode === 'error';
            const activeIndex = isSuccess ? MOOD_ANALYSIS_STEPS.length - 1 : safeStepIndex;
            const progress = isSuccess ? 100 : Math.round(((activeIndex + 1) / MOOD_ANALYSIS_STEPS.length) * 100);

            const stepsHtml = MOOD_ANALYSIS_STEPS.map((step, index) => {
                const done = isSuccess || index < activeIndex;
                const current = !isSuccess && !isError && index === activeIndex;
                const failed = isError && index === activeIndex;

                const icon = done
                    ? '<i class="bi bi-check-circle-fill" aria-hidden="true"></i>'
                    : failed
                        ? '<i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i>'
                        : current
                            ? '<span class="mood-step-spinner" aria-hidden="true"></span>'
                            : '<i class="bi bi-circle" aria-hidden="true"></i>';

                const classes = ['mood-status-step', done ? 'done' : '', current ? 'current' : '', failed ? 'failed' : '']
                    .filter(Boolean)
                    .join(' ');

                return `<div class="${classes}">${icon}<span>${step}</span></div>`;
            }).join('');

            status.className = `mood-status active ${isSuccess ? 'success' : ''} ${isError ? 'error' : ''}`.trim();
            status.innerHTML = `
                <div class="mood-status-head">
                    <div class="mood-status-title">${headline}</div>
                    <div class="mood-status-meta">${progress}%</div>
                </div>
                <div class="mood-status-track">
                    <span class="mood-status-track-fill" style="width:${progress}%"></span>
                </div>
                <div class="mood-status-steps">${stepsHtml}</div>
            `;
        }

        function renderMoodLoadingCard(stepLabel) {
            const { result } = getMoodElements();
            if (!result) return;

            result.className = 'mood-result is-loading';
            result.innerHTML = `
                <div class="mood-loading-title">
                    <span class="mood-step-spinner" aria-hidden="true"></span>
                    <span>${stepLabel}</span>
                </div>
                <div class="mood-loading-line"></div>
                <div class="mood-loading-line"></div>
                <div class="mood-loading-line short"></div>
            `;
        }

        function renderMoodError(message) {
            const { result } = getMoodElements();
            if (!result) return;

            result.className = 'mood-result error';
            result.innerHTML = `<div class="mood-context-text">${message}</div>`;
        }

        async function runMoodStep(runId, stepIndex, delayMs, headline) {
            renderMoodStatus(stepIndex, headline);
            renderMoodLoadingCard(headline);
            await sleep(delayMs);

            if (runId !== moodGenerationRunId) {
                const error = new Error('Mood support run cancelled');
                error.code = MOOD_RUN_CANCELLED;
                throw error;
            }
        }

        function applyMoodQuick(text) {
            const input = document.getElementById('moodInput');
            if (!input) return;
            input.value = text;
            generateMoodSupport();
        }

        async function generateMoodSupport() {
            const { input, result } = getMoodElements();
            if (!input || !result) return;

            const feeling = input.value.trim();
            if (!feeling) {
                alert('اكتب شعورك أولاً حتى نقترح آيات مناسبة.');
                input.focus();
                return;
            }

            const runId = ++moodGenerationRunId;
            const normalizedLength = normalizeMoodText(feeling).length;
            const analyzeDelay = Math.min(1100, 280 + Math.floor(normalizedLength * 9));

            setMoodButtonLoading(true, 'جارٍ التحليل...');

            try {
                await runMoodStep(runId, 0, 170, 'جاري تجهيز النص');

                const classification = classifyMood(feeling);
                await runMoodStep(runId, 1, analyzeDelay, 'جاري تحليل المشاعر');

                if (!classification || !classification.selected.length) {
                    renderMoodStatus(1, 'لم نتمكن من التقاط شعور واضح', 'error');
                    renderMoodError('تعذر تحليل النص الحالي. حاول كتابة شعورك بجملة أوضح.');
                    return;
                }

                await runMoodStep(runId, 2, 320, 'جاري مطابقة آيات مناسبة');

                const selectedProfiles = classification.selected;
                const ayahSet = buildAyahSet(selectedProfiles);

                await runMoodStep(runId, 3, 220, 'جاري تجهيز النتيجة');

                if (runId !== moodGenerationRunId) return;

                const scorePills = classification.ranked.map((item, index) => `
                    <span class="mood-score-pill ${index > 0 ? 'secondary' : ''}">${item.label} ${item.confidence}%</span>
                `).join('');

                const contexts = selectedProfiles.map(profile => profile.context);
                const combinedContext = contexts.join(' ');

                const versesHtml = ayahSet.map(verse => `
                    <div class="mood-ayah-item">
                        <span class="mood-ayah-tag">مناسب لـ ${verse.sourceMood}</span>
                        <div class="mood-ayah-text">${verse.text}</div>
                        <div class="mood-ayah-ref">
                            <span>${verse.ref}</span>
                            <a class="mood-ayah-link" href="quran.html?surah=${verse.surah}&ayah=${verse.ayah}">فتح الآية</a>
                        </div>
                    </div>
                `).join('');

                result.className = 'mood-result active';
                result.innerHTML = `
                    <div class="mood-context-title">${selectedProfiles[0].title}</div>
                    <div class="mood-detected">${createMoodSummary(selectedProfiles)}</div>
                    <div class="mood-score-list">${scorePills}</div>
                    <div class="mood-context-text">${combinedContext}</div>
                    <div class="mood-ayah-list">${versesHtml}</div>
                    <div class="mood-note">إذا كان شعورك مؤلماً لفترة طويلة، تحدث مع شخص تثق به أو مختص نفسي إلى جانب الاستعانة بالقرآن والدعاء.</div>
                `;

                renderMoodStatus(3, 'اكتمل التحليل - هذه الآيات الأقرب لحالتك', 'success');
            } catch (error) {
                if (error && error.code === MOOD_RUN_CANCELLED) {
                    return;
                }

                renderMoodStatus(0, 'حدث خلل أثناء التحليل', 'error');
                renderMoodError('حدث خطأ غير متوقع. حاول مرة أخرى بعد لحظات.');
            } finally {
                if (runId === moodGenerationRunId) {
                    setMoodButtonLoading(false);
                }
            }
        }

        // Initialize
        loadDailyVerse();
        checkResumeReading();
        renderHabitDashboard();
        renderKhatmaPlanner();
        syncPrayerDashboardCard();
        initPrayerDashboardSync();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            checkResumeReading();
            renderHabitDashboard();
            syncPrayerDashboardCard();
        });
