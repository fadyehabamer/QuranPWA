let totalPages = 0;
        let pages = [];
        let currentSurah = null;
        let currentPageIndex = 0;
        let touchStartX = 0;
        let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
        const minSwipeDistance = 50;
    const maxVerticalSwipeDistance = 70;
        const AYAHS_PER_PAGE = 10;
    const SURAH_READING_POSITION_KEY = 'quranSurahReadingPositionV1';
    const SWIPE_HINT_SEEN_KEY = 'quranSwipeHintSeenV1';
        const READER_FONT_LEVEL_KEY = 'quranReaderFontLevelV1';
        const READER_FONT_LEVELS = [
            { key: 'sm', label: 'صغير', size: 22 },
            { key: 'md', label: 'متوسط', size: 26 },
            { key: 'lg', label: 'كبير', size: 30 }
        ];
        let currentReaderFontLevelIndex = 1;

        // Audio player state
        let currentAudio = null;
        let currentReciter = 'ar.alafasy';
        let isPlaying = false;
        let currentAyahIndex = 0;
        let allAyahs = [];
        let searchDebounceTimer = null;
        let searchAbortController = null;
        let latestSearchToken = 0;
        const ayahSearchCache = new Map();
        const tafsirSnippetCache = new Map();
        const SHARE_CARD_STYLE_KEY = 'quranAyahCardStyleV1';
        const SHARE_CARD_STYLES = {
            classic: {
                label: 'نمط كلاسيكي',
                palette: {
                    backgroundStart: '#f7fbf7',
                    backgroundEnd: '#e8f4ea',
                    orbOne: 'rgba(27, 94, 32, 0.08)',
                    orbTwo: 'rgba(27, 94, 32, 0.08)',
                    cardFill: '#ffffff',
                    cardStroke: 'rgba(27, 94, 32, 0.16)',
                    heading: '#1b5e20',
                    divider: 'rgba(27, 94, 32, 0.2)',
                    ayah: '#243125',
                    tafsirDivider: 'rgba(27, 94, 32, 0.16)',
                    tafsir: '#2f4a31',
                    footer: '#1b5e20'
                }
            },
            warm: {
                label: 'نمط دافئ',
                palette: {
                    backgroundStart: '#fff7e7',
                    backgroundEnd: '#fde8c7',
                    orbOne: 'rgba(191, 129, 39, 0.14)',
                    orbTwo: 'rgba(138, 90, 30, 0.12)',
                    cardFill: '#fffdf8',
                    cardStroke: 'rgba(165, 111, 37, 0.28)',
                    heading: '#8a5a1e',
                    divider: 'rgba(138, 90, 30, 0.35)',
                    ayah: '#5a3d17',
                    tafsirDivider: 'rgba(138, 90, 30, 0.24)',
                    tafsir: '#714a1c',
                    footer: '#8a5a1e'
                }
            },
            night: {
                label: 'نمط ليلي',
                palette: {
                    backgroundStart: '#0e2136',
                    backgroundEnd: '#06121f',
                    orbOne: 'rgba(83, 139, 211, 0.28)',
                    orbTwo: 'rgba(52, 95, 148, 0.24)',
                    cardFill: 'rgba(12, 28, 48, 0.92)',
                    cardStroke: 'rgba(140, 186, 241, 0.32)',
                    heading: '#9ec7ff',
                    divider: 'rgba(158, 199, 255, 0.35)',
                    ayah: '#f3f8ff',
                    tafsirDivider: 'rgba(158, 199, 255, 0.28)',
                    tafsir: '#d8e9ff',
                    footer: '#9ec7ff'
                }
            }
        };
        const SHARE_CARD_CANVAS_FONT_STACKS = {
            ui: '"Cairo", "Noto Sans Arabic", "Tajawal", "Segoe UI", Tahoma, Arial, sans-serif',
            verse: '"Amiri", "Noto Naskh Arabic", "Scheherazade New", "Geeza Pro", "Times New Roman", serif'
        };
        const SHARE_CARD_FONT_LOAD_TIMEOUT_MS = 1800;
        const MEMORIZATION_PROGRESS_KEY = 'quranMemorizedAyahsV1';
        const LAST_BOOKMARK_FOLDER_KEY = 'quranLastBookmarkFolderV1';
        let currentShareCardStyle = 'classic';
        let memorizationMode = false;
        let memorizationAyahIndex = 0;
        let memorizationReveal = true;
        let memorizedAyahsByNumber = {};
        let memorizationAudio = null;
        let memorizationAudioAyahNumber = null;
        let memorizationAudioLoading = false;
        let memorizationAudioSource = '';
        let memorizationRepeatEnabled = false;
        let ayahQuickActionAyahNumber = null;
        let ayahQuickActionTargetElement = null;
        let ayahQuickActionHideTimer = null;
        const ayahQuickTafsirCache = new Map();
        const MAX_SURAH_SEARCH_RESULTS = 6;
        const MAX_AYAH_SEARCH_RESULTS = 8;

        try {
            const savedShareCardStyle = localStorage.getItem(SHARE_CARD_STYLE_KEY);
            if (savedShareCardStyle && SHARE_CARD_STYLES[savedShareCardStyle]) {
                currentShareCardStyle = savedShareCardStyle;
            }
        } catch (error) {
            // Ignore localStorage read issues and keep default style.
        }

        try {
            const savedMemorizedAyahs = JSON.parse(localStorage.getItem(MEMORIZATION_PROGRESS_KEY) || '{}');
            if (savedMemorizedAyahs && typeof savedMemorizedAyahs === 'object') {
                memorizedAyahsByNumber = savedMemorizedAyahs;
            }
        } catch (error) {
            memorizedAyahsByNumber = {};
        }

        const surahNames = [
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

        const surahInfo = [
            { name: 'الفاتحة', verses: 7, type: 'مكية' },
            { name: 'البقرة', verses: 286, type: 'مدنية' },
            { name: 'آل عمران', verses: 200, type: 'مدنية' },
            { name: 'النساء', verses: 176, type: 'مدنية' },
            { name: 'المائدة', verses: 120, type: 'مدنية' },
            { name: 'الأنعام', verses: 165, type: 'مكية' },
            { name: 'الأعراف', verses: 206, type: 'مكية' },
            { name: 'الأنفال', verses: 75, type: 'مدنية' },
            { name: 'التوبة', verses: 129, type: 'مدنية' },
            { name: 'يونس', verses: 109, type: 'مكية' },
            { name: 'هود', verses: 123, type: 'مكية' },
            { name: 'يوسف', verses: 111, type: 'مكية' },
            { name: 'الرعد', verses: 43, type: 'مدنية' },
            { name: 'ابراهيم', verses: 52, type: 'مكية' },
            { name: 'الحجر', verses: 99, type: 'مكية' },
            { name: 'النحل', verses: 128, type: 'مكية' },
            { name: 'الإسراء', verses: 111, type: 'مكية' },
            { name: 'الكهف', verses: 110, type: 'مكية' },
            { name: 'مريم', verses: 98, type: 'مكية' },
            { name: 'طه', verses: 135, type: 'مكية' },
            { name: 'الأنبياء', verses: 112, type: 'مكية' },
            { name: 'الحج', verses: 78, type: 'مدنية' },
            { name: 'المؤمنون', verses: 118, type: 'مكية' },
            { name: 'النور', verses: 64, type: 'مدنية' },
            { name: 'الفرقان', verses: 77, type: 'مكية' },
            { name: 'الشعراء', verses: 227, type: 'مكية' },
            { name: 'النمل', verses: 93, type: 'مكية' },
            { name: 'القصص', verses: 88, type: 'مكية' },
            { name: 'العنكبوت', verses: 69, type: 'مكية' },
            { name: 'الروم', verses: 60, type: 'مكية' },
            { name: 'لقمان', verses: 34, type: 'مكية' },
            { name: 'السجدة', verses: 30, type: 'مكية' },
            { name: 'الأحزاب', verses: 73, type: 'مدنية' },
            { name: 'سبإ', verses: 54, type: 'مكية' },
            { name: 'فاطر', verses: 45, type: 'مكية' },
            { name: 'يس', verses: 83, type: 'مكية' },
            { name: 'الصافات', verses: 182, type: 'مكية' },
            { name: 'ص', verses: 88, type: 'مكية' },
            { name: 'الزمر', verses: 75, type: 'مكية' },
            { name: 'غافر', verses: 85, type: 'مكية' },
            { name: 'فصلت', verses: 54, type: 'مكية' },
            { name: 'الشورى', verses: 53, type: 'مكية' },
            { name: 'الزخرف', verses: 89, type: 'مكية' },
            { name: 'الدخان', verses: 59, type: 'مكية' },
            { name: 'الجاثية', verses: 37, type: 'مكية' },
            { name: 'الأحقاف', verses: 35, type: 'مكية' },
            { name: 'محمد', verses: 38, type: 'مدنية' },
            { name: 'الفتح', verses: 29, type: 'مدنية' },
            { name: 'الحجرات', verses: 18, type: 'مدنية' },
            { name: 'ق', verses: 45, type: 'مكية' },
            { name: 'الذاريات', verses: 60, type: 'مكية' },
            { name: 'الطور', verses: 49, type: 'مكية' },
            { name: 'النجم', verses: 62, type: 'مكية' },
            { name: 'القمر', verses: 55, type: 'مكية' },
            { name: 'الرحمن', verses: 78, type: 'مكية' },
            { name: 'الواقعة', verses: 96, type: 'مكية' },
            { name: 'الحديد', verses: 29, type: 'مدنية' },
            { name: 'المجادلة', verses: 22, type: 'مدنية' },
            { name: 'الحشر', verses: 24, type: 'مدنية' },
            { name: 'الممتحنة', verses: 13, type: 'مدنية' },
            { name: 'الصف', verses: 14, type: 'مدنية' },
            { name: 'الجمعة', verses: 11, type: 'مدنية' },
            { name: 'المنافقون', verses: 11, type: 'مدنية' },
            { name: 'التغابن', verses: 18, type: 'مدنية' },
            { name: 'الطلاق', verses: 12, type: 'مدنية' },
            { name: 'التحريم', verses: 12, type: 'مدنية' },
            { name: 'الملك', verses: 30, type: 'مكية' },
            { name: 'القلم', verses: 52, type: 'مكية' },
            { name: 'الحاقة', verses: 52, type: 'مكية' },
            { name: 'المعارج', verses: 44, type: 'مكية' },
            { name: 'نوح', verses: 28, type: 'مكية' },
            { name: 'الجن', verses: 28, type: 'مكية' },
            { name: 'المزمل', verses: 20, type: 'مكية' },
            { name: 'المدثر', verses: 56, type: 'مكية' },
            { name: 'القيامة', verses: 40, type: 'مكية' },
            { name: 'الانسان', verses: 31, type: 'مدنية' },
            { name: 'المرسلات', verses: 50, type: 'مكية' },
            { name: 'النبإ', verses: 40, type: 'مكية' },
            { name: 'النازعات', verses: 46, type: 'مكية' },
            { name: 'عبس', verses: 42, type: 'مكية' },
            { name: 'التكوير', verses: 29, type: 'مكية' },
            { name: 'الإنفطار', verses: 19, type: 'مكية' },
            { name: 'المطففين', verses: 36, type: 'مكية' },
            { name: 'الإنشقاق', verses: 25, type: 'مكية' },
            { name: 'البروج', verses: 22, type: 'مكية' },
            { name: 'الطارق', verses: 17, type: 'مكية' },
            { name: 'الأعلى', verses: 19, type: 'مكية' },
            { name: 'الغاشية', verses: 26, type: 'مكية' },
            { name: 'الفجر', verses: 30, type: 'مكية' },
            { name: 'البلد', verses: 20, type: 'مكية' },
            { name: 'الشمس', verses: 15, type: 'مكية' },
            { name: 'الليل', verses: 21, type: 'مكية' },
            { name: 'الضحى', verses: 11, type: 'مكية' },
            { name: 'الشرح', verses: 8, type: 'مكية' },
            { name: 'التين', verses: 8, type: 'مكية' },
            { name: 'العلق', verses: 19, type: 'مكية' },
            { name: 'القدر', verses: 5, type: 'مكية' },
            { name: 'البينة', verses: 8, type: 'مدنية' },
            { name: 'الزلزلة', verses: 8, type: 'مدنية' },
            { name: 'العاديات', verses: 11, type: 'مكية' },
            { name: 'القارعة', verses: 11, type: 'مكية' },
            { name: 'التكاثر', verses: 8, type: 'مكية' },
            { name: 'العصر', verses: 3, type: 'مكية' },
            { name: 'الهمزة', verses: 9, type: 'مكية' },
            { name: 'الفيل', verses: 5, type: 'مكية' },
            { name: 'قريش', verses: 4, type: 'مكية' },
            { name: 'الماعون', verses: 7, type: 'مكية' },
            { name: 'الكوثر', verses: 3, type: 'مكية' },
            { name: 'الكافرون', verses: 6, type: 'مكية' },
            { name: 'النصر', verses: 3, type: 'مدنية' },
            { name: 'المسد', verses: 5, type: 'مكية' },
            { name: 'الإخلاص', verses: 4, type: 'مكية' },
            { name: 'الفلق', verses: 5, type: 'مكية' },
            { name: 'الناس', verses: 6, type: 'مكية' }
        ];

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function normalizeArabicText(value) {
            return String(value || '')
                .toLowerCase()
                .normalize('NFKD')
                .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
                .replace(/[إأآٱ]/g, 'ا')
                .replace(/ى/g, 'ي')
                .replace(/ؤ/g, 'و')
                .replace(/ئ/g, 'ي')
                .replace(/ة/g, 'ه')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function getSurahSearchMatches(query) {
            const normalizedQuery = normalizeArabicText(query);
            if (!normalizedQuery) return [];

            return surahInfo
                .map((surah, index) => ({
                    surah,
                    number: index + 1,
                    arabicName: surahNames[index],
                    haystack: normalizeArabicText(`${surah.name} ${surahNames[index]} ${surah.type} ${index + 1}`)
                }))
                .filter(item => item.haystack.includes(normalizedQuery) || String(item.number).includes(query.trim()))
                .slice(0, MAX_SURAH_SEARCH_RESULTS);
        }

        function renderInstantSearchResults({ query, surahMatches = [], ayahMatches = [], isLoading = false, error = '' }) {
            const resultsBox = document.getElementById('instantSearchResults');
            if (!resultsBox) return;

            if (!query || query.trim().length < 2) {
                clearInstantSearchResults();
                return;
            }

            let html = '';

            if (surahMatches.length > 0) {
                html += '<div class="instant-search-section">';
                html += '<div class="instant-search-section-title">نتائج السور</div>';
                html += '</div>';

                surahMatches.forEach(item => {
                    html += `
                        <button class="instant-result-item" onclick="openSearchSurah(${item.number})" type="button">
                            <strong>سورة ${escapeHtml(item.surah.name)}</strong>
                            <small>رقم ${item.number} • ${escapeHtml(item.surah.type)} • ${item.surah.verses} آيات</small>
                        </button>
                    `;
                });
            }

            if (ayahMatches.length > 0 || isLoading || error) {
                html += '<div class="instant-search-section">';
                html += '<div class="instant-search-section-title">نتائج الآيات</div>';
                html += '</div>';

                if (isLoading) {
                    html += '<div class="instant-result-empty">جار البحث في نصوص الآيات...</div>';
                } else if (error) {
                    html += `<div class="instant-result-empty">${escapeHtml(error)}</div>`;
                } else {
                    ayahMatches.forEach(match => {
                        html += `
                            <button class="instant-result-item" onclick="openSearchAyah(${match.surahNumber}, ${match.ayahNumberInSurah})" type="button">
                                <strong>سورة ${escapeHtml(match.surahName)} • آية ${match.ayahNumberInSurah}</strong>
                                <small>${escapeHtml(match.previewText)}</small>
                            </button>
                        `;
                    });
                }
            }

            if (!surahMatches.length && !ayahMatches.length && !isLoading && !error) {
                html = '<div class="instant-result-empty">لا توجد نتائج مطابقة</div>';
            }

            resultsBox.innerHTML = html;
            resultsBox.classList.add('active');
        }

        function clearInstantSearchResults() {
            const resultsBox = document.getElementById('instantSearchResults');
            if (!resultsBox) return;
            resultsBox.classList.remove('active');
            resultsBox.innerHTML = '';
        }

        async function fetchAyahSearchMatches(query, signal) {
            const normalizedQuery = normalizeArabicText(query);
            if (ayahSearchCache.has(normalizedQuery)) {
                return ayahSearchCache.get(normalizedQuery);
            }

            const response = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(query)}/all/ar`, { signal });
            if (!response.ok) {
                throw new Error('تعذر الوصول لخدمة البحث حالياً');
            }

            const data = await response.json();
            const matches = (data?.data?.matches || [])
                .slice(0, MAX_AYAH_SEARCH_RESULTS)
                .map(match => ({
                    surahNumber: match?.surah?.number,
                    surahName: match?.surah?.name || '',
                    ayahNumberInSurah: match?.numberInSurah,
                    previewText: (match?.text || '').replace(/\s+/g, ' ').trim().slice(0, 170)
                }))
                .filter(match => match.surahNumber && match.ayahNumberInSurah);

            ayahSearchCache.set(normalizedQuery, matches);
            return matches;
        }

        function onSearchInput() {
            const input = document.getElementById('surahSearch');
            if (!input) return;

            const query = input.value.trim();
            filterSurahs(query);

            clearTimeout(searchDebounceTimer);
            if (searchAbortController) {
                searchAbortController.abort();
                searchAbortController = null;
            }

            if (query.length < 2) {
                latestSearchToken++;
                clearInstantSearchResults();
                return;
            }

            const searchToken = ++latestSearchToken;
            const surahMatches = getSurahSearchMatches(query);
            renderInstantSearchResults({
                query,
                surahMatches,
                ayahMatches: [],
                isLoading: true
            });

            searchDebounceTimer = setTimeout(async () => {
                searchAbortController = new AbortController();

                try {
                    const ayahMatches = await fetchAyahSearchMatches(query, searchAbortController.signal);
                    if (searchToken !== latestSearchToken) return;

                    renderInstantSearchResults({
                        query,
                        surahMatches,
                        ayahMatches,
                        isLoading: false
                    });
                } catch (error) {
                    if (error.name === 'AbortError') return;
                    if (searchToken !== latestSearchToken) return;

                    renderInstantSearchResults({
                        query,
                        surahMatches,
                        ayahMatches: [],
                        isLoading: false,
                        error: 'تعذر البحث في الآيات الآن، يمكنك متابعة البحث في السور.'
                    });
                }
            }, 320);
        }

        function renderSurahList() {
            const list = document.getElementById('surahList');
            let html = '';

            surahInfo.forEach((surah, index) => {
                const number = index + 1;
                const juz = surahToJuz[number];
                html += `
                    <div class="surah-item" onclick="selectSurah(` + number + `)" data-name="` + surah.name + `" data-number="` + number + `">
                        <div class="surah-item-right">
                            <div class="surah-number">` + number + `</div>
                            <div class="surah-item-info">
                                <div class="surah-item-name">` + surah.name + `</div>
                                <div class="surah-item-details">الجزء ` + juz + ` • ` + surah.type + ` • ` + surah.verses + ` آيات</div>
                            </div>
                        </div>
                        <div class="surah-item-left">
                            <div class="surah-item-arabic">` + surahNames[index] + `</div>
                            <div class="surah-item-verses">` + surah.verses + ` آية</div>
                        </div>
                    </div>
                `;
            });

            list.innerHTML = html;
        }

        function filterSurahs(searchTermOverride = '') {
            const input = document.getElementById('surahSearch');
            const rawSearchTerm = searchTermOverride || input?.value || '';
            const searchTerm = normalizeArabicText(rawSearchTerm);
            const items = document.querySelectorAll('.surah-item');

            items.forEach(item => {
                const name = normalizeArabicText(item.getAttribute('data-name'));
                const number = item.getAttribute('data-number');
                if (name.includes(searchTerm) || number.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        }

        function selectSurah(number, options = {}) {
            currentSurah = number;
            showSurahReader();
            loadSurah(number, options);
        }

        async function openSurahAtPage(surahNumber, pageIndex = null, ayahNumberInSurah = null) {
            showSurahReader();
            await loadSurah(surahNumber);

            if (totalPages <= 0) {
                return;
            }

            if (Number.isInteger(pageIndex)) {
                const safePageIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
                currentPageIndex = safePageIndex;
                renderCurrentPage();
                updateNavigation();
                resetMemorizationCoachForPage();
            }

            if (ayahNumberInSurah) {
                setTimeout(() => {
                    highlightAyahInView(ayahNumberInSurah);
                }, 120);
            }
        }

        function highlightAyahInView(ayahNumberInSurah) {
            const ayahElements = document.querySelectorAll('#quranContent .ayah');
            let target = null;

            ayahElements.forEach(element => {
                const numberElement = element.querySelector('.ayah-number');
                const currentAyahNumber = parseInt(numberElement?.textContent || '', 10);
                if (currentAyahNumber === ayahNumberInSurah) {
                    target = element;
                }
            });

            if (!target) return;

            target.classList.add('ayah-search-highlight');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => target.classList.remove('ayah-search-highlight'), 2200);
        }

        function openSearchSurah(surahNumber) {
            const searchInput = document.getElementById('surahSearch');
            if (searchInput) searchInput.value = '';
            clearInstantSearchResults();
            filterSurahs();
            selectSurah(surahNumber);
        }

        function openSearchAyah(surahNumber, ayahNumberInSurah) {
            const searchInput = document.getElementById('surahSearch');
            if (searchInput) searchInput.value = '';
            clearInstantSearchResults();
            filterSurahs();

            const targetPageIndex = Math.floor((ayahNumberInSurah - 1) / AYAHS_PER_PAGE);
            openSurahAtPage(surahNumber, targetPageIndex, ayahNumberInSurah);
        }

        function showSurahList() {
            document.getElementById('surahListView').classList.add('active');
            document.getElementById('surahReaderView').classList.remove('active');
            document.body.classList.remove('quran-reader-active');
            stopMemorizationAyahAudio(true);
            hideAyahQuickActions({ immediate: true });
            memorizationMode = false;
            document.getElementById('surahSearch').value = '';
            filterSurahs();
            clearInstantSearchResults();
            closeShareAyahModal();
            updateMemorizationCoachUI();
            updateScrollTopButtonVisibility();
        }

        function showSurahReader() {
            document.getElementById('surahListView').classList.remove('active');
            document.getElementById('surahReaderView').classList.add('active');
            document.body.classList.add('quran-reader-active');
            // Don't auto-show player anymore, let user toggle it
            showSwipeHintOnce();
            updateMemorizationCoachUI();
            updateScrollTopButtonVisibility();
        }

        function setReaderFontLevel(levelIndex, persist = true) {
            const safeIndex = Math.max(0, Math.min(levelIndex, READER_FONT_LEVELS.length - 1));
            currentReaderFontLevelIndex = safeIndex;
            const level = READER_FONT_LEVELS[safeIndex];

            document.documentElement.style.setProperty('--quran-reader-font-size', `${level.size}px`);

            const label = document.getElementById('readerFontLabel');
            if (label) {
                label.textContent = level.label;
            }

            const fontBtn = document.getElementById('readerFontBtn');
            if (fontBtn) {
                fontBtn.setAttribute('aria-label', `حجم الخط: ${level.label}`);
            }

            if (persist) {
                localStorage.setItem(READER_FONT_LEVEL_KEY, level.key);
            }
        }

        function initReaderFontLevel() {
            const savedLevel = localStorage.getItem(READER_FONT_LEVEL_KEY);
            const savedIndex = READER_FONT_LEVELS.findIndex(level => level.key === savedLevel);

            let initialIndex = savedIndex;
            if (initialIndex === -1) {
                initialIndex = window.matchMedia('(max-width: 768px)').matches ? 0 : 1;
            }

            setReaderFontLevel(initialIndex, false);
        }

        function cycleReaderFontSize() {
            const nextIndex = (currentReaderFontLevelIndex + 1) % READER_FONT_LEVELS.length;
            setReaderFontLevel(nextIndex, true);
            showTemporaryMessage(`حجم الخط: ${READER_FONT_LEVELS[nextIndex].label}`);
        }

        function isReaderViewActive() {
            const readerView = document.getElementById('surahReaderView');
            return Boolean(readerView && readerView.classList.contains('active'));
        }

        function getSurahReadingPositions() {
            try {
                return JSON.parse(localStorage.getItem(SURAH_READING_POSITION_KEY) || '{}');
            } catch (_error) {
                return {};
            }
        }

        function getSavedPageForSurah(surahNumber) {
            const positions = getSurahReadingPositions();
            const entry = positions[String(surahNumber)];
            if (!entry || typeof entry.page !== 'number') return null;
            return entry.page;
        }

        function savePageForCurrentSurah() {
            if (!currentSurah || totalPages <= 0) return;

            const positions = getSurahReadingPositions();
            positions[String(currentSurah)] = {
                page: currentPageIndex,
                updatedAt: Date.now()
            };

            localStorage.setItem(SURAH_READING_POSITION_KEY, JSON.stringify(positions));
        }

        function updateReaderProgressUI() {
            const pageLabel = document.getElementById('readerPageLabel');
            const progressPercent = document.getElementById('readerProgressPercent');
            const progressFill = document.getElementById('readerProgressFill');

            if (!pageLabel || !progressPercent || !progressFill || totalPages <= 0) {
                return;
            }

            const pageNumber = Math.max(1, currentPageIndex + 1);
            const percent = Math.round((pageNumber / totalPages) * 100);

            pageLabel.textContent = `صفحة ${pageNumber} من ${totalPages}`;
            progressPercent.textContent = `${percent}%`;
            progressFill.style.width = `${percent}%`;
        }

        function showSwipeHintOnce() {
            const hint = document.getElementById('swipeHint');
            if (!hint) return;

            if (localStorage.getItem(SWIPE_HINT_SEEN_KEY) === '1') {
                return;
            }

            hint.classList.remove('visible');
            void hint.offsetWidth;
            hint.classList.add('visible');
            localStorage.setItem(SWIPE_HINT_SEEN_KEY, '1');
        }

        function updateScrollTopButtonVisibility() {
            const button = document.getElementById('scrollTopBtn');
            if (!button) return;

            const shouldShow = isReaderViewActive() && window.scrollY > 320;
            button.classList.toggle('show', shouldShow);
        }

        function scrollReaderToTop(instant = false) {
            window.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' });
        }

        async function loadSurah(surahNumber, options = {}) {
            if (!surahNumber) return;

            currentSurah = parseInt(surahNumber);
            currentPageIndex = 0; // Reset page index at the start
            const shouldStartFromBeginning = Boolean(options.startFromBeginning);

            // Reset audio state
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
            stopMemorizationAyahAudio(true);
            hideAyahQuickActions({ immediate: true });
            isPlaying = false;
            currentAyahIndex = 0;
            allAyahs = [];
            removeAyahHighlight();
            updatePlayButton();


            const content = document.getElementById('quranContent');
            content.innerHTML = '<div class="loading"><div class="spinner"></div><p>جار التحميل...</p></div>';

            try {
                const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`);
                if (!response.ok) throw new Error('Failed to load surah');

                const data = await response.json();
                if (data.code !== 200 || !data.data?.ayahs) throw new Error('Invalid response');

                const surah = surahInfo[surahNumber - 1];
                const juz = surahToJuz[surahNumber];
                const surahTitle = document.getElementById('surahTitle');
                const surahDesc = document.getElementById('surahDescription');
                if (surahTitle) surahTitle.textContent = data.data.name;
                if (surahDesc) surahDesc.textContent = `الجزء ${juz} • ${surah.type} • ${surah.verses} آيات`;

                createPages(data.data);

                const savedPageIndex = getSavedPageForSurah(currentSurah);
                if (!shouldStartFromBeginning && Number.isInteger(savedPageIndex)) {
                    currentPageIndex = Math.max(0, Math.min(savedPageIndex, totalPages - 1));
                }

                renderCurrentPage();
                checkBookmark();
                updateNavigation();
                loadPlaybackPosition();
                resetMemorizationCoachForPage();
            } catch (error) {
                console.error('Error:', error);
                content.innerHTML = '<div class="loading" style="color: red;"><p>خطأ في التحميل</p></div>';
            }
        }


        function createPages(surahData) {
            const ayahs = surahData.ayahs;
            pages = [];

            for (let i = 0; i < ayahs.length; i += AYAHS_PER_PAGE) {
                const pageAyahs = ayahs.slice(i, i + AYAHS_PER_PAGE);
                pages.push({
                    surahName: surahData.name,
                    surahEnglish: surahData.englishName,
                    surahNumber: surahData.number,
                    revelationType: surahData.revelationType === 'Meccan' ? 'مكية' : 'مدنية',
                    numberOfAyahs: surahData.numberOfAyahs,
                    ayahs: pageAyahs,
                    pageNum: Math.floor(i / AYAHS_PER_PAGE) + 1
                });
            }

            totalPages = pages.length;
        }

        function renderCurrentPage() {
            if (pages.length === 0) return;

            // If in tafsir mode, load tafsir instead
            if (tafsirMode) {
                loadTafsirForCurrentPage();
                return;
            }

            const page = pages[currentPageIndex];
            const content = document.getElementById('quranContent');

            let html = '<div class="page-content">';

            if (currentPageIndex === 0) {
                html += `
                    <div class="page-header">
                        <div class="surah-name">${page.surahName}</div>
                        <div class="surah-info">${page.surahEnglish} • ${page.revelationType} • ${page.numberOfAyahs} آيات</div>
                    </div>
                `;
            }

            html += '<div class="ayahs-container">';
            page.ayahs.forEach((ayah, idx) => {
                let ayahText = ayah.text;

                // Remove Bismillah from the first ayah of any surah (except Al-Fatiha and At-Tawbah)
                // Al-Fatiha (1): Bismillah is part of the surah itself
                // At-Tawbah (9): Has no Bismillah
                if (ayah.numberInSurah === 1 && currentSurah !== 1 && currentSurah !== 9) {
                    // Bismillah "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ " is 38 characters (including trailing space)
                    // Check if text starts with بسم (with or without diacritics)
                    if (ayahText.startsWith('بِسْمِ') || ayahText.startsWith('بِسم') || ayahText.startsWith('بسم')) {
                        // Find the position after الرحيم
                        const rahimIndex = ayahText.indexOf('لرَّحِيمِ');
                        if (rahimIndex !== -1) {
                            ayahText = ayahText.substring(rahimIndex + 'لرَّحِيمِ'.length).trim();
                        }
                    }
                    ayahText = ayahText.replace(/﷽\s*/g, '');
                }

                html += `<span class="ayah" data-ayah-number="${ayah.number}" id="ayah-${ayah.number}">${ayahText} <span class="ayah-number">${ayah.numberInSurah}</span>`;
                if (idx < page.ayahs.length - 1) {
                    html += ` <span class="ayah-separator">•</span> `;
                }
                html += `</span>`;
            });
            html += '</div>';

            const juz = surahToJuz[currentSurah];
            html += `<div class="page-number">الجزء ${juz} • صفحة ${page.pageNum} من ${totalPages}</div>`;
            html += '</div>';

            content.innerHTML = html;
            hideAyahQuickActions({ immediate: true });
            savePageForCurrentSurah();
            updateReaderProgressUI();
            updateScrollTopButtonVisibility();
            updateMemorizationCoachUI();

            if (window.recordHabitActivity) {
                window.recordHabitActivity('quran');
            }
            if (window.touchBookmarkVisitByLocation && currentSurah) {
                window.touchBookmarkVisitByLocation(currentSurah, currentPageIndex);
            }

            const shareModal = document.getElementById('shareAyahModal');
            if (shareModal && shareModal.classList.contains('active')) {
                populateShareAyahOptions();
                updateShareCardPreview();
            }
        }

        function nextPage() {
            if (currentPageIndex < totalPages - 1) {
                currentPageIndex++;
                renderCurrentPage();
                updateNavigation();
                resetMemorizationCoachForPage();
                scrollReaderToTop(true);
            } else if (currentSurah < 114) {
                // Auto-load next surah
                showModal({
                    type: 'info',
                    icon: '',
                    title: 'نهاية السورة',
                    message: `انتهت سورة ${surahInfo[currentSurah - 1].name}\nالانتقال إلى ${surahInfo[currentSurah].name}؟`,
                    confirmText: 'نعم',
                    cancelText: 'لا',
                    onConfirm: () => {
                        // Auto-next should start from the beginning of the next surah.
                        selectSurah(currentSurah + 1, { startFromBeginning: true });
                    }
                });
            } else {
                showModal({
                    type: 'success',
                    icon: '',
                    title: 'ختم القرآن',
                    message: 'ختمت القرآن الكريم!\nبارك الله فيك وتقبل منك'
                });
            }
        }

        function previousPage() {
            if (currentPageIndex > 0) {
                currentPageIndex--;
                renderCurrentPage();
                updateNavigation();
                resetMemorizationCoachForPage();
                scrollReaderToTop(true);
            }
        }

        function updateNavigation() {
            const prevBtn = document.getElementById('prevPageBtn');
            const nextBtn = document.getElementById('nextPageBtn');
            if (prevBtn) prevBtn.disabled = currentPageIndex === 0;
            if (nextBtn) nextBtn.disabled = false;
            updateBookmarkButton();
            updateReaderProgressUI();
        }

        function getStoredBookmarks() {
            if (window.loadBookmarkLibrary) {
                return window.loadBookmarkLibrary();
            }
            return JSON.parse(localStorage.getItem('quranBookmarks') || '[]');
        }

        function saveStoredBookmarks(bookmarks) {
            if (window.saveBookmarkLibrary) {
                return window.saveBookmarkLibrary(bookmarks);
            }
            localStorage.setItem('quranBookmarks', JSON.stringify(bookmarks));
            return bookmarks;
        }

        function getAvailableBookmarkFolders(bookmarks = []) {
            const fromLibrary = Array.isArray(bookmarks) ? bookmarks : getStoredBookmarks();
            const fromBookmarks = fromLibrary
                .map(bookmark => String(bookmark?.folder || '').trim())
                .filter(Boolean);

            const fromHelper = window.getBookmarkFolders
                ? window.getBookmarkFolders()
                : [];

            return Array.from(new Set([
                'عام',
                ...fromHelper,
                ...fromBookmarks
            ].filter(Boolean)));
        }

        function getPreferredBookmarkFolder(folders) {
            const options = Array.isArray(folders) ? folders : [];
            const fallback = options.includes('عام') ? 'عام' : (options[0] || 'عام');

            try {
                const saved = String(localStorage.getItem(LAST_BOOKMARK_FOLDER_KEY) || '').trim();
                if (saved && options.includes(saved)) {
                    return saved;
                }
            } catch (_error) {
                // Ignore localStorage read issues.
            }

            return fallback;
        }

        function setPreferredBookmarkFolder(folderName) {
            const folder = String(folderName || '').trim() || 'عام';
            try {
                localStorage.setItem(LAST_BOOKMARK_FOLDER_KEY, folder);
            } catch (_error) {
                // Ignore localStorage write issues.
            }
        }

        function addBookmarkFolderIfNeeded(folderName) {
            const folder = String(folderName || '').trim();
            if (!folder) return;

            if (window.addBookmarkFolder) {
                window.addBookmarkFolder(folder);
                return;
            }

            try {
                const key = (window.APP_STORAGE_KEYS && window.APP_STORAGE_KEYS.bookmarkFolders) || 'quranBookmarkFoldersV1';
                const existing = JSON.parse(localStorage.getItem(key) || '[]');
                const next = Array.from(new Set([...(Array.isArray(existing) ? existing : []), folder]));
                localStorage.setItem(key, JSON.stringify(next));
            } catch (_error) {
                // Ignore folder persistence issues.
            }
        }

        function openBookmarkFolderPicker(onSave) {
            const folders = getAvailableBookmarkFolders();
            const preferredFolder = getPreferredBookmarkFolder(folders);
            const optionsHtml = folders.map(folder => `
                <option value="${escapeHtml(folder)}" ${folder === preferredFolder ? 'selected' : ''}>${escapeHtml(folder)}</option>
            `).join('');

            showModal({
                type: 'info',
                icon: '<i class="bi bi-folder-plus"></i>',
                title: 'حفظ الموضع في مجلد',
                message: `
                    <div class="bookmark-save-modal">
                        <label class="bookmark-save-label" for="bookmarkFolderSelect">اختر مجلداً</label>
                        <select id="bookmarkFolderSelect" class="bookmark-save-select">${optionsHtml}</select>
                        <label class="bookmark-save-label" for="bookmarkNewFolderInput">أو أنشئ مجلداً جديداً</label>
                        <input id="bookmarkNewFolderInput" class="bookmark-save-input" type="text" placeholder="مثال: مراجعة اليوم">
                    </div>
                `,
                confirmText: 'حفظ',
                cancelText: 'إلغاء',
                onConfirm: () => {
                    const selectedFolder = String(document.getElementById('bookmarkFolderSelect')?.value || '').trim();
                    const newFolder = String(document.getElementById('bookmarkNewFolderInput')?.value || '').trim();
                    const finalFolder = newFolder || selectedFolder || 'عام';

                    addBookmarkFolderIfNeeded(finalFolder);
                    setPreferredBookmarkFolder(finalFolder);

                    if (typeof onSave === 'function') {
                        onSave(finalFolder);
                    }
                }
            });
        }

        function toggleBookmark() {
            const bookmarks = getStoredBookmarks();

            // Check if this exact bookmark already exists
            const existingBookmarks = bookmarks.filter(b => b.surah === currentSurah && b.page === currentPageIndex);

            if (existingBookmarks.length > 0) {
                // Remove existing bookmark
                if (window.deleteBookmarkById) {
                    existingBookmarks.forEach(bookmark => {
                        if (bookmark && bookmark.id) {
                            window.deleteBookmarkById(bookmark.id);
                        }
                    });
                } else {
                    const remaining = bookmarks.filter(bookmark =>
                        !(bookmark.surah === currentSurah && bookmark.page === currentPageIndex)
                    );
                    saveStoredBookmarks(remaining);
                }
                showModal({
                    type: 'info',
                    icon: '<i class="bi bi-info-circle-fill"></i>',
                    title: 'تم الإلغاء',
                    message: 'تم إلغاء حفظ الموضع'
                });
                updateBookmarkButton();
            } else {
                openBookmarkFolderPicker((folderName) => {
                    const latestBookmarks = getStoredBookmarks();
                    const alreadySaved = latestBookmarks.some(bookmark =>
                        bookmark.surah === currentSurah && bookmark.page === currentPageIndex
                    );

                    if (alreadySaved) {
                        showModal({
                            type: 'info',
                            icon: '<i class="bi bi-info-circle-fill"></i>',
                            title: 'الموضع محفوظ بالفعل',
                            message: 'هذا الموضع محفوظ مسبقاً.'
                        });
                        updateBookmarkButton();
                        return;
                    }

                    const newBookmark = window.createBookmarkEntry
                        ? window.createBookmarkEntry({ surah: currentSurah, page: currentPageIndex, folder: folderName })
                        : {
                            surah: currentSurah,
                            page: currentPageIndex,
                            folder: folderName,
                            timestamp: Date.now()
                        };

                    latestBookmarks.push(newBookmark);
                    saveStoredBookmarks(latestBookmarks);
                    showModal({
                        type: 'success',
                        icon: '<i class="bi bi-check-circle-fill"></i>',
                        title: 'تم الحفظ',
                        message: `تم حفظ موضع القراءة في مجلد ${escapeHtml(folderName)}.`
                    });
                    updateBookmarkButton();
                });
            }
        }

        function checkBookmark() {
            // No modal needed - bookmarks handled separately
        }

        function updateBookmarkButton() {
            if (!currentSurah) return;

            const bookmarks = getStoredBookmarks();
            const btn = document.getElementById('headerBookmarkBtn');

            if (!btn) return; // Guard against null element

            const isBookmarked = bookmarks.some(b => b.surah === currentSurah && b.page === currentPageIndex);

            if (isBookmarked) {
                btn.classList.add('saved');
                btn.querySelector('i').className = 'bi bi-bookmark-fill';
            } else {
                btn.classList.remove('saved');
                btn.querySelector('i').className = 'bi bi-bookmark';
            }
        }

        function showBookmarksSection() {
            showSurahList();
            toggleSidebar();
            setTimeout(() => {
                const bookmarksSection = document.getElementById('bookmarksSection');
                if (bookmarksSection) {
                    bookmarksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }

        function renderBookmarks() {
            const bookmarks = getStoredBookmarks();
            const bookmarksSection = document.getElementById('bookmarksSection');
            const bookmarksList = document.getElementById('bookmarksList');

            // Bookmarks section removed from this page
            if (!bookmarksSection || !bookmarksList) return;

            if (bookmarks.length === 0) {
                bookmarksSection.style.display = 'none';
                return;
            }

            bookmarksSection.style.display = 'block';
            bookmarksList.innerHTML = bookmarks.map((bookmark, index) => `
                <div class="bookmark-item" onclick="loadBookmark(` + index + `)">
                    <div class="bookmark-info">
                        <div class="bookmark-name">` + surahInfo[bookmark.surah - 1].name + `</div>
                        <div class="bookmark-details">صفحة ` + (bookmark.page + 1) + `</div>
                    </div>
                    <div class="bookmark-actions">
                        <button class="bookmark-delete-btn" onclick="event.stopPropagation(); deleteBookmark(` + index + `)"></button>
                    </div>
                </div>
            `).join('');
        }

        function loadBookmark(index) {
            const bookmarks = getStoredBookmarks();
            if (!bookmarks[index]) return;

            const bookmark = bookmarks[index];
            if (window.touchBookmarkVisitById && bookmark.id) {
                window.touchBookmarkVisitById(bookmark.id);
            }
            selectSurah(bookmark.surah);
            setTimeout(() => {
                currentPageIndex = bookmark.page;
                renderCurrentPage();
                updateNavigation();
            }, 100);
        }

        function deleteBookmark(index) {
            const bookmarks = getStoredBookmarks();
            const bookmark = bookmarks[index];
            if (!bookmark) return;

            if (window.deleteBookmarkById && bookmark.id) {
                window.deleteBookmarkById(bookmark.id);
            } else {
                bookmarks.splice(index, 1);
                saveStoredBookmarks(bookmarks);
            }
            showModal({
                type: 'success',
                icon: '',
                title: 'تم الحذف',
                message: 'تم حذف الموضع المحفوظ'
            });
        }

        function loadBookmarkOnStart() {
            const bookmarks = getStoredBookmarks();
            if (bookmarks.length > 0) {
                const lastBookmark = bookmarks[bookmarks.length - 1];
                selectSurah(lastBookmark.surah);
                setTimeout(() => {
                    currentPageIndex = lastBookmark.page;
                    renderCurrentPage();
                    updateNavigation();
                }, 100);
            }
        }

        renderSurahList();
        initReaderFontLevel();
        updateMemorizationCoachUI();
        initAyahQuickActions();

        // Check if loading from bookmark with URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const surahParam = urlParams.get('surah');
        const pageParam = urlParams.get('page');
        const ayahParam = urlParams.get('ayah');
        const bookmarkIdParam = urlParams.get('bookmark');

        if (bookmarkIdParam && window.touchBookmarkVisitById) {
            window.touchBookmarkVisitById(bookmarkIdParam);
        }

        if (surahParam && ayahParam) {
            const surahNumber = parseInt(surahParam, 10);
            const ayahNumberInSurah = parseInt(ayahParam, 10);

            if (!Number.isNaN(surahNumber) && !Number.isNaN(ayahNumberInSurah)) {
                const targetPageIndex = Math.floor((ayahNumberInSurah - 1) / AYAHS_PER_PAGE);
                openSurahAtPage(surahNumber, targetPageIndex, ayahNumberInSurah);
            }
        } else if (surahParam && pageParam) {
            const surahNumber = parseInt(surahParam, 10);
            const pageNumber = parseInt(pageParam, 10);

            if (!Number.isNaN(surahNumber) && !Number.isNaN(pageNumber)) {
                openSurahAtPage(surahNumber, pageNumber);
            }
        }
        // If no URL params, stay on surah list (don't auto-load bookmark)

        // Load theme settings
        function loadThemeSettings() {
            const darkMode = localStorage.getItem('darkMode') === 'true';
            if (darkMode) {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }

            const color = localStorage.getItem('primaryColor');
            if (color) {
                const lightColor = adjustColor(color, 30);
                document.documentElement.style.setProperty('--primary-color', color);
                document.documentElement.style.setProperty('--primary-light', lightColor);

                // Update shadow colors
                const rgb = hexToRgb(color);
                const shadowLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.25 : 0.15})`;
                const shadowHeavy = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.45 : 0.35})`;
                document.documentElement.style.setProperty('--shadow', shadowLight);
                document.documentElement.style.setProperty('--shadow-heavy', shadowHeavy);
            } else if (darkMode) {
                // Apply default dark mode shadow colors
                const rgb = hexToRgb('#4CAF50');
                const shadowLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`;
                const shadowHeavy = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`;
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


            const fontWeight = localStorage.getItem('fontWeight');
            if (fontWeight) {
                const fontWeights = [300, 400, 500, 600, 700];
                const weight = fontWeights[parseInt(fontWeight)];
                document.documentElement.style.setProperty('--font-weight', weight);
            }
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

        // Load theme immediately on page load
        (function () {
            loadThemeSettings();
        })();

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(reg => console.log('SW registered'))
                .catch(err => console.error('SW registration failed', err));
        }

        const contentArea = document.getElementById('quranContent');
        if (contentArea) {
            contentArea.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
                touchStartY = e.changedTouches[0].screenY;
            }, { passive: true });

            contentArea.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                touchEndY = e.changedTouches[0].screenY;
                handleSwipe();
            }, { passive: true });
        }

        function handleSwipe() {
            if (!isReaderViewActive()) return;
            if (document.querySelector('.modal-overlay.active')) return;

            const swipeDistance = touchEndX - touchStartX;
            const verticalDistance = touchEndY - touchStartY;
            const absSwipeDistance = Math.abs(swipeDistance);
            const absVerticalDistance = Math.abs(verticalDistance);

            if (absSwipeDistance < minSwipeDistance) return;
            if (absVerticalDistance > maxVerticalSwipeDistance || absVerticalDistance > absSwipeDistance * 0.75) {
                return;
            }

            if (swipeDistance > 0) {
                // RTL behavior: swipe right advances to the next page.
                const nextBtn = document.getElementById('nextPageBtn');
                if (nextBtn && !nextBtn.disabled) {
                    nextPage();
                }
            } else {
                // RTL behavior: swipe left returns to the previous page.
                const prevBtn = document.getElementById('prevPageBtn');
                if (prevBtn && !prevBtn.disabled) {
                    previousPage();
                }
            }
        }

        document.addEventListener('keydown', (event) => {
            if (!isReaderViewActive()) return;
            if (document.querySelector('.modal-overlay.active')) return;

            const targetTag = event.target?.tagName;
            if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                nextPage();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                previousPage();
            } else if (event.key === 'Home') {
                event.preventDefault();
                scrollReaderToTop();
            }
        });

        window.addEventListener('scroll', updateScrollTopButtonVisibility, { passive: true });
        updateScrollTopButtonVisibility();

        // Audio player functions
        function toggleAudio() {
            const playBtn = document.getElementById('playPauseBtn');
            if (!playBtn) return;

            if (isPlaying) {
                pauseAudio();
            } else {
                playAudio();
            }
        }

        function playAudio() {
            if (!currentSurah) return;
            stopMemorizationAyahAudio();

            // Initialize ayahs array if empty
            if (allAyahs.length === 0) {
                pages.forEach(page => {
                    page.ayahs.forEach(ayah => {
                        allAyahs.push(ayah);
                    });
                });
            }

            if (allAyahs.length === 0) return;

            // Play current ayah
            playCurrentAyah();
            isPlaying = true;
            updatePlayButton();
        }

        function playCurrentAyah() {
            if (currentAyahIndex >= allAyahs.length) {
                // Finished playing all ayahs
                currentAyahIndex = 0;
                isPlaying = false;
                removeAyahHighlight();
                updatePlayButton();
                updateCurrentAyahDisplay();
                return;
            }

            const ayah = allAyahs[currentAyahIndex];
            const audioUrl = `https://cdn.alquran.cloud/media/audio/ayah/${currentReciter}/${ayah.number}`;

            // Highlight current ayah
            highlightAyah(ayah.number);

            // Stop previous audio if exists
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }

            currentAudio = new Audio(audioUrl);

            currentAudio.addEventListener('ended', () => {
                currentAyahIndex++;
                savePlaybackPosition();
                if (isPlaying) {
                    playCurrentAyah();
                }
            });

            currentAudio.addEventListener('error', () => {
                console.error('Error loading audio for ayah', ayah.numberInSurah);
                currentAyahIndex++;
                savePlaybackPosition();
                if (isPlaying) {
                    playCurrentAyah();
                }
            });

            currentAudio.play();
            updateCurrentAyahDisplay();
            updateAudioProgress();
            savePlaybackPosition();
        }

        function highlightAyah(ayahNumber) {
            // Remove previous highlight
            removeAyahHighlight();

            // Add highlight to current ayah
            const ayahElement = document.getElementById(`ayah-${ayahNumber}`);
            if (ayahElement) {
                ayahElement.classList.add('playing');
                // Scroll to ayah if not in view
                ayahElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function removeAyahHighlight() {
            const highlighted = document.querySelector('.ayah.playing');
            if (highlighted) {
                highlighted.classList.remove('playing');
            }
        }

        function pauseAudio() {
            if (currentAudio) {
                currentAudio.pause();
            }
            isPlaying = false;
            removeAyahHighlight();
            updatePlayButton();
        }

        function updateCurrentAyahDisplay() {
            const ayahNumElement = document.getElementById('currentAyahNum');
            const surahNameElement = document.getElementById('currentSurahName');

            if (ayahNumElement && allAyahs.length > 0 && currentAyahIndex < allAyahs.length) {
                const ayah = allAyahs[currentAyahIndex];
                ayahNumElement.textContent = `الآية ${ayah.numberInSurah}`;

                // Update surah name in player
                if (surahNameElement && pages.length > 0) {
                    surahNameElement.textContent = pages[0].surahName;
                }
            } else if (ayahNumElement) {
                ayahNumElement.textContent = `الآية 1`;
            }
        }

        function updatePlayButton() {
            const playBtn = document.getElementById('playPauseBtn');
            if (!playBtn) return;

            const icon = playBtn.querySelector('i');
            if (icon) {
                icon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
            }
        }

        function seekAudio(event) {
            if (allAyahs.length === 0) return;

            const progressBar = event.currentTarget;
            const rect = progressBar.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const width = rect.width;
            // For RTL: right side is beginning (0%), left side is end (100%)
            const percentage = Math.max(0, Math.min(1, 1 - (clickX / width)));

            // Calculate target ayah index based on percentage
            const targetIndex = Math.floor(percentage * allAyahs.length);

            if (targetIndex >= 0 && targetIndex < allAyahs.length) {
                currentAyahIndex = targetIndex;

                // Find which page contains this ayah
                const targetAyah = allAyahs[targetIndex];
                let targetPage = 0;

                for (let i = 0; i < pages.length; i++) {
                    const pageAyahs = pages[i].ayahs;
                    const found = pageAyahs.some(ayah => ayah.number === targetAyah.number);
                    if (found) {
                        targetPage = i;
                        break;
                    }
                }

                // Navigate to the page if different
                if (targetPage !== currentPageIndex) {
                    currentPageIndex = targetPage;
                    renderCurrentPage();
                    updateNavigation();
                }

                // Update display and highlight
                updateCurrentAyahDisplay();
                updateAudioProgress();
                savePlaybackPosition();

                // If playing, start playing from new position
                if (isPlaying) {
                    playCurrentAyah();
                } else {
                    // Just highlight the ayah
                    highlightAyah(targetAyah.number);
                }

                // Show feedback message
                const ayahNum = targetAyah.numberInSurah;
                const pageNum = targetPage + 1;
                showTemporaryMessage(`الآية ${ayahNum} • صفحة ${pageNum}`);
            }
        }

        function showTemporaryMessage(text) {
            // Remove existing message if any
            const existing = document.querySelector('.seek-message');
            if (existing) existing.remove();

            // Create message element
            const message = document.createElement('div');
            message.className = 'seek-message';
            message.textContent = text;
            message.style.cssText = `
                                position: fixed;
                                top: 50%;
                                left: 50%;
                                transform: translate(-50%, -50%);
                                background: var(--primary-color);
                                color: white;
                                padding: 12px 24px;
                                border-radius: 8px;
                                font-size: 16px;
                                font-weight: 600;
                                z-index: 10000;
                                box-shadow: 0 4px 12px var(--shadow-heavy);
                                animation: fadeInOut 1.5s ease;
                            `;

            document.body.appendChild(message);

            // Remove after animation
            setTimeout(() => message.remove(), 1500);
        }

        function updateAudioProgress() {
            if (!currentAudio || allAyahs.length === 0) return;

            const progress = (currentAyahIndex / allAyahs.length) * 100;
            const progressBar = document.getElementById('audioProgressBar');
            if (progressBar) {
                progressBar.style.width = progress + '%';
            }
        }

        function savePlaybackPosition() {
            if (currentSurah && currentAyahIndex >= 0) {
                localStorage.setItem('lastPlaybackPosition', JSON.stringify({
                    surah: currentSurah,
                    ayahIndex: currentAyahIndex,
                    timestamp: Date.now()
                }));
            }
        }

        function loadPlaybackPosition() {
            const saved = localStorage.getItem('lastPlaybackPosition');
            if (saved) {
                const data = JSON.parse(saved);
                // Only restore if same surah and recent (within 24 hours)
                if (data.surah === currentSurah && (Date.now() - data.timestamp) < 86400000) {
                    currentAyahIndex = data.ayahIndex;
                    updateCurrentAyahDisplay();
                    updateAudioProgress();
                }
            }
        }

        function getCurrentPageAyahs() {
            if (!pages.length || currentPageIndex >= pages.length) return [];
            return pages[currentPageIndex].ayahs || [];
        }

        function getAyahByGlobalNumberOnCurrentPage(globalAyahNumber) {
            const targetNumber = parseInt(globalAyahNumber, 10);
            if (Number.isNaN(targetNumber)) return null;
            return getCurrentPageAyahs().find(ayah => ayah.number === targetNumber) || null;
        }

        function stopMemorizationAyahAudio(skipUiUpdate = false) {
            if (memorizationAudio) {
                memorizationAudio.pause();
                memorizationAudio.currentTime = 0;
                memorizationAudio.src = '';
                memorizationAudio = null;
            }

            memorizationAudioAyahNumber = null;
            memorizationAudioLoading = false;
            memorizationAudioSource = '';

            if (!isPlaying) {
                removeAyahHighlight();
            }

            if (!skipUiUpdate) {
                updateMemorizationCoachUI();
                updateAyahQuickActionsUI();
            }
        }

        function playAyahWithCurrentReciter(ayah, source = 'memorization') {
            if (!ayah || !ayah.number) return;

            const isSameAyahBusy = memorizationAudioAyahNumber === ayah.number &&
                (memorizationAudioLoading || (memorizationAudio && !memorizationAudio.paused));
            if (isSameAyahBusy) {
                stopMemorizationAyahAudio();
                return;
            }

            if (isPlaying) {
                pauseAudio();
            }

            stopMemorizationAyahAudio(true);

            memorizationAudioAyahNumber = ayah.number;
            memorizationAudioLoading = true;
            memorizationAudioSource = source;
            updateMemorizationCoachUI();
            updateAyahQuickActionsUI();

            const audio = new Audio(`https://cdn.alquran.cloud/media/audio/ayah/${currentReciter}/${ayah.number}`);
            memorizationAudio = audio;

            audio.addEventListener('ended', () => {
                if (memorizationAudio !== audio) return;

                if (
                    memorizationAudioSource === 'memorization' &&
                    memorizationRepeatEnabled &&
                    memorizationMode
                ) {
                    audio.currentTime = 0;
                    audio.play().catch(() => {
                        stopMemorizationAyahAudio();
                    });
                    return;
                }

                stopMemorizationAyahAudio();
            });

            audio.addEventListener('error', () => {
                if (memorizationAudio !== audio) return;
                stopMemorizationAyahAudio();
                showTemporaryMessage('تعذر تشغيل التلاوة الآن');
            });

            audio.play()
                .then(() => {
                    if (memorizationAudio !== audio) return;
                    memorizationAudioLoading = false;
                    highlightAyah(ayah.number);
                    updateMemorizationCoachUI();
                    updateAyahQuickActionsUI();
                })
                .catch(() => {
                    if (memorizationAudio !== audio) return;
                    stopMemorizationAyahAudio();
                    showTemporaryMessage('تعذر تشغيل التلاوة الآن');
                });
        }

        function updateAyahQuickActionsUI() {
            const listenBtn = document.getElementById('ayahQuickListenBtn');
            if (!listenBtn) return;

            const targetAyah = getAyahByGlobalNumberOnCurrentPage(ayahQuickActionAyahNumber);
            const isTargetPlaying = Boolean(
                targetAyah && memorizationAudio && !memorizationAudio.paused && memorizationAudioAyahNumber === targetAyah.number
            );
            const isTargetLoading = Boolean(
                targetAyah && memorizationAudioLoading && memorizationAudioAyahNumber === targetAyah.number
            );

            listenBtn.disabled = !targetAyah;
            listenBtn.classList.toggle('active', isTargetPlaying || isTargetLoading);

            if (isTargetLoading) {
                listenBtn.innerHTML = '<i class="bi bi-hourglass-split"></i><span>جار التحميل</span>';
            } else if (isTargetPlaying) {
                listenBtn.innerHTML = '<i class="bi bi-stop-fill"></i><span>إيقاف</span>';
            } else {
                listenBtn.innerHTML = '<i class="bi bi-volume-up"></i><span>استماع</span>';
            }
        }

        function toggleMemorizationAyahAudio() {
            if (!memorizationMode) return;
            const ayah = getCurrentMemorizationAyah();
            if (!ayah) return;

            playAyahWithCurrentReciter(ayah, 'memorization');
        }

        function toggleMemorizationRepeat() {
            if (!memorizationMode) return;
            memorizationRepeatEnabled = !memorizationRepeatEnabled;
            updateMemorizationCoachUI();
            showTemporaryMessage(memorizationRepeatEnabled ? 'تم تفعيل تكرار الآية' : 'تم إيقاف تكرار الآية');
        }

        function positionAyahQuickActions(targetElement = ayahQuickActionTargetElement) {
            const quickActions = document.getElementById('ayahQuickActions');
            if (!quickActions || !targetElement) return;

            const ayahRect = targetElement.getBoundingClientRect();
            const menuRect = quickActions.getBoundingClientRect();

            const menuWidth = menuRect.width || 190;
            const menuHeight = menuRect.height || 46;
            const edgePadding = 12;
            const halfWidth = menuWidth / 2;

            let left = ayahRect.left + (ayahRect.width / 2);
            left = Math.max(edgePadding + halfWidth, Math.min(window.innerWidth - edgePadding - halfWidth, left));

            let top = ayahRect.top - menuHeight - 10;
            if (top < 70) {
                top = ayahRect.bottom + 10;
            }
            top = Math.max(70, Math.min(window.innerHeight - menuHeight - 10, top));

            quickActions.style.left = `${left}px`;
            quickActions.style.top = `${top}px`;
        }

        function showAyahQuickActionsForElement(ayahElement) {
            if (!ayahElement || tafsirMode || !isReaderViewActive()) return;

            const ayahNumber = parseInt(ayahElement.getAttribute('data-ayah-number'), 10);
            if (Number.isNaN(ayahNumber)) return;

            clearTimeout(ayahQuickActionHideTimer);

            if (ayahQuickActionTargetElement && ayahQuickActionTargetElement !== ayahElement) {
                ayahQuickActionTargetElement.classList.remove('quick-actions-target');
            }

            ayahQuickActionTargetElement = ayahElement;
            ayahQuickActionTargetElement.classList.add('quick-actions-target');
            ayahQuickActionAyahNumber = ayahNumber;

            const quickActions = document.getElementById('ayahQuickActions');
            if (!quickActions) return;

            quickActions.classList.add('active');
            quickActions.setAttribute('aria-hidden', 'false');

            updateAyahQuickActionsUI();
            requestAnimationFrame(() => {
                positionAyahQuickActions(ayahElement);
            });
        }

        function hideAyahQuickActions(options = {}) {
            const quickActions = document.getElementById('ayahQuickActions');
            const immediate = Boolean(options.immediate);
            if (!quickActions) return;

            clearTimeout(ayahQuickActionHideTimer);

            const hideNow = () => {
                quickActions.classList.remove('active');
                quickActions.setAttribute('aria-hidden', 'true');

                if (ayahQuickActionTargetElement) {
                    ayahQuickActionTargetElement.classList.remove('quick-actions-target');
                }

                ayahQuickActionTargetElement = null;
                ayahQuickActionAyahNumber = null;
                updateAyahQuickActionsUI();
            };

            if (immediate) {
                hideNow();
                return;
            }

            ayahQuickActionHideTimer = setTimeout(hideNow, 220);
        }

        function scheduleHideAyahQuickActions() {
            hideAyahQuickActions({ immediate: false });
        }

        function listenHoveredAyah() {
            const ayah = getAyahByGlobalNumberOnCurrentPage(ayahQuickActionAyahNumber);
            if (!ayah) return;
            playAyahWithCurrentReciter(ayah, 'quick');
        }

        async function openHoveredAyahTafsir() {
            const ayah = getAyahByGlobalNumberOnCurrentPage(ayahQuickActionAyahNumber);
            if (!ayah || !currentSurah) return;

            hideAyahQuickActions({ immediate: true });

            const surahName = surahInfo[currentSurah - 1]?.name || '';
            showModal({
                type: 'info',
                icon: '',
                title: `سورة ${surahName} • آية ${ayah.numberInSurah}`,
                message: 'جار تحميل التفسير...'
            });

            try {
                let tafsirText = ayahQuickTafsirCache.get(ayah.number);

                if (!tafsirText) {
                    const response = await fetch(`https://api.alquran.cloud/v1/ayah/${ayah.number}/ar.muyassar`);
                    if (!response.ok) {
                        throw new Error('تعذر تحميل التفسير');
                    }

                    const data = await response.json();
                    if (data.code !== 200 || !data.data?.text) {
                        throw new Error('تعذر قراءة نص التفسير');
                    }

                    tafsirText = data.data.text;
                    ayahQuickTafsirCache.set(ayah.number, tafsirText);
                }

                const safeAyahText = escapeHtml(ayah.text);
                const safeTafsirText = escapeHtml(tafsirText).replace(/\n/g, '<br>');

                showModal({
                    type: 'info',
                    icon: '',
                    title: `سورة ${surahName} • آية ${ayah.numberInSurah}`,
                    message: `<div class="quick-tafsir-ayah">${safeAyahText}</div><div class="quick-tafsir-text">${safeTafsirText}</div>`
                });
            } catch (_error) {
                showModal({
                    type: 'error',
                    icon: '',
                    title: 'تعذر تحميل التفسير',
                    message: 'حدث خطأ أثناء تحميل التفسير. حاول مرة أخرى بعد قليل.'
                });
            }
        }

        function initAyahQuickActions() {
            const content = document.getElementById('quranContent');
            const quickActions = document.getElementById('ayahQuickActions');
            if (!content || !quickActions || content.dataset.quickActionsReady === '1') return;

            content.dataset.quickActionsReady = '1';

            content.addEventListener('mouseover', (event) => {
                if (tafsirMode || !isReaderViewActive()) return;

                const ayahElement = event.target.closest('.ayah[data-ayah-number]');
                if (!ayahElement || !content.contains(ayahElement)) return;

                showAyahQuickActionsForElement(ayahElement);
            });

            content.addEventListener('mouseout', (event) => {
                const ayahElement = event.target.closest('.ayah[data-ayah-number]');
                if (!ayahElement) return;

                const related = event.relatedTarget;
                if (related && (ayahElement.contains(related) || quickActions.contains(related))) {
                    return;
                }

                scheduleHideAyahQuickActions();
            });

            content.addEventListener('click', (event) => {
                if (tafsirMode || !isReaderViewActive()) return;

                const ayahElement = event.target.closest('.ayah[data-ayah-number]');
                if (!ayahElement || !content.contains(ayahElement)) return;

                showAyahQuickActionsForElement(ayahElement);
            });

            quickActions.addEventListener('mouseenter', () => {
                clearTimeout(ayahQuickActionHideTimer);
            });

            quickActions.addEventListener('mouseleave', () => {
                scheduleHideAyahQuickActions();
            });

            document.addEventListener('click', (event) => {
                if (!quickActions.classList.contains('active')) return;
                if (quickActions.contains(event.target)) return;
                if (event.target.closest('.ayah[data-ayah-number]')) return;
                hideAyahQuickActions({ immediate: true });
            });

            window.addEventListener('resize', () => {
                if (!quickActions.classList.contains('active')) return;
                positionAyahQuickActions();
            });

            window.addEventListener('scroll', () => {
                if (!quickActions.classList.contains('active')) return;
                positionAyahQuickActions();
            }, { passive: true });

            updateAyahQuickActionsUI();
        }

        function saveMemorizationProgressMap() {
            localStorage.setItem(MEMORIZATION_PROGRESS_KEY, JSON.stringify(memorizedAyahsByNumber));
        }

        function getCurrentMemorizationAyah() {
            const pageAyahs = getCurrentPageAyahs();
            if (!pageAyahs.length) return null;

            const safeIndex = Math.max(0, Math.min(memorizationAyahIndex, pageAyahs.length - 1));
            memorizationAyahIndex = safeIndex;
            return pageAyahs[safeIndex];
        }

        function getMemorizationAyahRangeLabel(ayah) {
            const surahName = surahInfo[currentSurah - 1]?.name || '';
            return `سورة ${surahName} • آية ${ayah.numberInSurah}`;
        }

        function updateMemorizationCoachUI() {
            const coach = document.getElementById('memorizationCoach');
            const coachBtn = document.getElementById('memorizationBtn');
            const ayahCard = document.getElementById('memorizationAyahCard');
            const ayahText = document.getElementById('memorizationAyahText');
            const ayahRef = document.getElementById('memorizationAyahRef');
            const progressText = document.getElementById('memorizationProgressText');
            const progressFill = document.getElementById('memorizationProgressFill');
            const playBtn = document.getElementById('memorizationPlayBtn');
            const repeatBtn = document.getElementById('memorizationRepeatBtn');
            const revealBtn = document.getElementById('memorizationRevealBtn');
            const doneBtn = document.getElementById('memorizationDoneBtn');

            if (!coach || !coachBtn || !ayahCard || !ayahText || !ayahRef || !progressText || !progressFill || !playBtn || !repeatBtn || !revealBtn || !doneBtn) {
                return;
            }

            coach.style.display = memorizationMode ? 'block' : 'none';
            coachBtn.classList.toggle('active', memorizationMode);
            document.body.classList.toggle('memorization-coach-active', memorizationMode);

            if (!memorizationMode) {
                playBtn.disabled = true;
                repeatBtn.disabled = true;
                playBtn.classList.remove('active');
                repeatBtn.classList.remove('active');
                playBtn.innerHTML = '<i class="bi bi-volume-up"></i><span>استماع</span>';
                repeatBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>تكرار</span>';
                return;
            }

            const pageAyahs = getCurrentPageAyahs();
            if (!pageAyahs.length || !currentSurah) {
                ayahText.textContent = 'افتح أي سورة ثم فعّل مدرب الحفظ';
                ayahRef.textContent = '';
                progressText.textContent = '0 / 0';
                progressFill.style.width = '0%';
                ayahCard.classList.remove('hidden');
                playBtn.disabled = true;
                repeatBtn.disabled = true;
                playBtn.classList.remove('active');
                repeatBtn.classList.remove('active');
                playBtn.innerHTML = '<i class="bi bi-volume-up"></i><span>استماع</span>';
                repeatBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>تكرار</span>';
                return;
            }

            const ayah = getCurrentMemorizationAyah();
            if (!ayah) return;

            ayahText.textContent = ayah.text;
            ayahRef.textContent = getMemorizationAyahRangeLabel(ayah);

            const currentStep = memorizationAyahIndex + 1;
            const totalSteps = pageAyahs.length;
            progressText.textContent = `${currentStep} / ${totalSteps}`;
            progressFill.style.width = `${Math.round((currentStep / totalSteps) * 100)}%`;

            ayahCard.classList.toggle('hidden', !memorizationReveal);
            revealBtn.innerHTML = memorizationReveal
                ? '<i class="bi bi-eye-slash"></i><span>إخفاء</span>'
                : '<i class="bi bi-eye"></i><span>إظهار</span>';

            const ayahKey = String(ayah.number);
            const isMemorized = Boolean(memorizedAyahsByNumber[ayahKey]);
            doneBtn.classList.toggle('done', isMemorized);
            doneBtn.innerHTML = isMemorized
                ? '<i class="bi bi-patch-check-fill"></i><span>محفوظة</span>'
                : '<i class="bi bi-check2-circle"></i><span>تم الحفظ</span>';

            const isPlayingCurrentAyah = Boolean(
                memorizationAudio && !memorizationAudio.paused && memorizationAudioAyahNumber === ayah.number
            );
            const isLoadingCurrentAyah = Boolean(
                memorizationAudioLoading && memorizationAudioAyahNumber === ayah.number
            );

            playBtn.disabled = false;
            repeatBtn.disabled = false;

            playBtn.classList.toggle('active', isPlayingCurrentAyah || isLoadingCurrentAyah);
            repeatBtn.classList.toggle('active', memorizationRepeatEnabled);

            if (isLoadingCurrentAyah) {
                playBtn.innerHTML = '<i class="bi bi-hourglass-split"></i><span>جار التحميل</span>';
            } else if (isPlayingCurrentAyah) {
                playBtn.innerHTML = '<i class="bi bi-stop-fill"></i><span>إيقاف</span>';
            } else {
                playBtn.innerHTML = '<i class="bi bi-volume-up"></i><span>استماع</span>';
            }

            repeatBtn.innerHTML = memorizationRepeatEnabled
                ? '<i class="bi bi-arrow-repeat"></i><span>تكرار شغال</span>'
                : '<i class="bi bi-arrow-repeat"></i><span>تكرار</span>';

            updateAyahQuickActionsUI();
        }

        function toggleMemorizationCoach() {
            memorizationMode = !memorizationMode;
            if (memorizationMode) {
                memorizationReveal = true;
                memorizationAyahIndex = 0;
            } else {
                stopMemorizationAyahAudio(true);
            }
            updateMemorizationCoachUI();
        }

        function toggleMemorizationReveal() {
            if (!memorizationMode) return;
            memorizationReveal = !memorizationReveal;
            updateMemorizationCoachUI();
        }

        function nextMemorizationAyah() {
            if (!memorizationMode) return;
            const pageAyahs = getCurrentPageAyahs();
            if (!pageAyahs.length) return;

            stopMemorizationAyahAudio(true);
            memorizationAyahIndex = Math.min(pageAyahs.length - 1, memorizationAyahIndex + 1);
            memorizationReveal = true;
            updateMemorizationCoachUI();
        }

        function previousMemorizationAyah() {
            if (!memorizationMode) return;
            stopMemorizationAyahAudio(true);
            memorizationAyahIndex = Math.max(0, memorizationAyahIndex - 1);
            memorizationReveal = true;
            updateMemorizationCoachUI();
        }

        function toggleCurrentAyahMemorized() {
            if (!memorizationMode) return;

            const ayah = getCurrentMemorizationAyah();
            if (!ayah) return;

            const ayahKey = String(ayah.number);
            if (memorizedAyahsByNumber[ayahKey]) {
                delete memorizedAyahsByNumber[ayahKey];
                showTemporaryMessage(`تم إلغاء حفظ الآية ${ayah.numberInSurah}`);
            } else {
                memorizedAyahsByNumber[ayahKey] = {
                    surah: currentSurah,
                    ayahInSurah: ayah.numberInSurah,
                    updatedAt: Date.now()
                };
                showTemporaryMessage(`أحسنت! تم حفظ الآية ${ayah.numberInSurah}`);
            }

            saveMemorizationProgressMap();
            updateMemorizationCoachUI();
        }

        function resetMemorizationCoachForPage() {
            stopMemorizationAyahAudio(true);
            memorizationAyahIndex = 0;
            memorizationReveal = true;
            updateMemorizationCoachUI();
        }

        function getSelectedShareAyah() {
            const select = document.getElementById('shareAyahSelect');
            if (!select) return null;

            const selectedAyahNumber = parseInt(select.value, 10);
            const pageAyahs = getCurrentPageAyahs();

            return pageAyahs.find(ayah => ayah.number === selectedAyahNumber) || null;
        }

        function getCurrentShareCardStyle() {
            return SHARE_CARD_STYLES[currentShareCardStyle] || SHARE_CARD_STYLES.classic;
        }

        function updateShareStyleControlsUI() {
            const previewCard = document.getElementById('shareCardPreview');
            if (previewCard) {
                previewCard.classList.remove('style-classic', 'style-warm', 'style-night');
                previewCard.classList.add(`style-${currentShareCardStyle}`);
            }

            const previewStyleName = document.getElementById('sharePreviewStyleName');
            if (previewStyleName) {
                previewStyleName.textContent = getCurrentShareCardStyle().label;
            }

            document.querySelectorAll('.share-style-btn').forEach(button => {
                const isActive = button.dataset.style === currentShareCardStyle;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        }

        function updateShareTafsirMeta() {
            const tafsirInput = document.getElementById('shareTafsirSnippet');
            const meta = document.getElementById('shareTafsirMeta');
            if (!meta) return;

            const length = (tafsirInput?.value || '').trim().length;
            meta.textContent = `${length} حرف`;
            meta.classList.toggle('warn', length > 280);
        }

        function selectShareCardStyle(styleKey) {
            if (!SHARE_CARD_STYLES[styleKey]) return;

            currentShareCardStyle = styleKey;
            try {
                localStorage.setItem(SHARE_CARD_STYLE_KEY, styleKey);
            } catch (error) {
                // Ignore localStorage write issues.
            }

            updateShareStyleControlsUI();
            updateShareCardPreview();
        }

        function updateShareCardPreview() {
            const selectedAyah = getSelectedShareAyah();
            const includeTafsir = document.getElementById('shareIncludeTafsir')?.checked;
            const tafsirInput = document.getElementById('shareTafsirSnippet');

            const previewCard = document.getElementById('shareCardPreview');
            const previewAyah = document.getElementById('sharePreviewAyah');
            const previewTafsir = document.getElementById('sharePreviewTafsir');
            const previewReference = document.getElementById('sharePreviewReference');

            if (!previewCard || !previewAyah || !previewTafsir || !previewReference) return;

            updateShareStyleControlsUI();
            updateShareTafsirMeta();

            if (!selectedAyah || !currentSurah) {
                previewAyah.textContent = 'اختر آية للمعاينة';
                previewTafsir.textContent = '';
                previewTafsir.style.display = 'none';
                previewReference.textContent = '';
                return;
            }

            const surahName = surahInfo[currentSurah - 1]?.name || '';
            previewAyah.textContent = selectedAyah.text;
            previewReference.textContent = `سورة ${surahName} • آية ${selectedAyah.numberInSurah}`;

            const tafsirText = (tafsirInput?.value || '').trim();
            if (includeTafsir && tafsirText) {
                previewTafsir.textContent = tafsirText;
                previewTafsir.style.display = 'block';
            } else {
                previewTafsir.textContent = '';
                previewTafsir.style.display = 'none';
            }
        }

        async function fetchTafsirSnippetForAyah(globalAyahNumber) {
            if (tafsirSnippetCache.has(globalAyahNumber)) {
                return tafsirSnippetCache.get(globalAyahNumber);
            }

            const response = await fetch(`https://api.alquran.cloud/v1/ayah/${globalAyahNumber}/ar.muyassar`);
            if (!response.ok) {
                throw new Error('تعذر تحميل التفسير');
            }

            const data = await response.json();
            const rawText = data?.data?.text || '';
            const normalized = rawText.replace(/\s+/g, ' ').trim();
            const snippet = normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;

            tafsirSnippetCache.set(globalAyahNumber, snippet);
            return snippet;
        }

        async function onShareAyahSelectionChange() {
            const selectedAyah = getSelectedShareAyah();
            const includeTafsir = document.getElementById('shareIncludeTafsir')?.checked;
            const tafsirInput = document.getElementById('shareTafsirSnippet');

            if (!selectedAyah || !tafsirInput || !includeTafsir) {
                updateShareCardPreview();
                return;
            }

            tafsirInput.value = 'جار تحميل التفسير...';
            updateShareCardPreview();
            try {
                const snippet = await fetchTafsirSnippetForAyah(selectedAyah.number);
                tafsirInput.value = snippet || '';
            } catch (error) {
                tafsirInput.value = 'تعذر تحميل التفسير لهذه الآية. يمكنك كتابة النص يدوياً.';
            }

            updateShareCardPreview();
        }

        function onShareTafsirToggle() {
            const includeTafsir = document.getElementById('shareIncludeTafsir')?.checked;
            const tafsirField = document.getElementById('shareTafsirField');
            if (tafsirField) {
                tafsirField.style.display = includeTafsir ? 'flex' : 'none';
            }
            updateShareTafsirMeta();
            if (includeTafsir) {
                onShareAyahSelectionChange();
            } else {
                updateShareCardPreview();
            }
        }

        function populateShareAyahOptions() {
            const select = document.getElementById('shareAyahSelect');
            if (!select) return;

            const pageAyahs = getCurrentPageAyahs();
            if (!pageAyahs.length) {
                select.innerHTML = '<option value="">لا توجد آيات للعرض</option>';
                return;
            }

            select.innerHTML = pageAyahs
                .map(ayah => `<option value="${ayah.number}">الآية ${ayah.numberInSurah}</option>`)
                .join('');

            select.selectedIndex = 0;
        }

        function openShareAyahModal() {
            if (!currentSurah || !pages.length) {
                showModal({
                    type: 'info',
                    icon: '',
                    title: 'افتح سورة أولاً',
                    message: 'اختر سورة ثم صفحة الآيات التي تريد مشاركتها.'
                });
                return;
            }

            populateShareAyahOptions();
            updateShareStyleControlsUI();
            onShareTafsirToggle();
            const modal = document.getElementById('shareAyahModal');
            if (modal) {
                modal.classList.add('active');
            }
        }

        function closeShareAyahModal() {
            const modal = document.getElementById('shareAyahModal');
            if (modal) {
                modal.classList.remove('active');
            }
        }

        function wrapCanvasRtlText(ctx, text, x, startY, maxWidth, lineHeight, maxLines = 8) {
            const words = String(text || '').split(' ');
            const lines = [];
            let line = '';

            words.forEach(word => {
                const candidate = line ? `${line} ${word}` : word;
                if (ctx.measureText(candidate).width <= maxWidth) {
                    line = candidate;
                } else {
                    if (line) lines.push(line);
                    line = word;
                }
            });
            if (line) lines.push(line);

            const finalLines = lines.slice(0, maxLines);
            if (lines.length > maxLines && finalLines.length > 0) {
                finalLines[finalLines.length - 1] += '...';
            }

            let y = startY;
            finalLines.forEach(textLine => {
                ctx.fillText(textLine, x, y);
                y += lineHeight;
            });

            return y;
        }

        function countWrappedRtlLines(ctx, text, maxWidth, maxLines = 8) {
            const words = String(text || '').split(' ');
            const lines = [];
            let line = '';

            words.forEach(word => {
                const candidate = line ? `${line} ${word}` : word;
                if (ctx.measureText(candidate).width <= maxWidth) {
                    line = candidate;
                } else {
                    if (line) lines.push(line);
                    line = word;
                }
            });

            if (line) lines.push(line);
            return Math.max(1, Math.min(lines.length || 1, maxLines));
        }

        function buildShareCanvasFont(weight, size, stackKey) {
            const family = SHARE_CARD_CANVAS_FONT_STACKS[stackKey] || SHARE_CARD_CANVAS_FONT_STACKS.ui;
            return `${weight} ${size}px ${family}`;
        }

        async function ensureShareCardCanvasFontsReady() {
            if (!document.fonts || typeof document.fonts.load !== 'function') {
                return;
            }

            const fontLoadTasks = [
                document.fonts.load(buildShareCanvasFont(700, 42, 'ui'), 'القرآن الكريم'),
                document.fonts.load(buildShareCanvasFont(700, 30, 'ui'), 'سورة الفاتحة'),
                document.fonts.load(buildShareCanvasFont(600, 32, 'ui'), 'تفسير الآية'),
                document.fonts.load(buildShareCanvasFont(700, 54, 'verse'), 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ')
            ];

            if (document.fonts.ready) {
                fontLoadTasks.push(document.fonts.ready);
            }

            await Promise.race([
                Promise.allSettled(fontLoadTasks),
                new Promise(resolve => setTimeout(resolve, SHARE_CARD_FONT_LOAD_TIMEOUT_MS))
            ]);
        }

        function buildAyahCardCanvasData() {
            const selectedAyah = getSelectedShareAyah();
            if (!selectedAyah || !currentSurah) {
                return null;
            }

            const includeTafsir = document.getElementById('shareIncludeTafsir')?.checked;
            const tafsirText = (document.getElementById('shareTafsirSnippet')?.value || '').trim();
            const surahName = surahInfo[currentSurah - 1]?.name || '';

            return {
                ayahText: selectedAyah.text,
                tafsirText: includeTafsir ? tafsirText : '',
                reference: `سورة ${surahName} • آية ${selectedAyah.numberInSurah}`,
                shareText: `${surahName} - آية ${selectedAyah.numberInSurah}`,
                styleKey: currentShareCardStyle
            };
        }

        async function generateAyahCardBlob() {
            const cardData = buildAyahCardCanvasData();
            if (!cardData) {
                throw new Error('لم يتم اختيار آية للمشاركة');
            }

            await ensureShareCardCanvasFontsReady();

            const palette = SHARE_CARD_STYLES[cardData.styleKey]?.palette || SHARE_CARD_STYLES.classic.palette;

            const measureCanvas = document.createElement('canvas');
            const measureCtx = measureCanvas.getContext('2d');
            if (!measureCtx) {
                throw new Error('تعذر قياس أبعاد البطاقة');
            }

            const canvasWidth = 1080;
            const cardX = 90;
            const cardY = 120;
            const cardW = canvasWidth - 180;
            const contentMaxWidth = cardW - 120;

            measureCtx.font = buildShareCanvasFont(700, 54, 'verse');
            const ayahLines = countWrappedRtlLines(measureCtx, cardData.ayahText, contentMaxWidth, 6);

            let contentHeightEstimate = 0;
            contentHeightEstimate += 100; // Top padding before heading baseline
            contentHeightEstimate += 64; // Heading block
            contentHeightEstimate += 72; // Divider + spacing to ayah text
            contentHeightEstimate += ayahLines * 86; // Ayah block height

            if (cardData.tafsirText) {
                measureCtx.font = buildShareCanvasFont(600, 32, 'ui');
                const tafsirLines = countWrappedRtlLines(measureCtx, cardData.tafsirText, contentMaxWidth, 6);
                contentHeightEstimate += 22; // Gap before tafsir divider
                contentHeightEstimate += 48; // Divider + spacing
                contentHeightEstimate += tafsirLines * 56; // Tafsir block height
            }

            const footerReservedSpace = 130;
            const minCardHeight = 760;
            const maxCardHeight = 1900;
            const cardH = Math.max(minCardHeight, Math.min(maxCardHeight, contentHeightEstimate + footerReservedSpace));

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = cardH + (cardY * 2);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('تعذر إنشاء الصورة');
            }

            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, palette.backgroundStart);
            gradient.addColorStop(1, palette.backgroundEnd);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = palette.orbOne;
            ctx.beginPath();
            ctx.arc(940, 170, 220, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = palette.orbTwo;
            ctx.beginPath();
            ctx.arc(120, canvas.height - 170, 180, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = palette.cardFill;
            ctx.strokeStyle = palette.cardStroke;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardW, cardH, 28);
            ctx.fill();
            ctx.stroke();

            ctx.textAlign = 'right';
            ctx.direction = 'rtl';
            let cursorY = cardY + 100;

            ctx.fillStyle = palette.heading;
            ctx.font = buildShareCanvasFont(700, 42, 'ui');
            ctx.fillText('القرآن الكريم', cardX + cardW - 54, cursorY);
            cursorY += 64;

            ctx.strokeStyle = palette.divider;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cardX + 54, cursorY);
            ctx.lineTo(cardX + cardW - 54, cursorY);
            ctx.stroke();
            cursorY += 72;

            ctx.fillStyle = palette.ayah;
            ctx.font = buildShareCanvasFont(700, 54, 'verse');
            cursorY = wrapCanvasRtlText(ctx, cardData.ayahText, cardX + cardW - 58, cursorY, cardW - 120, 86, 6);

            if (cardData.tafsirText) {
                cursorY += 22;
                ctx.strokeStyle = palette.tafsirDivider;
                ctx.setLineDash([8, 8]);
                ctx.beginPath();
                ctx.moveTo(cardX + 60, cursorY);
                ctx.lineTo(cardX + cardW - 60, cursorY);
                ctx.stroke();
                ctx.setLineDash([]);
                cursorY += 48;

                ctx.fillStyle = palette.tafsir;
                ctx.font = buildShareCanvasFont(600, 32, 'ui');
                cursorY = wrapCanvasRtlText(ctx, cardData.tafsirText, cardX + cardW - 58, cursorY, cardW - 120, 56, 6);
            }

            const footerY = cardY + cardH - 90;
            ctx.fillStyle = palette.footer;
            ctx.font = buildShareCanvasFont(700, 30, 'ui');
            ctx.fillText(cardData.reference, cardX + cardW - 54, footerY);

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
            if (!blob) {
                throw new Error('تعذر تحويل البطاقة إلى صورة');
            }

            return { blob, cardData };
        }

        function setShareActionButtonContent(button, iconClass, label) {
            if (!button) return;
            button.innerHTML = `<i class="bi ${iconClass}" aria-hidden="true"></i><span>${label}</span>`;
        }

        function setShareCardButtonsLoading(isLoading) {
            const shareBtn = document.getElementById('shareShareCardBtn');
            const downloadBtn = document.getElementById('downloadShareCardBtn');

            if (shareBtn) {
                shareBtn.disabled = isLoading;
                setShareActionButtonContent(shareBtn, isLoading ? 'bi-hourglass-split' : 'bi-share-fill', isLoading ? 'جار الإنشاء...' : 'مشاركة الآن');
            }

            if (downloadBtn) {
                downloadBtn.disabled = isLoading;
                setShareActionButtonContent(downloadBtn, isLoading ? 'bi-hourglass-split' : 'bi-download', isLoading ? 'جار الإنشاء...' : 'تحميل الصورة');
            }
        }

        async function downloadAyahCardImage() {
            try {
                setShareCardButtonsLoading(true);
                const { blob, cardData } = await generateAyahCardBlob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `ayah-card-${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);

                showModal({
                    type: 'success',
                    icon: '',
                    title: 'تم التحميل',
                    message: `تم تحميل بطاقة ${cardData.shareText} بنجاح.`
                });
            } catch (error) {
                showModal({
                    type: 'error',
                    icon: '',
                    title: 'تعذر التحميل',
                    message: error.message || 'حدث خطأ أثناء إنشاء الصورة.'
                });
            } finally {
                setShareCardButtonsLoading(false);
            }
        }

        async function shareAyahCardImage() {
            try {
                setShareCardButtonsLoading(true);
                const { blob, cardData } = await generateAyahCardBlob();

                const fileName = `ayah-card-${Date.now()}.png`;
                const imageFile = new File([blob], fileName, { type: 'image/png' });

                if (navigator.share && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
                    await navigator.share({
                        files: [imageFile],
                        title: cardData.reference,
                        text: cardData.shareText
                    });
                    return;
                }

                const fallbackUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = fallbackUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(fallbackUrl);

                showModal({
                    type: 'info',
                    icon: '',
                    title: 'لا يدعم المشاركة المباشرة',
                    message: 'تم تحميل الصورة. يمكنك مشاركتها يدوياً من المعرض.'
                });
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }

                showModal({
                    type: 'error',
                    icon: '',
                    title: 'تعذر المشاركة',
                    message: error.message || 'حدث خطأ أثناء تجهيز البطاقة.'
                });
            } finally {
                setShareCardButtonsLoading(false);
            }
        }

        function openReciterModal() {
            const modal = document.getElementById('reciterModal');
            if (modal) {
                modal.classList.add('active');
                updateReciterSelection();
            }
        }

        function closeReciterModal() {
            const modal = document.getElementById('reciterModal');
            if (modal) {
                modal.classList.remove('active');
            }
        }

        function selectReciter(reciterCode, reciterName) {
            currentReciter = reciterCode;

            // Update button text
            const btnText = document.getElementById('currentReciterName');
            if (btnText) {
                btnText.textContent = reciterName;
            }

            // Update active state
            updateReciterSelection();

            // Reset audio if playing
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
            isPlaying = false;
            currentAyahIndex = 0;
            removeAyahHighlight();
            stopMemorizationAyahAudio(true);
            updatePlayButton();
            updateCurrentAyahDisplay();
            updateMemorizationCoachUI();
            updateAyahQuickActionsUI();

            // Close modal
            closeReciterModal();
        }

        function updateReciterSelection() {
            const items = document.querySelectorAll('.reciter-item');
            items.forEach(item => {
                if (item.dataset.reciter === currentReciter) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }

        function toggleAudioPlayer() {
            const player = document.getElementById('audioPlayer');
            const toggleBtn = document.getElementById('playerToggleBtn');

            if (player.classList.contains('active')) {
                player.classList.remove('active');
                if (toggleBtn) {
                    toggleBtn.querySelector('i').className = 'bi bi-music-note-beamed';
                    toggleBtn.querySelector('span').textContent = 'الصوت';
                }
                // Pause audio if playing
                if (isPlaying) {
                    pauseAudio();
                }
            } else {
                player.classList.add('active');
                if (toggleBtn) {
                    toggleBtn.querySelector('i').className = 'bi bi-x-lg';
                    toggleBtn.querySelector('span').textContent = 'إغلاق';
                }
            }
        }

        // تفسير functionality
        let tafsirMode = false;

        function toggleTafsir() {
            tafsirMode = !tafsirMode;
            const content = document.getElementById('quranContent');
            const tafsirBtn = document.getElementById('tafsirBtn');

            hideAyahQuickActions({ immediate: true });

            if (tafsirMode) {
                content.classList.add('tafsir-mode');
                tafsirBtn.classList.add('active');
                loadTafsirForCurrentPage();
            } else {
                content.classList.remove('tafsir-mode');
                tafsirBtn.classList.remove('active');
                renderCurrentPage(); // Restore Arabic text view
            }
        }

        async function loadTafsirForCurrentPage() {
            if (pages.length === 0 || currentPageIndex >= pages.length) return;

            const page = pages[currentPageIndex];
            const content = document.getElementById('quranContent');

            // Show loading
            content.innerHTML = '<div class="page-content"><div class="tafsir-loading"><div class="spinner"></div><p>جار تحميل التفسير...</p></div></div>';

            try {
                const tafsirPromises = page.ayahs.map(async (ayah) => {
                    try {
                        // Using Muyassar تفسير (simplified interpretation)
                        const response = await fetch(`https://api.alquran.cloud/v1/ayah/${ayah.number}/ar.muyassar`);
                        if (!response.ok) throw new Error('Failed to load tafsir');

                        const data = await response.json();
                        if (data.code !== 200) throw new Error('Invalid tafsir response');

                        return {
                            ayahNumber: ayah.numberInSurah,
                            arabicText: ayah.text,
                            tafsirText: data.data.text
                        };
                    } catch (error) {
                        console.error('Error loading tafsir for ayah', ayah.number, error);
                        return {
                            ayahNumber: ayah.numberInSurah,
                            arabicText: ayah.text,
                            tafsirText: 'عذراً، لم نتمكن من تحميل تفسير هذه الآية'
                        };
                    }
                });

                const tafsirData = await Promise.all(tafsirPromises);

                // Render tafsir
                let html = '<div class="page-content">';

                if (currentPageIndex === 0) {
                    html += `
                        <div class="page-header">
                            <div class="surah-name">${page.surahName}</div>
                            <div class="surah-info">${page.surahEnglish} • ${page.revelationType} • ${page.numberOfAyahs} آيات</div>
                        </div>
                    `;
                }

                html += '<div class="tafsir-container">';

                tafsirData.forEach((item, index) => {
                    html += `
                        <div class="ayah-tafsir">
                            <div class="tafsir-ayah-number">${item.ayahNumber}</div>
                            <div class="ayah arabic-text" style="font-size: var(--quran-reader-font-size, var(--font-size-ayah)); margin-bottom: 12px; text-align: center; background: rgba(var(--primary-rgb, 27, 94, 32), 0.05); padding: 12px; border-radius: 8px;">${item.arabicText}</div>
                            <div class="tafsir-text">${item.tafsirText}</div>
                        </div>
                    `;
                });

                html += '</div>';
                const juz = surahToJuz[currentSurah];
                html += `<div class="page-number">الجزء ${juz} • صفحة ${page.pageNum} من ${totalPages}</div>`;
                html += '</div>';

                content.innerHTML = html;

                const shareModal = document.getElementById('shareAyahModal');
                if (shareModal && shareModal.classList.contains('active')) {
                    populateShareAyahOptions();
                    updateShareCardPreview();
                }

            } catch (error) {
                console.error('Error loading tafsir:', error);
                content.innerHTML = '<div class="page-content"><div class="tafsir-error">خطأ في تحميل التفسير. يرجى المحاولة مرة أخرى.</div></div>';
            }
        }

        document.getElementById('shareTafsirSnippet')?.addEventListener('input', () => {
            updateShareTafsirMeta();
            updateShareCardPreview();
        });

        updateShareStyleControlsUI();
        updateShareTafsirMeta();
        setShareCardButtonsLoading(false);
