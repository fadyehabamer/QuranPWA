let totalPages = 0;
        let pages = [];
    let textPages = [];
    let mushafPages = [];
    let currentSurahAyahs = [];
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
        const READER_DISPLAY_MODE_KEY = 'quranReaderDisplayModeV1';
        const READER_DISPLAY_TEXT = 'text';
        const READER_DISPLAY_MUSHAF = 'mushaf';
        const MUSHAF_IMAGE_LOCAL_BASE_PATH = 'assets/mushaf-pages';
        const MUSHAF_IMAGE_REMOTE_BASE_URL = 'https://quran.ksu.edu.sa/png_big';
        const MUSHAF_MIN_PAGE_NUMBER = 1;
        const MUSHAF_MAX_PAGE_NUMBER = 604;
        const READER_FONT_LEVELS = [
            { key: 'sm', label: 'صغير', size: 22 },
            { key: 'md', label: 'متوسط', size: 26 },
            { key: 'lg', label: 'كبير', size: 30 }
        ];
        let currentReaderFontLevelIndex = 1;
        let readerDisplayMode = READER_DISPLAY_TEXT;

        // Audio player state
        let currentAudio = null;
        let currentReciter = localStorage.getItem('quranReciterV1') || 'ar.alafasy';
        // Guards against two surah loads / tafsir loads racing each other.
        let surahLoadToken = 0;
        let tafsirLoadToken = 0;
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

        // Byte-identical to window.QURAN_SURAH_NAMES; kept as an alias so the
        // search haystack below reads unchanged.
        const surahNames = window.QURAN_SURAH_NAMES;

        const surahInfo = window.QURAN_SURAHS;
        const surahToJuz = window.QURAN_SURAH_TO_JUZ;

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
            // Searching only filters the surah list, so a query on the Juz/Page
            // tab would otherwise look like it did nothing.
            if (query && activeQuranTab !== 'surah') switchQuranTab('surah');
            filterSurahs(query);

            clearTimeout(searchDebounceTimer);
            if (searchAbortController) {
                searchAbortController.abort();
                searchAbortController = null;
            }

            if (query.length < 3) {
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

        /* ------------------------------------------------------------------
           Index browsing: السور / الأجزاء / الصفحات
           ------------------------------------------------------------------ */

        // Ornamental 8-point star (khatim) framing each index number. Drawn as a
        // single polygon rather than two rotated squares so the outline stays one
        // clean stroke instead of showing the overlap seams.
        const STAR_POINTS =
            '50.00,0.00 64.65,14.64 85.36,14.64 85.36,35.35 100.00,50.00 85.36,64.65 ' +
            '85.36,85.36 64.65,85.36 50.00,100.00 35.35,85.36 14.64,85.36 14.64,64.65 ' +
            '0.00,50.00 14.64,35.35 14.64,14.64 35.35,14.64';

        // Arabic-Indic digits, used for the decorative mushaf-style numeral so it
        // reads as ornament rather than a second copy of the index number.
        function toArabicDigits(value) {
            return String(value).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
        }

        function starBadge(value) {
            return `<span class="star-badge" aria-hidden="true">
                        <svg viewBox="0 0 100 100" focusable="false"><polygon points="${STAR_POINTS}"/></svg>
                        <span class="star-badge-num">${value}</span>
                    </span>`;
        }

        const quranIndex = window.QURAN_INDEX || null;
        let activeQuranTab = 'surah';
        let juzListRendered = false;
        let pageListRendered = false;

        function switchQuranTab(tab) {
            activeQuranTab = tab;

            const panels = { surah: 'surahList', juz: 'juzList', page: 'pageList' };
            const tabs = { surah: 'quranTabSurah', juz: 'quranTabJuz', page: 'quranTabPage' };

            Object.entries(panels).forEach(([key, id]) => {
                const panel = document.getElementById(id);
                if (panel) panel.hidden = key !== tab;
            });
            Object.entries(tabs).forEach(([key, id]) => {
                const button = document.getElementById(id);
                if (!button) return;
                button.classList.toggle('is-active', key === tab);
                button.setAttribute('aria-selected', String(key === tab));
            });

            // Render on first reveal — the page list is 604 rows and there is no
            // reason to build it for someone who never opens that tab.
            if (tab === 'juz' && !juzListRendered) { renderJuzList(); juzListRendered = true; }
            if (tab === 'page' && !pageListRendered) { renderPageList(); pageListRendered = true; }
        }

        function renderSurahList() {
            const list = document.getElementById('surahList');
            let html = '';

            surahInfo.forEach((surah, index) => {
                const number = index + 1;
                const juz = surahToJuz[number];
                const isMakki = String(surah.type).includes('مكية');
                html += `
                    <button type="button" class="surah-item" onclick="selectSurah(${number})" data-name="${surah.name}" data-number="${number}">
                        ${starBadge(number)}
                        <span class="surah-item-info">
                            <span class="surah-item-name">${surah.name}</span>
                            <span class="surah-item-details">
                                <span class="surah-tag ${isMakki ? 'is-makki' : 'is-madani'}">${surah.type}</span>
                                <span class="surah-dot">•</span>
                                <span>${surah.verses} آية</span>
                                <span class="surah-dot">•</span>
                                <span>الجزء ${juz}</span>
                            </span>
                        </span>
                        <span class="surah-item-arabic" aria-hidden="true">${toArabicDigits(number)}</span>
                    </button>
                `;
            });

            list.innerHTML = html;
        }

        // Where a juz/page starts, described as "السورة — آية ن".
        function describeStart(surahNumber, ayahNumber) {
            const surah = surahInfo[surahNumber - 1];
            const name = surah ? surah.name : `سورة ${surahNumber}`;
            return `${name} • الآية ${ayahNumber}`;
        }

        function renderJuzList() {
            const list = document.getElementById('juzList');
            if (!list || !quranIndex) return;

            const starts = quranIndex.JUZ_STARTS;
            list.innerHTML = starts.map(([surahNumber, ayahNumber], index) => {
                const juzNumber = index + 1;
                const page = quranIndex.pageForAyah(surahNumber, ayahNumber);

                // A juz ends on the ayah before the next juz begins. When the next
                // juz starts at ayah 1 the boundary falls on the previous surah's
                // final ayah, so step back a surah rather than printing "الآية 0".
                const next = starts[index + 1];
                let endLabel = 'الناس • الآية 6';
                if (next) {
                    let endSurah = next[0];
                    let endAyah = next[1] - 1;
                    if (endAyah < 1) {
                        endSurah -= 1;
                        endAyah = surahInfo[endSurah - 1]?.verses || 1;
                    }
                    endLabel = describeStart(endSurah, endAyah);
                }

                return `
                    <button type="button" class="surah-item" onclick="openSearchAyah(${surahNumber}, ${ayahNumber})">
                        ${starBadge(juzNumber)}
                        <span class="surah-item-info">
                            <span class="surah-item-name">الجزء ${juzNumber}</span>
                            <span class="surah-item-details">
                                <span>${describeStart(surahNumber, ayahNumber)}</span>
                                <span class="surah-dot">←</span>
                                <span>${endLabel}</span>
                            </span>
                        </span>
                        <span class="surah-item-page">ص ${page}</span>
                    </button>
                `;
            }).join('');
        }

        function renderPageList() {
            const list = document.getElementById('pageList');
            if (!list || !quranIndex) return;

            let html = '';
            let lastJuz = 0;
            quranIndex.PAGE_STARTS.forEach(([surahNumber, ayahNumber], index) => {
                const pageNumber = index + 1;
                const juz = quranIndex.juzForAyah(surahNumber, ayahNumber);
                if (juz !== lastJuz) {
                    lastJuz = juz;
                    html += `<div class="page-grid-heading">الجزء ${juz}</div>`;
                }
                const surahName = surahInfo[surahNumber - 1]?.name || '';
                html += `
                    <button type="button" class="page-cell" onclick="openSearchAyah(${surahNumber}, ${ayahNumber})"
                        title="صفحة ${pageNumber} — ${surahName}">
                        <span class="page-cell-num">${pageNumber}</span>
                        <span class="page-cell-surah">${surahName}</span>
                    </button>
                `;
            });
            list.innerHTML = html;
        }

        /* ------------------------------------------------------------------
           Quick access strip
           ------------------------------------------------------------------ */

        // The most recently touched entry in the per-surah reading positions.
        function getLastReadingEntry() {
            const positions = getSurahReadingPositions();
            let best = null;
            Object.entries(positions).forEach(([surahNumber, entry]) => {
                if (!entry || typeof entry.updatedAt !== 'number') return;
                if (!best || entry.updatedAt > best.updatedAt) {
                    best = { surah: Number(surahNumber), page: entry.page || 0, updatedAt: entry.updatedAt };
                }
            });
            return best;
        }

        function resumeLastReading() {
            const last = getLastReadingEntry();
            if (last) openSurahAtPage(last.surah, last.page);
            else selectSurah(1);
        }

        function openRandomAyah() {
            const surahNumber = 1 + Math.floor(Math.random() * surahInfo.length);
            const verses = surahInfo[surahNumber - 1]?.verses || 1;
            const ayahNumber = 1 + Math.floor(Math.random() * verses);
            openSearchAyah(surahNumber, ayahNumber);
        }

        function renderQuickAccess() {
            const label = document.getElementById('quickResumeLabel');
            const sub = document.getElementById('quickResumeSub');
            const last = getLastReadingEntry();

            if (label && sub) {
                if (last) {
                    const name = surahInfo[last.surah - 1]?.name || '';
                    label.textContent = 'متابعة القراءة';
                    sub.textContent = `${name} • صفحة ${last.page + 1}`;
                } else {
                    label.textContent = 'ابدأ القراءة';
                    sub.textContent = 'سورة الفاتحة';
                }
            }

            const bookmarkCount = document.getElementById('quickBookmarkCount');
            if (bookmarkCount) {
                try { bookmarkCount.textContent = String(window.loadBookmarkLibrary ? window.loadBookmarkLibrary().length : 0); }
                catch (_error) { bookmarkCount.textContent = '0'; }
            }

            const khatma = document.getElementById('quickKhatmaValue');
            if (khatma) {
                // Progress is however much of the mushaf the reader has visited,
                // approximated by the furthest page reached in each saved surah.
                try {
                    const positions = getSurahReadingPositions();
                    const readSurahs = Object.keys(positions).length;
                    khatma.textContent = readSurahs ? `${Math.round((readSurahs / 114) * 100)}%` : '—';
                } catch (_error) {
                    khatma.textContent = '—';
                }
            }
        }

        function filterSurahs(searchTermOverride = '') {
            const input = document.getElementById('surahSearch');
            const rawSearchTerm = searchTermOverride || input?.value || '';
            const searchTerm = normalizeArabicText(rawSearchTerm);
            const items = document.querySelectorAll('.surah-item');

            items.forEach(item => {
                const number = item.getAttribute('data-number');
                if (number === null) return; // juz / page buttons reuse the class
                const name = normalizeArabicText(item.getAttribute('data-name'));
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
            const loaded = await loadSurah(surahNumber);

            // Bail on failure so the offline/error state stays on screen.
            if (!loaded || totalPages <= 0) {
                return;
            }

            if (Number.isInteger(pageIndex)) {
                currentPageIndex = resolveReaderPageIndexFromTextIndex(pageIndex, ayahNumberInSurah);
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

            if (!target) {
                if (readerDisplayMode === READER_DISPLAY_MUSHAF) {
                    showTemporaryMessage('تم فتح الصفحة في نمط المصحف');
                }
                return;
            }

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
            renderQuickAccess();
            document.body.classList.remove('quran-reader-active');
            // Never leave the app chrome hidden outside the reader.
            setReaderImmersion(false);
            updateMushafFocusMode({ exitFullscreen: true });
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
            window.scrollTo(0, 0);
            document.body.classList.add('quran-reader-active');
            updateMushafFocusMode({ requestFullscreen: readerDisplayMode === READER_DISPLAY_MUSHAF });
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

        function normalizeReaderDisplayMode(mode) {
            return mode === READER_DISPLAY_MUSHAF ? READER_DISPLAY_MUSHAF : READER_DISPLAY_TEXT;
        }

        function loadReaderDisplayModePreference() {
            try {
                return normalizeReaderDisplayMode(localStorage.getItem(READER_DISPLAY_MODE_KEY));
            } catch (_error) {
                return READER_DISPLAY_TEXT;
            }
        }

        function saveReaderDisplayModePreference(mode) {
            try {
                localStorage.setItem(READER_DISPLAY_MODE_KEY, normalizeReaderDisplayMode(mode));
            } catch (_error) {
                // Ignore localStorage write issues.
            }
        }

        function requestMushafNativeFullscreen() {
            const target = document.documentElement;
            if (!target || document.fullscreenElement || !target.requestFullscreen) {
                return;
            }

            target.requestFullscreen().catch(() => {
                // Ignore fullscreen request rejections.
            });
        }

        function exitNativeFullscreenIfAny() {
            if (!document.fullscreenElement || !document.exitFullscreen) {
                return;
            }

            document.exitFullscreen().catch(() => {
                // Ignore fullscreen exit rejections.
            });
        }

        function updateMushafFocusMode(options = {}) {
            const shouldBeActive = readerDisplayMode === READER_DISPLAY_MUSHAF && isReaderViewActive();
            document.body.classList.toggle('mushaf-focus-mode', shouldBeActive);

            if (shouldBeActive) {
                hideAyahQuickActions({ immediate: true });
                closeShareAyahModal();

                if (options.requestFullscreen) {
                    requestMushafNativeFullscreen();
                }
            } else if (options.exitFullscreen) {
                exitNativeFullscreenIfAny();
            }

            updateScrollTopButtonVisibility();
        }

        function exitMushafFocusMode() {
            if (readerDisplayMode !== READER_DISPLAY_MUSHAF) {
                updateMushafFocusMode({ exitFullscreen: true });
                return;
            }

            setReaderDisplayMode(READER_DISPLAY_TEXT, {
                persist: true,
                render: true,
                exitFullscreen: true
            });
            showTemporaryMessage('تم الخروج من عرض المصحف');
        }

        function getPageIndexByAyahNumber(pageCollection, globalAyahNumber) {
            if (!Array.isArray(pageCollection) || !Number.isInteger(globalAyahNumber)) {
                return -1;
            }

            return pageCollection.findIndex(page =>
                Array.isArray(page?.ayahs) && page.ayahs.some(ayah => ayah.number === globalAyahNumber)
            );
        }

        function getGlobalAyahNumberFromSurahAyah(ayahNumberInSurah) {
            const safeAyahNumber = parseInt(ayahNumberInSurah, 10);
            if (!Number.isInteger(safeAyahNumber) || safeAyahNumber < 1 || safeAyahNumber > currentSurahAyahs.length) {
                return null;
            }

            return currentSurahAyahs[safeAyahNumber - 1]?.number || null;
        }

        function getGlobalAyahNumberFromTextPageIndex(textPageIndex) {
            if (!textPages.length) return null;

            const parsed = parseInt(textPageIndex, 10);
            const safeIndex = Math.max(0, Math.min(Number.isInteger(parsed) ? parsed : 0, textPages.length - 1));
            return textPages[safeIndex]?.ayahs?.[0]?.number || null;
        }

        function resolveReaderPageIndexFromTextIndex(textPageIndex, ayahNumberInSurah = null) {
            const parsedTextPageIndex = parseInt(textPageIndex, 10);
            const safeTextPageIndex = Number.isInteger(parsedTextPageIndex) ? parsedTextPageIndex : 0;

            if (readerDisplayMode !== READER_DISPLAY_MUSHAF) {
                return Math.max(0, Math.min(safeTextPageIndex, Math.max(totalPages - 1, 0)));
            }

            const ayahGlobalNumber =
                getGlobalAyahNumberFromSurahAyah(ayahNumberInSurah) ||
                getGlobalAyahNumberFromTextPageIndex(safeTextPageIndex);
            const mushafIndex = getPageIndexByAyahNumber(mushafPages, ayahGlobalNumber);

            if (mushafIndex !== -1) {
                return mushafIndex;
            }

            return Math.max(0, Math.min(safeTextPageIndex, Math.max(mushafPages.length - 1, 0)));
        }

        function resolveBookmarkPageIndex() {
            if (!pages.length || currentPageIndex < 0) return 0;

            if (readerDisplayMode === READER_DISPLAY_TEXT) {
                return Math.max(0, Math.min(currentPageIndex, Math.max(textPages.length - 1, 0)));
            }

            const firstAyah = pages[currentPageIndex]?.ayahs?.[0];
            if (!firstAyah || !Number.isInteger(firstAyah.numberInSurah)) {
                return 0;
            }

            return Math.max(
                0,
                Math.min(
                    Math.floor((firstAyah.numberInSurah - 1) / AYAHS_PER_PAGE),
                    Math.max(textPages.length - 1, 0)
                )
            );
        }

        function applyReaderDisplayModeClass() {
            const content = document.getElementById('quranContent');
            if (content) {
                content.classList.toggle('mushaf-mode', readerDisplayMode === READER_DISPLAY_MUSHAF);
            }
        }

        function updateReaderDisplayModeButton() {
            const modeBtn = document.getElementById('displayModeBtn');
            if (!modeBtn) return;

            const icon = modeBtn.querySelector('i');
            const label = modeBtn.querySelector('span');
            const isMushafMode = readerDisplayMode === READER_DISPLAY_MUSHAF;

            modeBtn.classList.toggle('active', isMushafMode);

            if (icon) {
                icon.className = isMushafMode ? 'bi bi-journal-richtext' : 'bi bi-file-earmark-image';
            }

            if (label) {
                label.textContent = isMushafMode ? 'النص' : 'المصحف';
            }

            const title = isMushafMode ? 'عرض النص' : 'عرض المصحف';
            modeBtn.title = title;
            modeBtn.setAttribute('aria-label', title);
        }

        function setReaderDisplayMode(nextMode, options = {}) {
            const mode = normalizeReaderDisplayMode(nextMode);
            const persist = options.persist !== false;
            const render = options.render !== false;
            const requestFullscreen = options.requestFullscreen === true;
            const exitFullscreen = options.exitFullscreen !== false;
            const fallbackIndex = Number.isInteger(options.fallbackIndex) ? options.fallbackIndex : currentPageIndex;
            const anchorAyahNumber = Number.isInteger(options.anchorAyahNumber)
                ? options.anchorAyahNumber
                : (pages[currentPageIndex]?.ayahs?.[0]?.number || null);

            readerDisplayMode = mode;

            const targetPages = mode === READER_DISPLAY_MUSHAF ? mushafPages : textPages;
            pages = targetPages;
            totalPages = targetPages.length;

            if (totalPages > 0) {
                const mappedIndex = getPageIndexByAyahNumber(targetPages, anchorAyahNumber);
                if (mappedIndex !== -1) {
                    currentPageIndex = mappedIndex;
                } else {
                    currentPageIndex = Math.max(0, Math.min(fallbackIndex, totalPages - 1));
                }
            } else {
                currentPageIndex = 0;
            }

            applyReaderDisplayModeClass();
            updateReaderDisplayModeButton();

            if (persist) {
                saveReaderDisplayModePreference(mode);
            }

            updateMushafFocusMode({
                requestFullscreen: requestFullscreen && mode === READER_DISPLAY_MUSHAF,
                exitFullscreen: exitFullscreen && mode !== READER_DISPLAY_MUSHAF
            });

            if (!render || totalPages <= 0) {
                return;
            }

            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
            isPlaying = false;
            allAyahs = [];
            currentAyahIndex = 0;
            removeAyahHighlight();
            updatePlayButton();
            updateCurrentAyahDisplay();

            stopMemorizationAyahAudio(true);
            hideAyahQuickActions({ immediate: true });

            renderCurrentPage();
            updateNavigation();
            scrollReaderToTop(true);
        }

        function initReaderDisplayMode() {
            readerDisplayMode = loadReaderDisplayModePreference();
            applyReaderDisplayModeClass();
            updateReaderDisplayModeButton();
            updateMushafFocusMode({ requestFullscreen: false, exitFullscreen: false });
        }

        function toggleReaderDisplayMode() {
            const nextMode = readerDisplayMode === READER_DISPLAY_MUSHAF
                ? READER_DISPLAY_TEXT
                : READER_DISPLAY_MUSHAF;

            setReaderDisplayMode(nextMode, {
                persist: true,
                render: true,
                requestFullscreen: nextMode === READER_DISPLAY_MUSHAF,
                exitFullscreen: nextMode !== READER_DISPLAY_MUSHAF
            });
            showTemporaryMessage(nextMode === READER_DISPLAY_MUSHAF ? 'تم تفعيل عرض المصحف' : 'تم تفعيل عرض النص');
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

            const bookmarkPageIndex = resolveBookmarkPageIndex();

            const positions = getSurahReadingPositions();
            positions[String(currentSurah)] = {
                page: bookmarkPageIndex,
                mode: readerDisplayMode,
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

            // The previous surah's pages stayed live while the spinner showed,
            // so a swipe or arrow key rendered the OLD surah over it and saved
            // its page under the NEW surah's key. Clear them and lock the
            // navigation until this load lands.
            const loadToken = ++surahLoadToken;
            pages = [];
            textPages = [];
            mushafPages = [];
            currentSurahAyahs = [];
            totalPages = 0;
            const prevBtn = document.getElementById('prevPageBtn');
            const nextBtn = document.getElementById('nextPageBtn');
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;

            try {
                const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`);
                if (!response.ok) throw new Error('Failed to load surah');

                const data = await response.json();
                if (data.code !== 200 || !data.data?.ayahs) throw new Error('Invalid response');

                // A newer load has started since (user tapped another surah);
                // let that one paint.
                if (loadToken !== surahLoadToken) return false;

                const surah = surahInfo[surahNumber - 1];
                const juz = surahToJuz[surahNumber];
                const surahTitle = document.getElementById('surahTitle');
                const surahDesc = document.getElementById('surahDescription');
                if (surahTitle) surahTitle.textContent = data.data.name;
                if (surahDesc) surahDesc.textContent = `الجزء ${juz} • ${surah.type} • ${surah.verses} آيات`;

                createPages(data.data);

                const savedPageIndex = getSavedPageForSurah(currentSurah);
                let initialTextPageIndex = 0;
                if (!shouldStartFromBeginning && Number.isInteger(savedPageIndex)) {
                    initialTextPageIndex = Math.max(0, Math.min(savedPageIndex, Math.max(textPages.length - 1, 0)));
                }

                const anchorAyahNumber = getGlobalAyahNumberFromTextPageIndex(initialTextPageIndex)
                    || currentSurahAyahs[0]?.number
                    || null;

                setReaderDisplayMode(readerDisplayMode, {
                    persist: false,
                    render: false,
                    fallbackIndex: initialTextPageIndex,
                    anchorAyahNumber
                });

                renderCurrentPage();
                checkBookmark();
                updateNavigation();
                loadPlaybackPosition();
                resetMemorizationCoachForPage();
                return true;
            } catch (error) {
                console.error('Error:', error);
                if (loadToken !== surahLoadToken) return false;
                // Drop the previous surah's pages. Without this the caller sees
                // a non-zero totalPages and re-renders the OLD surah's text
                // over this message — silently showing the wrong surah.
                textPages = [];
                mushafPages = [];
                currentSurahAyahs = [];
                totalPages = 0;
                // Surahs already opened once are served from cache and work with
                // no connection, so an offline failure means this particular
                // surah was never downloaded — say that instead of "error".
                const offline = !navigator.onLine;
                content.innerHTML = `
                    <div class="reader-offline-state">
                        <i class="bi ${offline ? 'bi-wifi-off' : 'bi-exclamation-triangle'}" aria-hidden="true"></i>
                        <h3>${offline ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر تحميل السورة'}</h3>
                        <p>${offline
                            ? 'هذه السورة لم تُحمَّل من قبل. السور التي قرأتها سابقاً متاحة بدون إنترنت.'
                            : 'حدث خطأ أثناء التحميل. تحقق من الاتصال وحاول مرة أخرى.'}</p>
                        <button type="button" class="reader-offline-retry" onclick="loadSurah(${surahNumber})">
                            <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> إعادة المحاولة
                        </button>
                    </div>`;
                return false;
            }
        }


        function createPages(surahData) {
            const ayahs = Array.isArray(surahData?.ayahs) ? surahData.ayahs : [];
            currentSurahAyahs = ayahs.slice();
            textPages = [];
            mushafPages = [];

            for (let i = 0; i < ayahs.length; i += AYAHS_PER_PAGE) {
                const pageAyahs = ayahs.slice(i, i + AYAHS_PER_PAGE);
                textPages.push({
                    surahName: surahData.name,
                    surahEnglish: surahData.englishName,
                    surahNumber: surahData.number,
                    revelationType: surahData.revelationType === 'Meccan' ? 'مكية' : 'مدنية',
                    numberOfAyahs: surahData.numberOfAyahs,
                    ayahs: pageAyahs,
                    pageNum: Math.floor(i / AYAHS_PER_PAGE) + 1,
                    displayMode: READER_DISPLAY_TEXT
                });
            }

            const mushafPageMap = new Map();
            ayahs.forEach(ayah => {
                const rawMushafPage = parseInt(ayah?.page, 10);
                const mushafPageNumber = Number.isInteger(rawMushafPage)
                    ? Math.max(MUSHAF_MIN_PAGE_NUMBER, Math.min(rawMushafPage, MUSHAF_MAX_PAGE_NUMBER))
                    : null;
                const mapKey = Number.isInteger(mushafPageNumber) ? mushafPageNumber : `fallback-${ayah.number}`;

                if (!mushafPageMap.has(mapKey)) {
                    mushafPageMap.set(mapKey, {
                        surahName: surahData.name,
                        surahEnglish: surahData.englishName,
                        surahNumber: surahData.number,
                        revelationType: surahData.revelationType === 'Meccan' ? 'مكية' : 'مدنية',
                        numberOfAyahs: surahData.numberOfAyahs,
                        ayahs: [],
                        pageNum: 0,
                        mushafPageNumber,
                        displayMode: READER_DISPLAY_MUSHAF
                    });
                }

                mushafPageMap.get(mapKey).ayahs.push(ayah);
            });

            mushafPages = Array.from(mushafPageMap.values())
                .sort((a, b) => {
                    const aValue = Number.isInteger(a.mushafPageNumber) ? a.mushafPageNumber : Number.MAX_SAFE_INTEGER;
                    const bValue = Number.isInteger(b.mushafPageNumber) ? b.mushafPageNumber : Number.MAX_SAFE_INTEGER;
                    return aValue - bValue;
                })
                .map((page, index) => ({
                    ...page,
                    pageNum: index + 1
                }));

            pages = readerDisplayMode === READER_DISPLAY_MUSHAF ? mushafPages : textPages;
            totalPages = pages.length;
        }

        function getMushafPageNumber(page) {
            const rawPage = parseInt(page?.mushafPageNumber ?? page?.ayahs?.[0]?.page, 10);
            if (!Number.isInteger(rawPage)) {
                return MUSHAF_MIN_PAGE_NUMBER;
            }

            return Math.max(MUSHAF_MIN_PAGE_NUMBER, Math.min(rawPage, MUSHAF_MAX_PAGE_NUMBER));
        }

        function buildMushafPageImageUrl(pageNumber, source = 'local') {
            const raw = parseInt(pageNumber, 10);
            const safePage = Number.isInteger(raw)
                ? Math.max(MUSHAF_MIN_PAGE_NUMBER, Math.min(raw, MUSHAF_MAX_PAGE_NUMBER))
                : MUSHAF_MIN_PAGE_NUMBER;

            const basePath = source === 'remote'
                ? MUSHAF_IMAGE_REMOTE_BASE_URL
                : MUSHAF_IMAGE_LOCAL_BASE_PATH;

            return `${basePath}/${safePage}.png`;
        }

        function buildMushafPageImageCandidates(pageNumber) {
            return [
                buildMushafPageImageUrl(pageNumber, 'local'),
                buildMushafPageImageUrl(pageNumber, 'remote')
            ];
        }

        /**
         * Split a leading Bismillah off an ayah, returning both halves.
         *
         * This used to be done with `indexOf('لرَّحِيمِ')`, which never matched:
         * the Uthmani text orders the marks shadda-then-fatha (رّ َ) while the
         * literal in the source had fatha-then-shadda, so the search returned
         * -1 and the Bismillah stayed glued to the front of ayah 1 of all 112
         * surahs that open with it.
         *
         * Comparing on a mark-free, alef-folded projection avoids depending on
         * any particular spelling, while the character-by-character walk keeps
         * the exact original text (marks and all) for display.
         */
        const BISMILLAH_PLAIN = 'بسم الله الرحمن الرحيم';

        // Drop tashkeel/quranic annotation marks and fold the alef variants,
        // WITHOUT collapsing anything else — this is a per-character projection.
        function plainArabicChar(character) {
            if (/[ً-ٰٟۖ-ۭـ]/.test(character)) return '';
            if (/[آأإٱ]/.test(character)) return 'ا';
            return character;
        }

        function splitLeadingBismillah(text) {
            const source = String(text || '');
            let plain = '';

            for (let i = 0; i < source.length; i += 1) {
                plain += plainArabicChar(source[i]);

                if (plain === BISMILLAH_PLAIN) {
                    // The projection matched on the last LETTER; any marks
                    // sitting on it come after, so keep consuming them or the
                    // final kasra of "ٱلرَّحِيمِ" would head the next line.
                    let end = i + 1;
                    while (end < source.length && plainArabicChar(source[end]) === '') end += 1;

                    return {
                        bismillah: source.slice(0, end),
                        rest: source.slice(end).trim()
                    };
                }
                // Bail as soon as the prefix diverges, so an ayah that merely
                // starts with "بسم" of something else is left untouched.
                if (!BISMILLAH_PLAIN.startsWith(plain)) break;
            }

            return { bismillah: '', rest: source };
        }

        // Ayah text as it should be displayed: the opening Bismillah is set on
        // its own line by the caller, so it must not be repeated inside ayah 1.
        function ayahTextWithoutBismillah(ayah) {
            if (ayah.numberInSurah !== 1 || currentSurah === 1 || currentSurah === 9) {
                return ayah.text;
            }
            return splitLeadingBismillah(ayah.text).rest;
        }

        function renderTextPage(content, page) {
            let html = '<div class="page-content">';

            if (currentPageIndex === 0) {
                html += `
                    <div class="page-header">
                        <div class="surah-name">${page.surahName}</div>
                        <div class="surah-info">${page.surahEnglish} • ${page.revelationType} • ${page.numberOfAyahs} آيات</div>
                    </div>
                `;
            }

            // The Bismillah opens every surah but Al-Fatiha (where it is ayah 1
            // itself) and At-Tawbah (which has none). It belongs on its own line
            // above the text, exactly as a printed mushaf sets it — not run into
            // the first ayah.
            const opensWithBismillah = currentSurah !== 1 && currentSurah !== 9;
            const firstAyahOnPage = page.ayahs[0];
            const showBismillah = opensWithBismillah
                && firstAyahOnPage
                && firstAyahOnPage.numberInSurah === 1
                && splitLeadingBismillah(firstAyahOnPage.text).bismillah;

            if (showBismillah) {
                html += `<div class="bismillah">${showBismillah}</div>`;
            }

            html += '<div class="ayahs-container">';
            page.ayahs.forEach((ayah, idx) => {
                let ayahText = ayah.text;

                if (ayah.numberInSurah === 1 && opensWithBismillah) {
                    ayahText = splitLeadingBismillah(ayahText).rest;
                    ayahText = ayahText.replace(/﷽\s*/g, '').trim();
                }

                html += `<span class="ayah" data-ayah-number="${ayah.number}" id="ayah-${ayah.number}">${ayahText} <span class="ayah-number">${ayah.numberInSurah}</span>`;
                // One of the 15 prostration ayahs — mark it the way a printed
                // mushaf does, so the reader knows to prostrate here.
                if (quranIndex && quranIndex.isSajdaAyah(currentSurah, ayah.numberInSurah)) {
                    html += ` <span class="sajda-mark" title="موضع سجدة">۩ سجدة</span>`;
                }
                if (idx < page.ayahs.length - 1) {
                    html += ` <span class="ayah-separator">•</span> `;
                }
                html += `</span>`;
            });
            html += '</div>';

            // Reader pages are 10-ayah chunks, not mushaf pages. Show the real
            // mushaf page too so the position is meaningful outside the app.
            const juz = surahToJuz[currentSurah];
            const firstAyah = page.ayahs[0]?.numberInSurah;
            const mushafPage = (quranIndex && firstAyah)
                ? ` • ص ${quranIndex.pageForAyah(currentSurah, firstAyah)} بالمصحف`
                : '';
            html += `<div class="page-number">الجزء ${juz} • صفحة ${page.pageNum} من ${totalPages}${mushafPage}</div>`;
            html += '</div>';

            content.innerHTML = html;
        }

        function renderMushafPage(content, page) {
            const mushafPageNumber = getMushafPageNumber(page);
            const juz = surahToJuz[currentSurah];
            const imageCandidates = buildMushafPageImageCandidates(mushafPageNumber);

            let html = '<div class="page-content mushaf-page-content">';

            if (currentPageIndex === 0) {
                html += `
                    <div class="page-header mushaf-page-header">
                        <div class="surah-name">${page.surahName}</div>
                        <div class="surah-info">${page.surahEnglish} • ${page.revelationType} • ${page.numberOfAyahs} آيات</div>
                    </div>
                `;
            }

            html += `
                <div class="mushaf-stage">
                    <div class="mushaf-stage-status" data-mushaf-status>
                        <div class="spinner"></div>
                        <p>جار تحميل صفحة المصحف...</p>
                    </div>
                    <img class="mushaf-page-image is-loading" data-mushaf-image src="${imageCandidates[0]}" alt="صفحة المصحف ${mushafPageNumber}" loading="eager" fetchpriority="high" decoding="async" draggable="false">
                </div>
                <div class="mushaf-page-meta">الجزء ${juz} • صفحة المصحف ${mushafPageNumber} • صفحة ${currentPageIndex + 1} من ${totalPages}</div>
            `;

            html += '</div>';

            content.innerHTML = html;

            const pageImage = content.querySelector('[data-mushaf-image]');
            const status = content.querySelector('[data-mushaf-status]');

            if (!pageImage || !status) return;

            let finalized = false;
            let activeCandidateIndex = 0;

            function cleanupListeners() {
                pageImage.removeEventListener('load', handleLoad);
                pageImage.removeEventListener('error', handleError);
            }

            function setLoadingState(message) {
                if (finalized) return;
                pageImage.classList.remove('is-error');
                pageImage.classList.add('is-loading');
                status.classList.remove('hidden', 'error');
                status.innerHTML = `<div class="spinner"></div><p>${message}</p>`;
            }

            const markLoaded = () => {
                if (finalized) return;
                finalized = true;
                cleanupListeners();
                pageImage.classList.remove('is-loading');
                status.classList.add('hidden');
            };

            const markError = () => {
                if (finalized) return;
                finalized = true;
                cleanupListeners();
                pageImage.classList.add('is-error');
                status.classList.remove('hidden');
                status.classList.add('error');
                status.innerHTML = '<i class="bi bi-exclamation-circle" aria-hidden="true"></i><p>تعذر تحميل صفحة المصحف الآن. يمكنك المتابعة في نمط النص.</p>';
            };

            const tryNextCandidate = () => {
                if (activeCandidateIndex >= imageCandidates.length - 1) {
                    markError();
                    return;
                }

                activeCandidateIndex += 1;
                setLoadingState('تعذر العثور على النسخة المحلية، جار التحميل الاحتياطي...');
                pageImage.src = imageCandidates[activeCandidateIndex];
            };

            function handleLoad() {
                markLoaded();
            }

            function handleError() {
                tryNextCandidate();
            }

            pageImage.addEventListener('load', handleLoad);
            pageImage.addEventListener('error', handleError);

            if (pageImage.complete) {
                if (pageImage.naturalWidth > 0) {
                    markLoaded();
                } else {
                    handleError();
                }
            }
        }

        function renderCurrentPage() {
            if (pages.length === 0 || currentPageIndex >= pages.length) return;

            // If in tafsir mode, load tafsir instead
            if (tafsirMode) {
                loadTafsirForCurrentPage();
                return;
            }
            tafsirLoadToken++; // drop any tafsir still in flight

            const page = pages[currentPageIndex];
            const content = document.getElementById('quranContent');
            if (!content || !page) return;

            if (readerDisplayMode === READER_DISPLAY_MUSHAF) {
                renderMushafPage(content, page);
            } else {
                renderTextPage(content, page);
            }

            hideAyahQuickActions({ immediate: true });
            savePageForCurrentSurah();
            updateReaderProgressUI();
            updateScrollTopButtonVisibility();
            updateMemorizationCoachUI();

            if (window.recordHabitActivity) {
                window.recordHabitActivity('quran');
            }
            if (window.touchBookmarkVisitByLocation && currentSurah) {
                window.touchBookmarkVisitByLocation(currentSurah, resolveBookmarkPageIndex());
            }

            const shareModal = document.getElementById('shareAyahModal');
            if (shareModal && shareModal.classList.contains('active')) {
                populateShareAyahOptions();
                updateShareCardPreview();
            }
        }

        function nextPage() {
            if (totalPages <= 0) return; // still loading
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
            if (totalPages <= 0) return; // still loading
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
                icon: '<i class="bi bi-folder-plus" aria-hidden="true"></i>',
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
            const bookmarkPageIndex = resolveBookmarkPageIndex();

            // Check if this exact bookmark already exists
            const existingBookmarks = bookmarks.filter(b => b.surah === currentSurah && b.page === bookmarkPageIndex);

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
                        !(bookmark.surah === currentSurah && bookmark.page === bookmarkPageIndex)
                    );
                    saveStoredBookmarks(remaining);
                }
                showModal({
                    type: 'info',
                    icon: '<i class="bi bi-info-circle-fill" aria-hidden="true"></i>',
                    title: 'تم الإلغاء',
                    message: 'تم إلغاء حفظ الموضع'
                });
                updateBookmarkButton();
            } else {
                openBookmarkFolderPicker((folderName) => {
                    const latestBookmarks = getStoredBookmarks();
                    const alreadySaved = latestBookmarks.some(bookmark =>
                        bookmark.surah === currentSurah && bookmark.page === bookmarkPageIndex
                    );

                    if (alreadySaved) {
                        showModal({
                            type: 'info',
                            icon: '<i class="bi bi-info-circle-fill" aria-hidden="true"></i>',
                            title: 'الموضع محفوظ بالفعل',
                            message: 'هذا الموضع محفوظ مسبقاً.'
                        });
                        updateBookmarkButton();
                        return;
                    }

                    const newBookmark = window.createBookmarkEntry
                        ? window.createBookmarkEntry({ surah: currentSurah, page: bookmarkPageIndex, folder: folderName })
                        : {
                            surah: currentSurah,
                            page: bookmarkPageIndex,
                            folder: folderName,
                            timestamp: Date.now()
                        };

                    latestBookmarks.push(newBookmark);
                    saveStoredBookmarks(latestBookmarks);
                    showModal({
                        type: 'success',
                        icon: '<i class="bi bi-check-circle-fill" aria-hidden="true"></i>',
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
            const bookmarkPageIndex = resolveBookmarkPageIndex();
            const headerBtn = document.getElementById('headerBookmarkBtn');
            const mushafBtn = document.getElementById('mushafBookmarkBtn');

            const isBookmarked = bookmarks.some(b => b.surah === currentSurah && b.page === bookmarkPageIndex);

            [headerBtn, mushafBtn].forEach(btn => {
                if (!btn) return;

                if (isBookmarked) {
                    btn.classList.add('saved');
                    const icon = btn.querySelector('i');
                    if (icon) icon.className = 'bi bi-bookmark-fill';
                } else {
                    btn.classList.remove('saved');
                    const icon = btn.querySelector('i');
                    if (icon) icon.className = 'bi bi-bookmark';
                }
            });

            if (mushafBtn) {
                const label = mushafBtn.querySelector('span');
                if (label) {
                    label.textContent = isBookmarked ? 'محفوظ' : 'حفظ';
                }
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
                <div class="bookmark-item">
                    <button type="button" class="bookmark-info" onclick="loadBookmark(` + index + `)">
                        <span class="bookmark-name">` + surahInfo[bookmark.surah - 1].name + `</span>
                        <span class="bookmark-details">صفحة ` + (bookmark.page + 1) + `</span>
                    </button>
                    <div class="bookmark-actions">
                        <button type="button" class="bookmark-delete-btn" aria-label="حذف العلامة"
                            onclick="deleteBookmark(` + index + `)"><i class="bi bi-trash-fill" aria-hidden="true"></i></button>
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
                currentPageIndex = resolveReaderPageIndexFromTextIndex(bookmark.page);
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
                    currentPageIndex = resolveReaderPageIndexFromTextIndex(lastBookmark.page);
                    renderCurrentPage();
                    updateNavigation();
                }, 100);
            }
        }

        renderSurahList();
        renderQuickAccess();
        initReaderFontLevel();
        initReaderDisplayMode();
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

        const searchParam = (urlParams.get('search') || '').trim();
        if (searchParam && !surahParam) {
            const searchInput = document.getElementById('surahSearch');
            if (searchInput) {
                searchInput.value = searchParam;
                onSearchInput();
                searchInput.focus();
            }
        }

        // Load theme settings
        function loadThemeSettings() {
            /* handled by js/theme-preload.js */
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
            // A11y.openDialog owns Escape while a dialog is up; the mushaf
            // shortcuts only apply when nothing is layered over the reader.
            if (window.A11y && window.A11y.isDialogOpen()) return;
            if (document.querySelector('.modal-overlay.active')) return;

            const targetTag = event.target?.tagName;
            if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
                return;
            }

            if (event.key === 'Escape' && readerDisplayMode === READER_DISPLAY_MUSHAF) {
                event.preventDefault();
                exitMushafFocusMode();
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

            // Playback spans the whole surah while the screen shows one page;
            // turn the page when the recitation moves past it.
            if (!tafsirMode) {
                const ayahPageIndex = pages.findIndex(p => Array.isArray(p.ayahs) && p.ayahs.some(a => a.number === ayah.number));
                if (ayahPageIndex >= 0 && ayahPageIndex !== currentPageIndex) {
                    currentPageIndex = ayahPageIndex;
                    renderCurrentPage();
                    updateNavigation();
                    scrollReaderToTop(true);
                }
            }

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
                icon.setAttribute('aria-hidden', 'true');
            }
            // The icon is the button's only content, so the accessible name has
            // to follow the state or the control keeps announcing "تشغيل".
            playBtn.setAttribute('aria-label', isPlaying ? 'إيقاف مؤقت' : 'تشغيل');
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
            seekToAyahIndex(Math.floor(percentage * allAyahs.length));
        }

        // Shared by the pointer handler above and the keyboard handler below so
        // the slider behaves identically however it is driven.
        function seekToAyahIndex(targetIndex) {
            if (allAyahs.length === 0) return;

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

        // Keyboard driving for the `role="slider"` progress bar. The bar reads
        // right-to-left, so ArrowRight steps backwards like the visual seek does.
        (function initAudioProgressKeyboard() {
            const progress = document.getElementById('audioProgress');
            if (!progress) return;

            progress.addEventListener('keydown', (event) => {
                if (allAyahs.length === 0) return;
                let target = null;

                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    target = currentAyahIndex + 1;
                } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    target = currentAyahIndex - 1;
                } else if (event.key === 'PageUp') {
                    target = currentAyahIndex + 5;
                } else if (event.key === 'PageDown') {
                    target = currentAyahIndex - 5;
                } else if (event.key === 'Home') {
                    target = 0;
                } else if (event.key === 'End') {
                    target = allAyahs.length - 1;
                } else {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                seekToAyahIndex(Math.max(0, Math.min(allAyahs.length - 1, target)));
            });
        })();

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

            const slider = document.getElementById('audioProgress');
            if (slider) {
                slider.setAttribute('aria-valuenow', String(Math.round(progress)));
                const ayah = allAyahs[currentAyahIndex];
                slider.setAttribute(
                    'aria-valuetext',
                    ayah
                        ? `الآية ${ayah.numberInSurah} من ${allAyahs.length} • ${Math.round(progress)}%`
                        : `${Math.round(progress)}%`
                );
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
                listenBtn.innerHTML = '<i class="bi bi-hourglass-split" aria-hidden="true"></i><span>جار التحميل</span>';
            } else if (isTargetPlaying) {
                listenBtn.innerHTML = '<i class="bi bi-stop-fill" aria-hidden="true"></i><span>إيقاف</span>';
            } else {
                listenBtn.innerHTML = '<i class="bi bi-volume-up" aria-hidden="true"></i><span>استماع</span>';
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

        /* Immersive reading ------------------------------------------------- */
        const IMMERSION_HINT_SEEN_KEY = 'readerImmersionHintSeenV1';
        let immersionHintTimer = null;

        function showImmersionHint(message) {
            let hint = document.getElementById('immersionHint');
            if (!hint) {
                hint = document.createElement('div');
                hint.id = 'immersionHint';
                hint.className = 'immersion-hint';
                hint.setAttribute('role', 'status');
                document.body.appendChild(hint);
            }
            hint.textContent = message;
            // Next frame so the opacity transition actually runs.
            requestAnimationFrame(() => hint.classList.add('visible'));

            clearTimeout(immersionHintTimer);
            immersionHintTimer = setTimeout(() => {
                hint.classList.remove('visible');
            }, 2600);
        }

        function setReaderImmersion(enabled) {
            document.body.classList.toggle('reader-immersive', enabled);

            if (!enabled) return;
            // Explain the way out the first time, so the chrome never feels lost.
            let seen = false;
            try {
                seen = localStorage.getItem(IMMERSION_HINT_SEEN_KEY) === '1';
            } catch (_error) { /* storage blocked — just show the hint */ }

            if (!seen) {
                showImmersionHint('اضغط على أي فراغ لإظهار الأدوات');
                try { localStorage.setItem(IMMERSION_HINT_SEEN_KEY, '1'); } catch (_error) { }
            }
        }

        function toggleReaderImmersion() {
            setReaderImmersion(!document.body.classList.contains('reader-immersive'));
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

            // Immersive reading: a tap on blank page area hides/shows the chrome.
            // Ayahs and controls are excluded so their own actions still work.
            content.addEventListener('click', (event) => {
                if (!isReaderViewActive()) return;
                if (document.body.classList.contains('mushaf-focus-mode')) return;
                if (event.target.closest(
                    '.ayah[data-ayah-number], button, a, input, textarea, select, .ayah-quick-actions, .reader-offline-state'
                )) return;

                toggleReaderImmersion();
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
                playBtn.innerHTML = '<i class="bi bi-volume-up" aria-hidden="true"></i><span>استماع</span>';
                repeatBtn.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i><span>تكرار</span>';
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
                playBtn.innerHTML = '<i class="bi bi-volume-up" aria-hidden="true"></i><span>استماع</span>';
                repeatBtn.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i><span>تكرار</span>';
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
                ? '<i class="bi bi-eye-slash" aria-hidden="true"></i><span>إخفاء</span>'
                : '<i class="bi bi-eye" aria-hidden="true"></i><span>إظهار</span>';

            const ayahKey = String(ayah.number);
            const isMemorized = Boolean(memorizedAyahsByNumber[ayahKey]);
            doneBtn.classList.toggle('done', isMemorized);
            doneBtn.innerHTML = isMemorized
                ? '<i class="bi bi-patch-check-fill" aria-hidden="true"></i><span>محفوظة</span>'
                : '<i class="bi bi-check2-circle" aria-hidden="true"></i><span>تم الحفظ</span>';

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
                playBtn.innerHTML = '<i class="bi bi-hourglass-split" aria-hidden="true"></i><span>جار التحميل</span>';
            } else if (isPlayingCurrentAyah) {
                playBtn.innerHTML = '<i class="bi bi-stop-fill" aria-hidden="true"></i><span>إيقاف</span>';
            } else {
                playBtn.innerHTML = '<i class="bi bi-volume-up" aria-hidden="true"></i><span>استماع</span>';
            }

            repeatBtn.innerHTML = memorizationRepeatEnabled
                ? '<i class="bi bi-arrow-repeat" aria-hidden="true"></i><span>تكرار شغال</span>'
                : '<i class="bi bi-arrow-repeat" aria-hidden="true"></i><span>تكرار</span>';

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
            if (!modal) return;

            modal.classList.add('active');

            if (window.A11y) {
                window.A11y.openDialog(modal, {
                    panel: modal.querySelector('.share-modal-content'),
                    onClose: function () {
                        modal.classList.remove('active');
                    }
                });
            }
        }

        function closeShareAyahModal() {
            const modal = document.getElementById('shareAyahModal');
            if (!modal) return;

            if (window.A11y && window.A11y.isDialogOpen(modal)) {
                window.A11y.closeDialog(modal);
                return;
            }
            modal.classList.remove('active');
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
            if (!modal) return;

            modal.classList.add('active');
            updateReciterSelection();

            // Focus trap, scroll lock, Escape-to-close and focus restore.
            if (window.A11y) {
                window.A11y.openDialog(modal, {
                    panel: modal.querySelector('.reciter-modal-content'),
                    initialFocus: modal.querySelector('.reciter-item.active') || undefined,
                    onClose: function () {
                        modal.classList.remove('active');
                    }
                });
            }
        }

        function closeReciterModal() {
            const modal = document.getElementById('reciterModal');
            if (!modal) return;

            if (window.A11y && window.A11y.isDialogOpen(modal)) {
                // closeDialog runs onClose, which drops the class and restores focus.
                window.A11y.closeDialog(modal);
                return;
            }
            modal.classList.remove('active');
        }

        function selectReciter(reciterCode, reciterName) {
            currentReciter = reciterCode;
            try { localStorage.setItem('quranReciterV1', reciterCode); } catch (_error) { /* ignore */ }

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
                const selected = item.dataset.reciter === currentReciter;
                item.classList.toggle('active', selected);
                item.setAttribute('aria-pressed', selected ? 'true' : 'false');
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
            const token = ++tafsirLoadToken;

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
                            arabicText: ayahTextWithoutBismillah(ayah),
                            tafsirText: data.data.text
                        };
                    } catch (error) {
                        console.error('Error loading tafsir for ayah', ayah.number, error);
                        return {
                            ayahNumber: ayah.numberInSurah,
                            arabicText: ayahTextWithoutBismillah(ayah),
                            tafsirText: 'عذراً، لم نتمكن من تحميل تفسير هذه الآية'
                        };
                    }
                });

                const tafsirData = await Promise.all(tafsirPromises);
                // Page flipped or tafsir switched off while these were loading.
                if (token !== tafsirLoadToken || !tafsirMode) return;

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
                const pageLabel = readerDisplayMode === READER_DISPLAY_MUSHAF
                    ? `صفحة المصحف ${getMushafPageNumber(page)} • صفحة ${currentPageIndex + 1} من ${totalPages}`
                    : `صفحة ${page.pageNum} من ${totalPages}`;
                html += `<div class="page-number">الجزء ${juz} • ${pageLabel}</div>`;
                html += '</div>';

                content.innerHTML = html;

                const shareModal = document.getElementById('shareAyahModal');
                if (shareModal && shareModal.classList.contains('active')) {
                    populateShareAyahOptions();
                    updateShareCardPreview();
                }

            } catch (error) {
                console.error('Error loading tafsir:', error);
                if (token !== tafsirLoadToken || !tafsirMode) return;
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
