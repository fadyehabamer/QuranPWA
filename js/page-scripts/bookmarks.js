const surahInfo = window.QURAN_SURAHS;

        function renderBookmarks() {
            const allBookmarks = getBookmarksLibrary().slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const content = document.getElementById('bookmarksContent');
            const stats = document.getElementById('bookmarksStats');
            const controls = document.getElementById('bookmarksControls');
            const resultMeta = document.getElementById('filtersResultMeta');
            const foldersOverview = document.getElementById('foldersOverview');

            if (allBookmarks.length === 0) {
                content.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="bi bi-bookmark" aria-hidden="true" style="font-size: 80px;"></i></div>
                        <h3 class="empty-state-title">لا توجد مواضع محفوظة</h3>
                        <p class="empty-state-desc">لم تقم بحفظ أي موضع بعد.<br>اذهب إلى أي سورة واضغط على "حفظ الموضع" لحفظ مكان قراءتك.</p>
                        <a href="/quran" class="empty-state-btn"><i class="bi bi-book-fill" aria-hidden="true"></i> ابدأ القراءة</a>
                    </div>
                `;
                if (stats) stats.style.display = 'none';
                if (controls) controls.style.display = 'none';
                if (resultMeta) resultMeta.textContent = '0 نتيجة';
                if (foldersOverview) foldersOverview.style.display = 'none';
                renderRecentBookmarks([]);
                return;
            }

            if (stats) stats.style.display = 'flex';
            if (controls) {
                controls.style.display = 'block';
                setFiltersPanelVisibility(filtersPanelHidden, false);
            }

            const uniqueSurahs = new Set(allBookmarks.map(bookmark => bookmark.surah));
            const allFolders = getAllFolders(allBookmarks);
            const recentVisitedCount = allBookmarks.filter(bookmark => (bookmark.lastVisited || 0) > 0).length;

            document.getElementById('totalBookmarks').textContent = allBookmarks.length;
            document.getElementById('totalSurahs').textContent = uniqueSurahs.size;
            document.getElementById('totalFolders').textContent = allFolders.length;
            document.getElementById('recentVisits').textContent = recentVisitedCount;

            renderFilterOptions(allBookmarks);
            renderFoldersOverview(allBookmarks);
            renderRecentBookmarks();

            const filteredBookmarks = filterBookmarks(allBookmarks);
            const sortedFilteredBookmarks = sortBookmarks(filteredBookmarks);

            if (resultMeta) {
                resultMeta.textContent = `${sortedFilteredBookmarks.length} نتيجة من ${allBookmarks.length}`;
            }

            if (filteredBookmarks.length === 0) {
                content.innerHTML = '<div class="no-results">لا توجد نتائج مطابقة للفلاتر الحالية.</div>';
                return;
            }

            const folders = getAllFolders(allBookmarks);

            const html = `
                <div class="bookmarks-list">
                    ${sortedFilteredBookmarks.map((bookmark) => {
                const surah = surahInfo[bookmark.surah - 1] || { name: 'سورة', type: '' };
                const createdText = formatTimeAgo(new Date(bookmark.timestamp || Date.now()));
                const visitText = bookmark.lastVisited
                    ? `آخر زيارة ${formatTimeAgo(new Date(bookmark.lastVisited))}`
                    : 'لم تتم زيارته بعد';
                const tags = Array.isArray(bookmark.tags) ? bookmark.tags : [];
                const tagsHtml = tags.length
                    ? `<div class="bookmark-tags-row">${tags.map(tag => `<span class="bookmark-tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>`
                    : '';
                const noteHtml = bookmark.note
                    ? `<div class="bookmark-note-preview">${escapeHtml(bookmark.note)}</div>`
                    : '';
                const encodedId = encodeBookmarkId(bookmark.id);
                const controlId = toControlId(bookmark.id);
                const folderOptionsHtml = folders.map(folder => `
                    <option value="${escapeHtml(folder)}" ${folder === (bookmark.folder || 'عام') ? 'selected' : ''}>${escapeHtml(folder)}</option>
                `).join('');

                return `
                            <div class="bookmark-card">
                                <div class="bookmark-head">
                                    <div class="bookmark-surah-name">${surah.name}</div>
                                    <span class="bookmark-folder-chip">${escapeHtml(bookmark.folder || 'عام')}</span>
                                </div>

                                <div class="bookmark-details">
                                    <div class="bookmark-detail-item">
                                        <i class="bi bi-file-earmark-text" aria-hidden="true"></i>
                                        <span>صفحة ${(bookmark.page || 0) + 1}</span>
                                    </div>
                                    <div class="bookmark-detail-item">
                                        <span aria-hidden="true">•</span>
                                        <span>${surah.type || ''}</span>
                                    </div>
                                </div>

                                <div class="bookmark-timestamp">${createdText} • ${visitText}</div>
                                ${tagsHtml}
                                ${noteHtml}

                                <div class="bookmark-actions">
                                    <button class="bookmark-btn bookmark-btn-primary" type="button" onclick="loadBookmark('${encodedId}')">
                                        <i class="bi bi-book-fill" aria-hidden="true"></i> متابعة القراءة
                                    </button>
                                    <button class="bookmark-btn bookmark-btn-delete" type="button" aria-label="حذف" onclick="deleteBookmark('${encodedId}')">
                                        <i class="bi bi-trash-fill" aria-hidden="true"></i>
                                    </button>
                                </div>

                                <div class="bookmark-editor">
                                    <div class="bookmark-editor-grid">
                                        <div class="control-field">
                                            <label class="control-label" for="folder_${controlId}">المجلد</label>
                                            <select id="folder_${controlId}" class="control-select">${folderOptionsHtml}</select>
                                        </div>
                                        <div class="control-field">
                                            <label class="control-label" for="tags_${controlId}">الوسوم (مفصولة بفاصلة)</label>
                                            <input id="tags_${controlId}" class="control-input" type="text" value="${escapeHtml(tags.join('، '))}">
                                        </div>
                                        <div class="control-field">
                                            <label class="control-label" for="note_${controlId}">ملاحظة</label>
                                            <textarea id="note_${controlId}" class="control-input">${escapeHtml(bookmark.note || '')}</textarea>
                                        </div>
                                    </div>
                                    <button class="bookmark-btn bookmark-btn-secondary" type="button" onclick="saveBookmarkMeta('${encodedId}')">
                                        <i class="bi bi-floppy-fill" aria-hidden="true"></i> حفظ التعديلات
                                    </button>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;

            content.innerHTML = html;
        }

        const bookmarkFilters = {
            search: '',
            folder: '',
            tag: '',
            sort: 'recent'
        };
        const FILTERS_PANEL_HIDDEN_KEY = 'bookmarksFiltersPanelHiddenV1';
        let filtersPanelHidden = false;
        const FOLDERS_OVERVIEW_HIDDEN_KEY = 'bookmarksFoldersOverviewHiddenV1';
        let foldersOverviewHidden = false;

        function loadFiltersPanelVisibilityPreference() {
            try {
                filtersPanelHidden = localStorage.getItem(FILTERS_PANEL_HIDDEN_KEY) === '1';
            } catch (_error) {
                filtersPanelHidden = false;
            }
        }

        function updateFiltersPanelToggleButton() {
            const toggleBtn = document.getElementById('bookmarksControlsToggleBtn');
            if (!toggleBtn) return;

            const isShown = !filtersPanelHidden;
            toggleBtn.setAttribute('aria-pressed', isShown ? 'true' : 'false');
            toggleBtn.innerHTML = isShown
                ? '<i class="bi bi-toggle-on" aria-hidden="true"></i><span>إخفاء</span>'
                : '<i class="bi bi-toggle-off" aria-hidden="true"></i><span>إظهار</span>';
        }

        function setFiltersPanelVisibility(hidden, persist = true) {
            filtersPanelHidden = Boolean(hidden);

            const controls = document.getElementById('bookmarksControls');
            if (controls) {
                controls.classList.toggle('collapsed', filtersPanelHidden);
            }

            updateFiltersPanelToggleButton();

            if (persist) {
                try {
                    localStorage.setItem(FILTERS_PANEL_HIDDEN_KEY, filtersPanelHidden ? '1' : '0');
                } catch (_error) {
                    // Ignore localStorage write issues.
                }
            }
        }

        function toggleFiltersPanelVisibility() {
            setFiltersPanelVisibility(!filtersPanelHidden, true);
        }

        function loadFoldersOverviewVisibilityPreference() {
            try {
                foldersOverviewHidden = localStorage.getItem(FOLDERS_OVERVIEW_HIDDEN_KEY) === '1';
            } catch (_error) {
                foldersOverviewHidden = false;
            }
        }

        function updateFoldersOverviewToggleButton() {
            const toggleBtn = document.getElementById('foldersOverviewToggleBtn');
            if (!toggleBtn) return;

            const isShown = !foldersOverviewHidden;
            toggleBtn.setAttribute('aria-pressed', isShown ? 'true' : 'false');
            toggleBtn.innerHTML = isShown
                ? '<i class="bi bi-toggle-on" aria-hidden="true"></i><span>إخفاء</span>'
                : '<i class="bi bi-toggle-off" aria-hidden="true"></i><span>إظهار</span>';
        }

        function setFoldersOverviewVisibility(hidden, persist = true) {
            foldersOverviewHidden = Boolean(hidden);

            const section = document.getElementById('foldersOverview');
            if (section) {
                section.classList.toggle('collapsed', foldersOverviewHidden);
            }

            updateFoldersOverviewToggleButton();

            if (persist) {
                try {
                    localStorage.setItem(FOLDERS_OVERVIEW_HIDDEN_KEY, foldersOverviewHidden ? '1' : '0');
                } catch (_error) {
                    // Ignore localStorage write issues.
                }
            }
        }

        function toggleFoldersOverviewVisibility() {
            setFoldersOverviewVisibility(!foldersOverviewHidden, true);
        }

        function sortBookmarks(bookmarks) {
            const list = Array.isArray(bookmarks) ? bookmarks.slice() : [];

            switch (bookmarkFilters.sort) {
                case 'oldest':
                    return list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                case 'surah':
                    return list.sort((a, b) => {
                        const surahDiff = (a.surah || 0) - (b.surah || 0);
                        if (surahDiff !== 0) return surahDiff;
                        return (a.page || 0) - (b.page || 0);
                    });
                case 'visited':
                    return list.sort((a, b) => {
                        const visitsDiff = (b.visitCount || 0) - (a.visitCount || 0);
                        if (visitsDiff !== 0) return visitsDiff;
                        return (b.lastVisited || 0) - (a.lastVisited || 0);
                    });
                case 'recent':
                default:
                    return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            }
        }

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function encodeForHandler(value) {
            return encodeURIComponent(String(value || ''))
                .replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
        }

        function encodeBookmarkId(id) {
            return encodeForHandler(id);
        }

        function decodeBookmarkId(encodedId) {
            return decodeURIComponent(String(encodedId || ''));
        }

        function toControlId(bookmarkId) {
            return String(bookmarkId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
        }

        function getBookmarksLibrary() {
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

        function saveBookmarksLibrary(bookmarks) {
            if (window.saveBookmarkLibrary) {
                return window.saveBookmarkLibrary(bookmarks);
            }
            localStorage.setItem('quranBookmarks', JSON.stringify(bookmarks));
            return bookmarks;
        }

        function getAllFolders(bookmarks) {
            if (window.getBookmarkFolders) {
                return window.getBookmarkFolders();
            }
            return Array.from(new Set((bookmarks || []).map(bookmark => bookmark.folder || 'عام')));
        }

        function getAllTags(bookmarks) {
            if (window.getBookmarkTags) {
                return window.getBookmarkTags();
            }

            return Array.from(new Set((bookmarks || [])
                .flatMap(bookmark => Array.isArray(bookmark.tags) ? bookmark.tags : [])));
        }

        function renderFilterOptions(bookmarks) {
            const folderFilter = document.getElementById('folderFilter');
            const tagFilter = document.getElementById('tagFilter');
            if (!folderFilter || !tagFilter) return;

            const folders = getAllFolders(bookmarks);
            const tags = getAllTags(bookmarks);

            const fillSelect = (selectEl, placeholder, values, selectedValue) => {
                selectEl.innerHTML = '';

                const placeholderOption = document.createElement('option');
                placeholderOption.value = '';
                placeholderOption.textContent = placeholder;
                selectEl.appendChild(placeholderOption);

                values.forEach(value => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = value;
                    selectEl.appendChild(option);
                });

                selectEl.value = values.includes(selectedValue) ? selectedValue : '';
            };

            fillSelect(folderFilter, 'كل المجلدات', folders, bookmarkFilters.folder);
            fillSelect(tagFilter, 'كل الوسوم', tags, bookmarkFilters.tag);
            if (folderFilter) bookmarkFilters.folder = folderFilter.value;
            if (tagFilter) bookmarkFilters.tag = tagFilter.value;
        }

        function renderFoldersOverview(bookmarks) {
            const section = document.getElementById('foldersOverview');
            const list = document.getElementById('foldersOverviewList');
            if (!section || !list) return;

            const folderCounts = new Map();
            (bookmarks || []).forEach(bookmark => {
                const folder = String(bookmark.folder || 'عام').trim() || 'عام';
                folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
            });

            // Keep folder cards visible even when a folder currently has zero bookmarks.
            const knownFolders = getAllFolders(bookmarks)
                .map(folder => String(folder || '').trim())
                .filter(Boolean);
            if (!knownFolders.includes('عام')) {
                knownFolders.unshift('عام');
            }
            knownFolders.forEach(folder => {
                if (!folderCounts.has(folder)) {
                    folderCounts.set(folder, 0);
                }
            });

            const folders = Array.from(folderCounts.entries())
                .sort((a, b) => {
                    if (a[0] === 'عام') return -1;
                    if (b[0] === 'عام') return 1;
                    return a[0].localeCompare(b[0], 'ar');
                });

            if (!folders.length) {
                section.style.display = 'none';
                list.innerHTML = '';
                return;
            }

            const allCount = (bookmarks || []).length;
            const allActiveClass = bookmarkFilters.folder ? '' : 'active';

            let html = `
                <button class="folder-overview-card ${allActiveClass}" type="button" onclick="setFolderFilterByEncoded('')">
                    <span class="folder-overview-card-top">
                        <i class="bi bi-collection folder-overview-icon" aria-hidden="true"></i>
                        <span class="folder-overview-count">${allCount}</span>
                    </span>
                    <span class="folder-overview-name">كل المجلدات</span>
                    <span class="folder-overview-meta">عرض جميع المواضع</span>
                </button>
            `;

            folders.forEach(([folder, count]) => {
                const encodedFolder = encodeForHandler(folder);
                const activeClass = bookmarkFilters.folder === folder ? 'active' : '';
                html += `
                    <button class="folder-overview-card ${activeClass}" type="button" onclick="setFolderFilterByEncoded('${encodedFolder}')">
                        <span class="folder-overview-card-top">
                            <i class="bi ${activeClass ? 'bi-folder2-open' : 'bi-folder2'} folder-overview-icon" aria-hidden="true"></i>
                            <span class="folder-overview-count">${count}</span>
                        </span>
                        <span class="folder-overview-name">${escapeHtml(folder)}</span>
                        <span class="folder-overview-meta">${count === 1 ? 'موضع واحد' : `${count} مواضع`}</span>
                    </button>
                `;
            });

            list.innerHTML = html;
            section.style.display = 'block';
            setFoldersOverviewVisibility(foldersOverviewHidden, false);
        }

        function setFolderFilterByEncoded(encodedFolder) {
            bookmarkFilters.folder = encodedFolder ? decodeURIComponent(encodedFolder) : '';

            const folderFilter = document.getElementById('folderFilter');
            if (folderFilter) {
                folderFilter.value = bookmarkFilters.folder;
            }

            renderBookmarks();
        }

        function filterBookmarks(bookmarks) {
            const query = (bookmarkFilters.search || '').trim().toLowerCase();

            return (bookmarks || []).filter(bookmark => {
                const surahName = surahInfo[(bookmark.surah || 1) - 1]?.name || '';
                const folder = bookmark.folder || 'عام';
                const tags = Array.isArray(bookmark.tags) ? bookmark.tags.join(' ') : '';
                const note = bookmark.note || '';
                const searchableText = `${surahName} ${folder} ${tags} ${note} صفحة ${(bookmark.page || 0) + 1}`.toLowerCase();

                const matchesSearch = !query || searchableText.includes(query);
                const matchesFolder = !bookmarkFilters.folder || folder === bookmarkFilters.folder;
                const matchesTag = !bookmarkFilters.tag || (Array.isArray(bookmark.tags) && bookmark.tags.includes(bookmarkFilters.tag));

                return matchesSearch && matchesFolder && matchesTag;
            });
        }

        function renderRecentBookmarks(providedRecent) {
            const section = document.getElementById('recentBookmarksSection');
            const list = document.getElementById('recentBookmarksList');
            if (!section || !list) return;

            const recent = Array.isArray(providedRecent)
                ? providedRecent
                : (window.getRecentBookmarks ? window.getRecentBookmarks(4) : getBookmarksLibrary()
                    .filter(bookmark => (bookmark.lastVisited || 0) > 0)
                    .sort((a, b) => (b.lastVisited || 0) - (a.lastVisited || 0))
                    .slice(0, 4));

            if (!recent.length) {
                section.style.display = 'none';
                list.innerHTML = '';
                return;
            }

            section.style.display = 'block';
            list.innerHTML = recent.map(bookmark => {
                const surahName = surahInfo[(bookmark.surah || 1) - 1]?.name || 'سورة';
                const encodedId = encodeBookmarkId(bookmark.id);
                const visitTime = bookmark.lastVisited ? formatTimeAgo(new Date(bookmark.lastVisited)) : 'الآن';
                return `
                    <div class="recent-item">
                        <div class="recent-item-title">${surahName} - صفحة ${(bookmark.page || 0) + 1}</div>
                        <div class="recent-item-meta">${visitTime}</div>
                        <button class="recent-item-btn" type="button" aria-label="فتح ${surahName} - صفحة ${(bookmark.page || 0) + 1}" onclick="loadBookmark('${encodedId}')">فتح</button>
                    </div>
                `;
            }).join('');
        }

        function formatTimeAgo(date) {
            const now = new Date();
            const diff = now - date;
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return `منذ ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
            if (hours > 0) return `منذ ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}`;
            if (minutes > 0) return `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
            return 'الآن';
        }

        let filtersRenderTimer = null;

        function handleFiltersChange() {
            const searchEl = document.getElementById('bookmarkSearchInput');
            const searchValue = searchEl ? searchEl.value : '';
            const searchChanged = searchValue !== bookmarkFilters.search;
            bookmarkFilters.search = searchValue;
            bookmarkFilters.folder = document.getElementById('folderFilter')?.value || '';
            bookmarkFilters.tag = document.getElementById('tagFilter')?.value || '';
            bookmarkFilters.sort = document.getElementById('bookmarkSortSelect')?.value || 'recent';

            clearTimeout(filtersRenderTimer);
            if (searchChanged && document.activeElement === searchEl) {
                filtersRenderTimer = setTimeout(renderBookmarks, 150);
                return;
            }
            renderBookmarks();
        }

        function clearBookmarkFilters() {
            bookmarkFilters.search = '';
            bookmarkFilters.folder = '';
            bookmarkFilters.tag = '';
            bookmarkFilters.sort = 'recent';

            const searchInput = document.getElementById('bookmarkSearchInput');
            const folderFilter = document.getElementById('folderFilter');
            const tagFilter = document.getElementById('tagFilter');
            const sortSelect = document.getElementById('bookmarkSortSelect');

            if (searchInput) searchInput.value = '';
            if (folderFilter) folderFilter.value = '';
            if (tagFilter) tagFilter.value = '';
            if (sortSelect) sortSelect.value = 'recent';

            renderBookmarks();
        }

        function createFolderFromInput() {
            const input = document.getElementById('newFolderInput');
            const folderName = (input?.value || '').trim();
            if (!folderName) return;

            if (window.addBookmarkFolder) {
                window.addBookmarkFolder(folderName);
            } else {
                const key = (window.APP_STORAGE_KEYS && window.APP_STORAGE_KEYS.bookmarkFolders) || 'quranBookmarkFoldersV1';
                const existing = JSON.parse(localStorage.getItem(key) || '[]');
                const folders = Array.from(new Set([...(Array.isArray(existing) ? existing : []), folderName]));
                localStorage.setItem(key, JSON.stringify(folders));
            }

            input.value = '';
            renderBookmarks();
            if (window.A11y) window.A11y.announce(`تم إنشاء مجلد «${folderName}». اختره من محرر أي موضع لنقله إليه.`);
        }

        function loadBookmark(encodedBookmarkId) {
            const bookmarkId = decodeBookmarkId(encodedBookmarkId);
            const bookmark = getBookmarksLibrary().find(item => item.id === bookmarkId);
            if (!bookmark) return;

            if (window.touchBookmarkVisitById) {
                window.touchBookmarkVisitById(bookmarkId);
            }

            window.location.href = `/quran?surah=${bookmark.surah}&page=${bookmark.page}&bookmark=${encodeURIComponent(bookmark.id)}`;
        }

        function saveBookmarkMeta(encodedBookmarkId) {
            const bookmarkId = decodeBookmarkId(encodedBookmarkId);
            const controlId = toControlId(bookmarkId);

            const folder = (document.getElementById(`folder_${controlId}`)?.value || '').trim() || 'عام';
            const tagsRaw = document.getElementById(`tags_${controlId}`)?.value || '';
            const note = (document.getElementById(`note_${controlId}`)?.value || '').trim();
            const tags = Array.from(new Set(tagsRaw
                .split(/[,،]/)
                .map(tag => tag.trim())
                .filter(Boolean)
            ));

            if (window.updateBookmarkMetaById) {
                window.updateBookmarkMetaById(bookmarkId, { folder, tags, note });
            } else {
                const bookmarks = getBookmarksLibrary();
                const index = bookmarks.findIndex(bookmark => bookmark.id === bookmarkId);
                if (index === -1) return;
                bookmarks[index] = { ...bookmarks[index], folder, tags, note };
                saveBookmarksLibrary(bookmarks);
            }

            renderBookmarks();
            showModal({
                type: 'success',
                icon: '',
                title: 'تم الحفظ',
                message: 'تم تحديث المجلد والوسوم والملاحظة'
            });
        }

        function deleteBookmark(encodedBookmarkId) {
            const bookmarkId = decodeBookmarkId(encodedBookmarkId);
            showModal({
                type: 'warning',
                icon: '',
                title: 'حذف الموضع',
                message: 'هل أنت متأكد من حذف هذا الموضع المحفوظ؟',
                confirmText: 'نعم، احذف',
                cancelText: 'إلغاء',
                onConfirm: () => {
                    if (window.deleteBookmarkById) {
                        window.deleteBookmarkById(bookmarkId);
                    } else {
                        const bookmarks = getBookmarksLibrary();
                        const filtered = bookmarks.filter(bookmark => bookmark.id !== bookmarkId);
                        saveBookmarksLibrary(filtered);
                    }
                    renderBookmarks();
                    showModal({
                        type: 'success',
                        icon: '',
                        title: 'تم الحذف',
                        message: 'تم حذف الموضع المحفوظ بنجاح'
                    });
                }
            });
        }

        let currentModalConfirm = null;

        function showModal({ type = 'info', icon = '', title = '', message = '', confirmText = 'حسناً', cancelText = '', onConfirm = null }) {
            const modal = document.getElementById('customModal');
            const modalIcon = document.getElementById('modalIcon');
            const modalTitle = document.getElementById('modalTitle');
            const modalMessage = document.getElementById('modalMessage');
            const modalActions = document.getElementById('modalActions');

            modalIcon.textContent = icon;
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            currentModalConfirm = onConfirm;

            let actionsHTML = '';
            if (cancelText && onConfirm) {
                actionsHTML = `
                    <button class="modal-btn modal-btn-secondary" type="button" onclick="hideModal()">${cancelText}</button>
                    <button class="modal-btn modal-btn-primary" type="button" onclick="confirmModalAction()">${confirmText}</button>
                `;
            } else {
                actionsHTML = `<button class="modal-btn modal-btn-primary" type="button" onclick="hideModal()">${confirmText}</button>`;
            }
            modalActions.innerHTML = actionsHTML;

            modal.classList.add('active');

            if (window.A11y && !window.A11y.isDialogOpen(modal)) {
                window.A11y.openDialog(modal, {
                    panel: modal.querySelector('.modal'),
                    onClose: function () {
                        modal.classList.remove('active');
                        currentModalConfirm = null;
                    }
                });
            }
        }

        function confirmModalAction() {
            // Capture first: hideModal() clears currentModalConfirm via the dialog onClose hook.
            const confirmCallback = currentModalConfirm;
            hideModal();
            currentModalConfirm = null;
            if (confirmCallback) {
                confirmCallback();
            }
        }

        function hideModal() {
            const modal = document.getElementById('customModal');
            if (window.A11y && window.A11y.isDialogOpen(modal)) {
                window.A11y.closeDialog(modal);
                return;
            }
            modal.classList.remove('active');
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

        function adjustColor(color, amount) {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * amount);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255))
                .toString(16).slice(1);
        }

        // ---- Saved daily verses (from "آية اليوم" on the home screen) --------
        const SAVED_VERSES_KEY = 'savedDailyVerses';

        function loadSavedVersesList() {
            try {
                const raw = JSON.parse(localStorage.getItem(SAVED_VERSES_KEY) || '[]');
                return Array.isArray(raw) ? raw : [];
            } catch (_error) {
                return [];
            }
        }

        function savedVerseKey(v) {
            return `${v.surahNumber || v.surah}:${v.numberInSurah}`;
        }

        function removeSavedVerse(encodedKey) {
            const key = decodeURIComponent(String(encodedKey || ''));
            const next = loadSavedVersesList().filter(v => savedVerseKey(v) !== key);
            localStorage.setItem(SAVED_VERSES_KEY, JSON.stringify(next));
            renderSavedVerses();
        }

        function renderSavedVerses() {
            const section = document.getElementById('savedVersesSection');
            const listEl = document.getElementById('savedVersesList');
            if (!section || !listEl) return;

            const verses = loadSavedVersesList().slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
            if (verses.length === 0) {
                section.style.display = 'none';
                listEl.innerHTML = '';
                return;
            }

            section.style.display = 'block';
            listEl.innerHTML = verses.map(v => {
                const key = savedVerseKey(v);
                const ref = `${v.surah || ''} • آية ${v.numberInSurah}`;
                const openHref = v.surahNumber
                    ? `/quran?surah=${v.surahNumber}&ayah=${v.numberInSurah}`
                    : '/quran';
                return `
                    <div class="saved-verse-card glass-card">
                        <p class="saved-verse-text">${escapeHtml(v.text || '')}</p>
                        <div class="saved-verse-foot">
                            <span class="saved-verse-ref">${escapeHtml(ref)}</span>
                            <div class="saved-verse-actions">
                                <a class="saved-verse-open" href="${openHref}">فتح في المصحف</a>
                                <button type="button" class="saved-verse-remove" onclick="removeSavedVerse('${encodeForHandler(key)}')" aria-label="حذف الآية المحفوظة">
                                    <i class="bi bi-trash" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                    </div>`;
            }).join('');
        }

        window.removeSavedVerse = removeSavedVerse;

        document.addEventListener('DOMContentLoaded', () => {
            loadThemeSettings();
            loadFiltersPanelVisibilityPreference();
            loadFoldersOverviewVisibilityPreference();
            renderBookmarks();
            renderSavedVerses();
        });

