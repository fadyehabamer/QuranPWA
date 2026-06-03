let userLocation = null;
        let prayerTimes = null;
        let updateInterval = null;
        let locationMethod = null; // 'automatic' or 'manual'
        let qiblaBearing = null;
        let currentHeading = null;
        let qiblaOrientationStarted = false;
        let orientationPermissionGranted = false;
        let smoothedHeading = null;
        let displayedNeedleAngle = null;
        let orientationLastUpdateTs = 0;
        let absoluteOrientationSeen = false;
        let preferredHeadingSource = null;
        let headingSourceName = null;
        let lastRawHeading = null;
        let lastRawHeadingTs = 0;
        let lastAcceptedHeadingTs = 0;
        let headingUnstableUntilTs = 0;
        let headingUnstableReason = '';
        let orientationTiltPoor = false;
        let calibrationGuideInterval = null;
        let calibrationGuideEndsAt = 0;
        let calibrationGuideRunning = false;

        const ORIENTATION_UPDATE_INTERVAL_MS = 80;
        const HEADING_SMOOTH_FACTOR = 0.22;
        const NEEDLE_SMOOTH_FACTOR = 0.35;
        const MAX_HEADING_JUMP_DEG = 45;
        const OUTLIER_IGNORE_WINDOW_MS = 900;
        const HEADING_DEAD_BAND_DEG = 0.7;
        const CALIBRATION_HINT_HOLD_MS = 6000;
        const CALIBRATION_GUIDE_MS = 2000;
        const CALIBRATION_HINT_HIDDEN_STORAGE_KEY = 'qiblaCalibrationHintHiddenV1';
        const TILT_POOR_DEG = 65;
        const SHARED_COUNTRY_STORAGE_KEY = 'preferredManualCountryV1';
        const LEGACY_COUNTRY_STORAGE_KEY = 'selectedCountry';

        let allCountries = [];
        let calibrationHintManuallyHidden = localStorage.getItem(CALIBRATION_HINT_HIDDEN_STORAGE_KEY) === '1';

        const KAABA_COORDS = { latitude: 21.4225, longitude: 39.8262 };

        const prayerNames = {
            Fajr: 'الفجر',
            Sunrise: 'الشروق',
            Dhuhr: 'الظهر',
            Asr: 'العصر',
            Maghrib: 'المغرب',
            Isha: 'العشاء',
            Tahajjud: 'قيام الليل'
        };

        const prayerIcons = {
            Fajr: '🌅',
            Sunrise: '☀️',
            Dhuhr: '🌞',
            Asr: '🌇',
            Maghrib: '🌆',
            Isha: '🌙',
            Tahajjud: '⭐'
        };

        function getStoredCountrySelection() {
            const raw = localStorage.getItem(SHARED_COUNTRY_STORAGE_KEY) || localStorage.getItem(LEGACY_COUNTRY_STORAGE_KEY);
            if (!raw) return null;

            try {
                const country = JSON.parse(raw);
                if (!country || typeof country.lat !== 'number' || typeof country.lng !== 'number') {
                    return null;
                }
                return country;
            } catch (_error) {
                return null;
            }
        }

        function saveCountrySelection(country) {
            const payload = JSON.stringify(country);
            localStorage.setItem(SHARED_COUNTRY_STORAGE_KEY, payload);
            // Backward compatibility for existing code paths.
            localStorage.setItem(LEGACY_COUNTRY_STORAGE_KEY, payload);
            localStorage.setItem('locationText', country.name || 'الموقع المختار يدوياً');
            localStorage.setItem('userLocation', JSON.stringify({ latitude: country.lat, longitude: country.lng }));
        }

        function clearCountrySelection() {
            localStorage.removeItem(SHARED_COUNTRY_STORAGE_KEY);
            localStorage.removeItem(LEGACY_COUNTRY_STORAGE_KEY);
        }

        function toRadians(value) {
            return value * (Math.PI / 180);
        }

        function calculateQiblaBearing(latitude, longitude) {
            const lat1 = toRadians(latitude);
            const lng1 = toRadians(longitude);
            const lat2 = toRadians(KAABA_COORDS.latitude);
            const lng2 = toRadians(KAABA_COORDS.longitude);

            const y = Math.sin(lng2 - lng1);
            const x = Math.cos(lat1) * Math.tan(lat2) - Math.sin(lat1) * Math.cos(lng2 - lng1);
            return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        }

        function getDirectionName(degrees) {
            const names = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
            const index = Math.round((degrees % 360) / 45) % 8;
            return names[index];
        }

        function getAngularDifference(a, b) {
            return Math.abs((((a - b) + 540) % 360) - 180);
        }

        function normalizeAngle(deg) {
            return (deg % 360 + 360) % 360;
        }

        function shortestAngleDiff(fromDeg, toDeg) {
            return ((toDeg - fromDeg + 540) % 360) - 180;
        }

        function smoothAngle(fromDeg, toDeg, factor) {
            return normalizeAngle(fromDeg + shortestAngleDiff(fromDeg, toDeg) * factor);
        }

        function resolveHeadingSourceName(source) {
            if (source === 'webkit') return 'مستشعر iOS';
            if (source === 'absolute') return 'مستشعر مطلق';
            if (source === 'alpha') return 'مستشعر افتراضي';
            return 'غير متاح';
        }

        function extractHeadingFromOrientation(event) {
            if (typeof event.webkitCompassHeading === 'number') {
                if (typeof event.webkitCompassAccuracy === 'number' && event.webkitCompassAccuracy > 60) {
                    return null;
                }

                return {
                    source: 'webkit',
                    heading: normalizeAngle(event.webkitCompassHeading)
                };
            }

            if (typeof event.alpha !== 'number') {
                return null;
            }

            const isAbsoluteEvent = event.type === 'deviceorientationabsolute' || event.absolute === true;
            if (!isAbsoluteEvent) {
                return null;
            }

            return {
                source: event.type === 'deviceorientationabsolute' ? 'absolute' : 'alpha',
                heading: normalizeAngle(360 - event.alpha)
            };
        }

        function formatCalibrationCountdown(ms) {
            const safeMs = Math.max(0, ms);
            const seconds = Math.floor(safeMs / 1000);
            const centi = Math.floor((safeMs % 1000) / 10);
            return `${String(seconds).padStart(2, '0')}:${String(centi).padStart(2, '0')}`;
        }

        function clearCalibrationGuideInterval() {
            if (calibrationGuideInterval) {
                clearInterval(calibrationGuideInterval);
                calibrationGuideInterval = null;
            }
        }

        function updateCalibrationHintToggleUI() {
            const toggleBtn = document.getElementById('qiblaCalibrationToggleBtn');
            if (!toggleBtn) return;

            if (calibrationHintManuallyHidden) {
                toggleBtn.textContent = 'إظهار الإرشادات';
                toggleBtn.setAttribute('aria-pressed', 'true');
            } else {
                toggleBtn.textContent = 'إخفاء الإرشادات';
                toggleBtn.setAttribute('aria-pressed', 'false');
            }
        }

        function setCalibrationHintHidden(hidden) {
            calibrationHintManuallyHidden = hidden;
            localStorage.setItem(CALIBRATION_HINT_HIDDEN_STORAGE_KEY, hidden ? '1' : '0');
            updateCalibrationHintToggleUI();
        }

        function toggleQiblaCalibrationHint() {
            setCalibrationHintHidden(!calibrationHintManuallyHidden);
            updateQiblaDisplay();
        }

        function updateCalibrationGuideUI(showCalibration) {
            const calibrationBtn = document.getElementById('qiblaCalibrationBtn');
            const calibrationCountdown = document.getElementById('qiblaCalibrationCountdown');
            if (!calibrationBtn || !calibrationCountdown) return;

            if (!showCalibration) {
                calibrationCountdown.textContent = '';
                calibrationBtn.disabled = false;
                return;
            }

            if (!calibrationGuideRunning) {
                calibrationCountdown.textContent = '02:00';
                calibrationBtn.disabled = false;
                return;
            }

            const remainingMs = Math.max(0, calibrationGuideEndsAt - Date.now());
            calibrationCountdown.textContent = formatCalibrationCountdown(remainingMs);
            calibrationBtn.disabled = true;
        }

        function startQiblaCalibrationGuide() {
            const now = Date.now();

            // Always reveal the guide while a manual recalibration is in progress.
            setCalibrationHintHidden(false);

            calibrationGuideRunning = true;
            calibrationGuideEndsAt = now + CALIBRATION_GUIDE_MS;
            headingUnstableUntilTs = Math.max(headingUnstableUntilTs, now + CALIBRATION_GUIDE_MS + 600);
            headingUnstableReason = 'حرّك الهاتف الآن بشكل 8 حتى ينتهي العداد';

            clearCalibrationGuideInterval();
            updateQiblaDisplay();

            calibrationGuideInterval = setInterval(() => {
                const remaining = calibrationGuideEndsAt - Date.now();
                if (remaining <= 0) {
                    clearCalibrationGuideInterval();
                    calibrationGuideRunning = false;
                    headingUnstableUntilTs = Date.now() + 1600;
                    headingUnstableReason = 'تمت المعايرة، ثبّت الهاتف للحظة';
                    updateQiblaDisplay();
                    return;
                }

                updateQiblaDisplay();
            }, 100);
        }

        function updateQiblaDisplay() {
            const section = document.getElementById('qiblaSection');
            const needle = document.getElementById('qiblaNeedle');
            const meta = document.getElementById('qiblaMeta');
            const permissionBtn = document.getElementById('qiblaPermissionBtn');
            const calibrationHint = document.getElementById('qiblaCalibrationHint');
            const now = Date.now();

            if (!section || !needle || !meta) return;

            if (!userLocation || qiblaBearing === null) {
                section.style.display = 'none';
                if (calibrationHint) {
                    calibrationHint.classList.remove('active');
                }
                return;
            }

            section.style.display = 'block';

            const targetRotation = currentHeading === null
                ? qiblaBearing
                : (qiblaBearing - currentHeading + 360) % 360;

            if (displayedNeedleAngle === null) {
                displayedNeedleAngle = targetRotation;
            } else {
                displayedNeedleAngle = smoothAngle(displayedNeedleAngle, targetRotation, NEEDLE_SMOOTH_FACTOR);
            }
            needle.style.transform = `translateX(-50%) rotate(${displayedNeedleAngle.toFixed(1)}deg)`;

            const headingText = currentHeading === null
                ? 'غير متاح'
                : `${Math.round(currentHeading)}° (${getDirectionName(currentHeading)})`;
            const qiblaText = `${Math.round(qiblaBearing)}° (${getDirectionName(qiblaBearing)})`;

            let alignmentText = '';
            if (currentHeading !== null) {
                const diff = getAngularDifference(qiblaBearing, currentHeading);
                alignmentText = diff <= 10 ? ' • أنت قريب جدا من اتجاه القبلة' : ` • انحراف ${Math.round(diff)}°`;
            }

            const headingSourceText = headingSourceName ? ` • المصدر: ${headingSourceName}` : '';

            if (currentHeading === null) {
                meta.textContent = `اتجاه القبلة: ${qiblaText} • اتجاه الهاتف: ${headingText} • حرّك الهاتف بشكل أفقي أو فعّل إذن المستشعر`;
            } else {
                meta.textContent = `اتجاه القبلة: ${qiblaText} • اتجاه الهاتف: ${headingText}${alignmentText}${headingSourceText}`;
            }

            if (orientationTiltPoor) {
                meta.textContent += ' • وضع الهاتف غير مناسب، اجعله ثابتًا وبعيدًا عن المعادن';
            }

            const needsIOSPermission = typeof DeviceOrientationEvent !== 'undefined'
                && typeof DeviceOrientationEvent.requestPermission === 'function'
                && !orientationPermissionGranted
                && currentHeading === null;

            if (permissionBtn) {
                permissionBtn.style.display = needsIOSPermission ? 'inline-flex' : 'none';
            }

            if (calibrationHint) {
                const autoShowCalibration = currentHeading === null || calibrationGuideRunning || now < headingUnstableUntilTs;
                const showCalibration = autoShowCalibration && !calibrationHintManuallyHidden;

                calibrationHint.classList.toggle('active', showCalibration);

                if (showCalibration && headingUnstableReason) {
                    const label = calibrationHint.querySelector('.qibla-calibration-text');
                    if (label) {
                        label.textContent = `حرّك الهاتف بحركة شكل 8 لمدة ثانيتين (${headingUnstableReason})`;
                    }
                } else {
                    const label = calibrationHint.querySelector('.qibla-calibration-text');
                    if (label) {
                        label.textContent = 'حرّك الهاتف بحركة شكل 8 لمدة ثانيتين لمعايرة البوصلة';
                    }
                }

                updateCalibrationGuideUI(showCalibration);
            }

            updateCalibrationHintToggleUI();
        }

        function handleDeviceOrientation(event) {
            const now = Date.now();
            if (now - orientationLastUpdateTs < ORIENTATION_UPDATE_INTERVAL_MS) {
                return;
            }

            if (event.type === 'deviceorientationabsolute') {
                absoluteOrientationSeen = true;
            }

            const sample = extractHeadingFromOrientation(event);
            if (!sample) {
                return;
            }

            if (preferredHeadingSource === 'webkit' && sample.source !== 'webkit') {
                return;
            }

            if (preferredHeadingSource === null) {
                preferredHeadingSource = sample.source;
                headingSourceName = resolveHeadingSourceName(sample.source);
            }

            const hasTiltData = typeof event.beta === 'number' && typeof event.gamma === 'number';
            if (hasTiltData) {
                const maxTilt = Math.max(Math.abs(event.beta), Math.abs(event.gamma));
                orientationTiltPoor = maxTilt > TILT_POOR_DEG;

                if (orientationTiltPoor && sample.source !== 'webkit') {
                    headingUnstableUntilTs = now + CALIBRATION_HINT_HOLD_MS;
                    headingUnstableReason = 'ثبّت الهاتف على سطح غير معدني ومستوٍ';
                    updateQiblaDisplay();
                    return;
                }
            }

            const normalized = sample.heading;

            if (lastRawHeading !== null) {
                const jump = getAngularDifference(lastRawHeading, normalized);
                const dt = now - lastRawHeadingTs;
                if (jump > MAX_HEADING_JUMP_DEG && dt < OUTLIER_IGNORE_WINDOW_MS) {
                    headingUnstableUntilTs = now + CALIBRATION_HINT_HOLD_MS;
                    headingUnstableReason = 'القراءة غير مستقرة، أعد المعايرة بحركة 8';
                    updateQiblaDisplay();
                    return;
                }
            }

            lastRawHeading = normalized;
            lastRawHeadingTs = now;

            if (smoothedHeading === null) {
                smoothedHeading = normalized;
            } else {
                const delta = getAngularDifference(smoothedHeading, normalized);
                if (delta < HEADING_DEAD_BAND_DEG) {
                    return;
                }
                smoothedHeading = smoothAngle(smoothedHeading, normalized, HEADING_SMOOTH_FACTOR);
            }

            currentHeading = smoothedHeading;
            orientationLastUpdateTs = now;
            lastAcceptedHeadingTs = now;
            updateQiblaDisplay();
        }

        function startQiblaOrientation() {
            if (qiblaOrientationStarted) return;
            if (typeof window.DeviceOrientationEvent === 'undefined') {
                updateQiblaDisplay();
                return;
            }

            window.addEventListener('deviceorientationabsolute', handleDeviceOrientation, true);
            window.addEventListener('deviceorientation', handleDeviceOrientation, true);
            qiblaOrientationStarted = true;
        }

        async function requestQiblaPermission() {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const result = await DeviceOrientationEvent.requestPermission();
                    if (result === 'granted') {
                        orientationPermissionGranted = true;
                        startQiblaOrientation();
                    }
                } catch (error) {
                    console.error('Orientation permission error:', error);
                }
            } else {
                orientationPermissionGranted = true;
                startQiblaOrientation();
            }

            updateQiblaDisplay();
        }

        function updateQiblaFromLocation() {
            if (!userLocation) return;

            qiblaBearing = calculateQiblaBearing(userLocation.latitude, userLocation.longitude);
            displayedNeedleAngle = null;
            preferredHeadingSource = null;
            headingSourceName = null;
            lastRawHeading = null;
            lastRawHeadingTs = 0;
            lastAcceptedHeadingTs = 0;
            headingUnstableUntilTs = Date.now() + CALIBRATION_HINT_HOLD_MS;
            headingUnstableReason = 'حرّك الهاتف بحركة 8 بعد تغيير المكان';
            orientationTiltPoor = false;
            calibrationGuideRunning = false;
            clearCalibrationGuideInterval();
            startQiblaOrientation();
            updateQiblaDisplay();
        }

        // Get user's location
        async function getUserLocation() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation not supported'));
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        });
                    },
                    (error) => {
                        reject(error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 300000 // 5 minutes
                    }
                );
            });
        }

        // Fetch prayer times from Aladhan API
        async function fetchPrayerTimes(latitude, longitude) {
            const today = new Date();
            const date = today.toISOString().split('T')[0];

            const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${latitude}&longitude=${longitude}&method=2`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.code !== 200) {
                throw new Error('Failed to fetch prayer times');
            }

            return data.data;
        }

        // Format time from 24h to 12h with AM/PM
        function formatTime(time24) {
            const [hours, minutes] = time24.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'م' : 'ص';
            const hour12 = hour % 12 || 12;
            return `${hour12}:${minutes} ${ampm}`;
        }

        // Calculate remaining time to next prayer
        function calculateRemainingTime(prayerTime) {
            const now = new Date();
            const [hours, minutes] = prayerTime.split(':');
            const prayerDate = new Date();
            prayerDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            // If prayer time has passed today, add 1 day
            if (prayerDate <= now) {
                prayerDate.setDate(prayerDate.getDate() + 1);
            }

            const diff = prayerDate - now;
            const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
            const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (hoursLeft > 0) {
                return `${hoursLeft} ساعة و ${minutesLeft} دقيقة`;
            } else if (minutesLeft > 0) {
                return `${minutesLeft} دقيقة`;
            } else {
                return 'الآن';
            }
        }

        // Calculate Tahajjud time (last third of the night)
        function calculateTahajjudTime(timings) {
            const fajrTime = timings.Fajr;
            const ishaTime = timings.Isha;

            // Convert times to minutes since midnight
            const timeToMinutes = (time) => {
                const [hours, minutes] = time.split(':').map(Number);
                return hours * 60 + minutes;
            };

            const fajrMinutes = timeToMinutes(fajrTime);
            const ishaMinutes = timeToMinutes(ishaTime);

            // Calculate night duration (from Isha to Fajr)
            let nightDuration = fajrMinutes - ishaMinutes;
            if (nightDuration < 0) nightDuration += 24 * 60; // Handle overnight

            // Last third of the night starts at: Fajr - (night duration / 3)
            const lastThirdStart = fajrMinutes - Math.floor(nightDuration / 3);

            // Convert back to time format
            const hours = Math.floor(lastThirdStart / 60) % 24;
            const minutes = lastThirdStart % 60;

            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }

        // Get next prayer
        function getNextPrayer(timings) {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const tahajjudTime = calculateTahajjudTime(timings);

            const prayers = [
                { name: 'Fajr', time: timings.Fajr },
                { name: 'Dhuhr', time: timings.Dhuhr },
                { name: 'Asr', time: timings.Asr },
                { name: 'Maghrib', time: timings.Maghrib },
                { name: 'Isha', time: timings.Isha },
                { name: 'Tahajjud', time: tahajjudTime }
            ];

            for (const prayer of prayers) {
                const [hours, minutes] = prayer.time.split(':');
                const prayerMinutes = parseInt(hours) * 60 + parseInt(minutes);

                if (prayerMinutes > currentTime) {
                    return prayer;
                }
            }

            // If all prayers passed, return Fajr for tomorrow
            return { name: 'Fajr', time: timings.Fajr, tomorrow: true };
        }

        // Update remaining time display
        function updateRemainingTime() {
            if (!prayerTimes) return;

            const nextPrayer = getNextPrayer(prayerTimes.timings);
            const remaining = calculateRemainingTime(nextPrayer.time);
            const tahajjudTime = calculateTahajjudTime(prayerTimes.timings);

            document.getElementById('nextPrayerName').textContent = prayerNames[nextPrayer.name];
            document.getElementById('nextPrayerRemaining').textContent = nextPrayer.tomorrow ?
                `غداً في ${formatTime(nextPrayer.time)}` : `بعد ${remaining}`;
            document.getElementById('tahajjudTime').textContent = formatTime(tahajjudTime);
        }

        // Render prayer times
        function renderPrayerTimes(data) {
            const grid = document.getElementById('prayerGrid');
            const nextPrayer = getNextPrayer(data.timings);
            const tahajjudTime = calculateTahajjudTime(data.timings);

            const prayers = [
                { key: 'Fajr', name: 'الفجر', icon: '🌅' },
                { key: 'Sunrise', name: 'الشروق', icon: '☀️' },
                { key: 'Dhuhr', name: 'الظهر', icon: '🌞' },
                { key: 'Asr', name: 'العصر', icon: '🌇' },
                { key: 'Maghrib', name: 'المغرب', icon: '🌆' },
                { key: 'Isha', name: 'العشاء', icon: '🌙' },
                { key: 'Tahajjud', name: 'قيام الليل', icon: '⭐', time: tahajjudTime, isTahajjud: true }
            ];

            let html = '';
            prayers.forEach(prayer => {
                const time = prayer.time || data.timings[prayer.key];
                const isNext = prayer.key === nextPrayer.name;
                const remaining = isNext && !nextPrayer.tomorrow ? calculateRemainingTime(time) : '';
                const cardClass = prayer.isTahajjud ? 'prayer-card tahajjud' : `prayer-card ${isNext ? 'next' : ''}`;

                html += `
                    <div class="${cardClass}">
                        <div class="prayer-icon">${prayer.icon}</div>
                        <div class="prayer-name">${prayer.name}</div>
                        <div class="prayer-time">${formatTime(time)}</div>
                        ${remaining ? `<div class="prayer-remaining">بعد ${remaining}</div>` : ''}
                    </div>
                `;
            });

            grid.innerHTML = html;
        }

        // Load prayer times
        async function loadPrayerTimes(lat, lng) {
            try {
                document.getElementById('errorMessage').style.display = 'none';
                document.getElementById('prayerGrid').innerHTML = '<div class="loading-spinner"><i class="bi bi-clock-history"></i></div>';

                // Get location based on method
                if (locationMethod === 'automatic' && !userLocation && !lat && !lng) {
                    try {
                        userLocation = await getUserLocation();
                        showLocationSelected('تم تحديد موقعك تلقائياً');
                    } catch (geoError) {
                        console.error('Geolocation failed:', geoError);
                        // If automatic fails, fall back to manual
                        locationMethod = 'manual';
                        openCountryModal();
                        return;
                    }
                } else if (locationMethod === 'manual' && !lat && !lng) {
                    // Manual selection - country modal should be open
                    return;
                } else if (lat && lng) {
                    userLocation = { latitude: lat, longitude: lng };
                    const selectedCountry = getStoredCountrySelection();
                    showLocationSelected(selectedCountry ? selectedCountry.name : 'تم تحديد الموقع يدوياً');
                }

                updateQiblaFromLocation();

                // Fetch prayer times
                prayerTimes = await fetchPrayerTimes(userLocation.latitude, userLocation.longitude);

                // Render prayer times
                renderPrayerTimes(prayerTimes);

                // Show next prayer section
                document.getElementById('nextPrayerSection').style.display = 'block';
                updateRemainingTime();

                // Start updating remaining time every minute
                if (updateInterval) clearInterval(updateInterval);
                updateInterval = setInterval(updateRemainingTime, 60000);

            } catch (error) {
                console.error('Error loading prayer times:', error);

                hideLocationLoading();
                showLocationSelected('حدث خطأ في تحميل مواقيت الصلاة');
                document.getElementById('errorMessage').style.display = 'block';
                document.getElementById('prayerGrid').innerHTML = '';
            }
        }

        // Location selection functions
        function selectAutomaticLocation() {
            locationMethod = 'automatic';
            showLocationLoading();
            document.getElementById('prayerGrid').innerHTML = '<div class="loading-spinner"><i class="bi bi-clock-history"></i></div>';
            loadPrayerTimes();
        }

        function selectManualLocation() {
            locationMethod = 'manual';
            openCountryModal();
        }

        function resetLocation() {
            // Clear stored location data
            userLocation = null;
            locationMethod = null;
            clearCountrySelection();
            localStorage.removeItem('userLocation');
            localStorage.removeItem('locationText');

            // Reset UI to show buttons
            document.getElementById('locationButtons').style.display = 'flex';
            document.getElementById('locationSelected').style.display = 'none';

            // Clear prayer times
            document.getElementById('prayerGrid').innerHTML = '';
            document.getElementById('nextPrayerSection').style.display = 'none';
            document.getElementById('qiblaSection').style.display = 'none';

            qiblaBearing = null;
            currentHeading = null;
            smoothedHeading = null;
            displayedNeedleAngle = null;
            orientationLastUpdateTs = 0;
            absoluteOrientationSeen = false;
            preferredHeadingSource = null;
            headingSourceName = null;
            lastRawHeading = null;
            lastRawHeadingTs = 0;
            lastAcceptedHeadingTs = 0;
            headingUnstableUntilTs = 0;
            headingUnstableReason = '';
            orientationTiltPoor = false;
            calibrationGuideRunning = false;
            clearCalibrationGuideInterval();

            // Clear any intervals
            if (updateInterval) {
                clearInterval(updateInterval);
                updateInterval = null;
            }
        }

        function showLocationLoading() {
            document.getElementById('locationButtons').style.display = 'none';
            document.getElementById('locationSelected').style.display = 'none';

            // Add loading content to the location section
            const locationSection = document.getElementById('locationSection');
            locationSection.insertAdjacentHTML('beforeend', `
                <div class="location-loading" id="locationLoading">
                    <i class="bi bi-geo-alt-fill"></i>
                    <span>جاري تحديد الموقع...</span>
                </div>
            `);
        }

        function hideLocationLoading() {
            const loadingElement = document.getElementById('locationLoading');
            if (loadingElement) {
                loadingElement.remove();
            }
        }

        function showLocationSelected(text) {
            hideLocationLoading();
            document.getElementById('locationText').textContent = text;
            document.getElementById('locationButtons').style.display = 'none';
            document.getElementById('locationSelected').style.display = 'flex';
        }

        // Initialize
        (function () {
            // Load theme settings
            const darkMode = localStorage.getItem('darkMode') === 'true';
            if (darkMode) document.documentElement.setAttribute('data-theme', 'dark');

            const color = localStorage.getItem('primaryColor');
            if (color) {
                document.documentElement.style.setProperty('--primary-color', color);
            }

            const fontSize = localStorage.getItem('fontSize');
            if (fontSize !== null) {
                const fontSizes = [12, 14, 16, 18, 20, 24, 28];
                const baseSize = fontSizes[parseInt(fontSize)] || 16;
                document.documentElement.style.setProperty('--font-size-base', baseSize + 'px');
                document.documentElement.style.setProperty('--font-size-ayah', (baseSize + 8) + 'px');
            }

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js', { scope: '/' });
            }

            // Check if location was previously selected
            const selectedCountry = getStoredCountrySelection();
            if (selectedCountry) {
                locationMethod = 'manual';
                userLocation = { latitude: selectedCountry.lat, longitude: selectedCountry.lng };
                showLocationSelected(selectedCountry.name);
                // Clear initial loading spinner and load prayer times
                document.getElementById('prayerGrid').innerHTML = '<div class="loading-spinner"><i class="bi bi-clock-history"></i></div>';
                loadPrayerTimes(selectedCountry.lat, selectedCountry.lng);
            }
            // If no previous selection, show location buttons (default state)
        })();

        // Country selection modal functions
        function openCountryModal() {
            const modal = document.getElementById('countryModal');
            const searchInput = document.getElementById('countrySearchInput');
            modal.style.display = 'flex';
            populateCountryList();
            if (searchInput) {
                searchInput.value = '';
                window.setTimeout(() => searchInput.focus(), 50);
            }
        }

        function closeCountryModal() {
            const modal = document.getElementById('countryModal');
            modal.style.display = 'none';

            // If no location method was set (user closed modal without selecting), reset to buttons
            if (!locationMethod) {
                resetLocation();
            }
        }

        function populateCountryList() {
            allCountries = [
                { name: 'السعودية', lat: 24.7136, lng: 46.6753 },
                { name: 'الإمارات العربية المتحدة', lat: 24.4539, lng: 54.3773 },
                { name: 'الكويت', lat: 29.3759, lng: 47.9774 },
                { name: 'قطر', lat: 25.3548, lng: 51.1839 },
                { name: 'البحرين', lat: 26.0667, lng: 50.5577 },
                { name: 'عمان', lat: 23.6143, lng: 58.5451 },
                { name: 'الأردن', lat: 31.9632, lng: 35.9304 },
                { name: 'مصر', lat: 30.0444, lng: 31.2357 },
                { name: 'المغرب', lat: 33.9716, lng: -6.8498 },
                { name: 'تونس', lat: 36.8065, lng: 10.1815 },
                { name: 'الجزائر', lat: 36.7538, lng: 3.0588 },
                { name: 'ليبيا', lat: 32.8872, lng: 13.1913 },
                { name: 'السودان', lat: 15.5007, lng: 32.5599 },
                { name: 'اليمن', lat: 15.3694, lng: 44.2019 },
                { name: 'العراق', lat: 33.3152, lng: 44.3661 },
                { name: 'سوريا', lat: 33.5138, lng: 36.2765 },
                { name: 'لبنان', lat: 33.8938, lng: 35.5018 },
                { name: 'فلسطين', lat: 31.9522, lng: 35.2332 },
                { name: 'تركيا', lat: 39.9334, lng: 32.8597 },
                { name: 'إيران', lat: 35.6892, lng: 51.3890 },
                { name: 'باكستان', lat: 33.6844, lng: 73.0479 },
                { name: 'أفغانستان', lat: 34.5553, lng: 69.2075 },
                { name: 'أندونيسيا', lat: -6.2088, lng: 106.8456 },
                { name: 'ماليزيا', lat: 3.1390, lng: 101.6869 },
                { name: 'نيجيريا', lat: 9.0765, lng: 8.6753 },
                { name: 'السنغال', lat: 14.6928, lng: -17.4467 },
                { name: 'تشاد', lat: 12.1348, lng: 15.0557 },
                { name: 'الصومال', lat: 2.0469, lng: 45.3182 },
                { name: 'جيبوتي', lat: 11.8251, lng: 42.5903 },
                { name: 'موريتانيا', lat: 18.0735, lng: -15.9582 },
                { name: 'غينيا', lat: 9.6412, lng: -13.5784 },
                { name: 'سيرا ليون', lat: 8.4657, lng: -13.2317 },
                { name: 'غانا', lat: 5.6037, lng: -0.1870 },
                { name: 'بوركينا فاسو', lat: 12.3714, lng: -1.5197 },
                { name: 'مالي', lat: 12.6392, lng: -8.0029 },
                { name: 'النيجر', lat: 13.5116, lng: 2.1254 },
                { name: 'بنين', lat: 6.3703, lng: 2.3912 },
                { name: 'توغو', lat: 6.1725, lng: 1.2314 },
                { name: 'الكاميرون', lat: 3.8480, lng: 11.5021 },
                { name: 'جمهورية أفريقيا الوسطى', lat: 4.3947, lng: 18.5582 },
                { name: 'الكونغو', lat: -4.2634, lng: 15.2429 },
                { name: 'جمهورية الكونغو الديمقراطية', lat: -4.4419, lng: 15.2663 },
                { name: 'أوغندا', lat: 0.3476, lng: 32.5825 },
                { name: 'كينيا', lat: -1.2864, lng: 36.8172 },
                { name: 'تنزانيا', lat: -6.7924, lng: 39.2083 },
                { name: 'زامبيا', lat: -15.3875, lng: 28.3228 },
                { name: 'زيمبابوي', lat: -17.8252, lng: 31.0335 },
                { name: 'جنوب أفريقيا', lat: -26.2041, lng: 28.0473 },
                { name: 'موزمبيق', lat: -25.8918, lng: 32.6051 },
                { name: 'مدغشقر', lat: -18.8792, lng: 47.5079 },
                { name: 'موريشيوس', lat: -20.3484, lng: 57.5522 },
                { name: 'جزر القمر', lat: -11.6455, lng: 43.3333 },
                { name: 'بروناي', lat: 4.9031, lng: 114.9398 },
                { name: 'تايلاند', lat: 13.7563, lng: 100.5018 },
                { name: 'كازاخستان', lat: 51.1694, lng: 71.4491 },
                { name: 'أوزبكستان', lat: 41.2995, lng: 69.2401 },
                { name: 'طاجيكستان', lat: 38.5598, lng: 68.7870 },
                { name: 'قيرغيزستان', lat: 42.8746, lng: 74.5698 },
                { name: 'تركمانستان', lat: 37.9601, lng: 58.3261 },
                { name: 'أذربيجان', lat: 40.4093, lng: 49.8671 },
                { name: 'جورجيا', lat: 41.7167, lng: 44.7833 },
                { name: 'أرمينيا', lat: 40.1792, lng: 44.4991 },
                { name: 'ألبانيا', lat: 41.3275, lng: 19.8187 },
                { name: 'البوسنة والهرسك', lat: 43.8563, lng: 18.4131 },
                { name: 'كوسوفو', lat: 42.6026, lng: 20.9030 },
                { name: 'مقدونيا الشمالية', lat: 41.6086, lng: 21.7453 },
                { name: 'الجبل الأسود', lat: 42.4304, lng: 19.2594 },
                { name: 'صربيا', lat: 44.7866, lng: 20.4489 },
                { name: 'كرواتيا', lat: 45.8150, lng: 15.9819 },
                { name: 'سلوفينيا', lat: 46.0569, lng: 14.5058 },
                { name: 'اليونان', lat: 37.9838, lng: 23.7275 },
                { name: 'بلغاريا', lat: 42.6977, lng: 23.3219 },
                { name: 'رومانيا', lat: 44.4268, lng: 26.1025 },
                { name: 'مولدوفا', lat: 47.0105, lng: 28.8638 },
                { name: 'أوكرانيا', lat: 50.4501, lng: 30.5234 },
                { name: 'روسيا', lat: 55.7558, lng: 37.6173 },
                { name: 'بيلاروسيا', lat: 53.9045, lng: 27.5615 },
                { name: 'بولندا', lat: 52.2297, lng: 21.0122 },
                { name: 'ألمانيا', lat: 52.5200, lng: 13.4050 },
                { name: 'فرنسا', lat: 48.8566, lng: 2.3522 },
                { name: 'المملكة المتحدة', lat: 51.5074, lng: -0.1278 },
                { name: 'إيطاليا', lat: 41.9028, lng: 12.4964 },
                { name: 'إسبانيا', lat: 40.4168, lng: -3.7038 },
                { name: 'البرتغال', lat: 38.7223, lng: -9.1393 },
                { name: 'بلجيكا', lat: 50.8503, lng: 4.3517 },
                { name: 'هولندا', lat: 52.3676, lng: 4.9041 },
                { name: 'لوكسمبورغ', lat: 49.6116, lng: 6.1319 },
                { name: 'سويسرا', lat: 46.9481, lng: 7.4474 },
                { name: 'النمسا', lat: 48.2082, lng: 16.3738 },
                { name: 'الدنمارك', lat: 55.6761, lng: 12.5683 },
                { name: 'السويد', lat: 59.3293, lng: 18.0686 },
                { name: 'النرويج', lat: 59.9139, lng: 10.7522 },
                { name: 'فنلندا', lat: 60.1699, lng: 24.9384 },
                { name: 'إستونيا', lat: 59.4370, lng: 24.7536 },
                { name: 'لاتفيا', lat: 56.9496, lng: 24.1052 },
                { name: 'ليتوانيا', lat: 54.6872, lng: 25.2797 },
                { name: 'اليابان', lat: 35.6762, lng: 139.6503 },
                { name: 'كوريا الجنوبية', lat: 37.5665, lng: 126.9780 },
                { name: 'الصين', lat: 39.9042, lng: 116.4074 },
                { name: 'الهند', lat: 28.7041, lng: 77.1025 },
                { name: 'بنغلاديش', lat: 23.8103, lng: 90.4125 },
                { name: 'سريلانكا', lat: 6.9271, lng: 79.8612 },
                { name: 'نيبال', lat: 27.7172, lng: 85.3240 },
                { name: 'بوتان', lat: 27.4712, lng: 89.6339 },
                { name: 'الفلبين', lat: 14.5995, lng: 120.9842 },
                { name: 'فيتنام', lat: 21.0285, lng: 105.8542 },
                { name: 'كمبوديا', lat: 11.5621, lng: 104.9160 },
                { name: 'لاوس', lat: 17.9757, lng: 102.6331 },
                { name: 'ميانمار', lat: 16.8661, lng: 96.1951 },
                { name: 'سنغافورة', lat: 1.3521, lng: 103.8198 },
                { name: 'أستراليا', lat: -33.8688, lng: 151.2093 },
                { name: 'نيوزيلندا', lat: -36.8485, lng: 174.7633 },
                { name: 'الولايات المتحدة الأمريكية', lat: 38.9072, lng: -77.0369 },
                { name: 'كندا', lat: 45.4215, lng: -75.6972 },
                { name: 'المكسيك', lat: 19.4326, lng: -99.1332 },
                { name: 'البرازيل', lat: -15.8267, lng: -47.9218 },
                { name: 'الأرجنتين', lat: -34.6118, lng: -58.3960 },
                { name: 'تشيلي', lat: -33.4489, lng: -70.6693 },
                { name: 'بيرو', lat: -12.0464, lng: -77.0428 },
                { name: 'كولومبيا', lat: 4.7110, lng: -74.0721 },
                { name: 'فنزويلا', lat: 10.5061, lng: -66.9146 },
                { name: 'الإكوادور', lat: -0.1807, lng: -78.4678 },
                { name: 'بوليفيا', lat: -16.4897, lng: -68.1193 },
                { name: 'باراغواي', lat: -25.2637, lng: -57.5759 },
                { name: 'أوروغواي', lat: -34.9011, lng: -56.1645 },
                { name: 'غيانا', lat: 6.8013, lng: -58.1551 },
                { name: 'سورينام', lat: 5.8520, lng: -55.2038 },
                { name: 'غويانا الفرنسية', lat: 4.9224, lng: -52.3135 }
            ];

            renderCountryList(allCountries);
        }

        function renderCountryList(countries) {
            const countryList = document.getElementById('countryList');
            const selected = getStoredCountrySelection();

            countryList.innerHTML = '';

            if (!countries.length) {
                countryList.innerHTML = '<div class="country-empty">لا توجد نتائج مطابقة</div>';
                return;
            }

            countries.forEach(country => {
                const countryItem = document.createElement('div');
                countryItem.className = 'country-item';
                countryItem.textContent = country.name;
                if (selected && selected.name === country.name) {
                    countryItem.classList.add('active');
                }
                countryItem.onclick = () => selectCountry(country);
                countryList.appendChild(countryItem);
            });
        }

        function filterCountryList() {
            const searchInput = document.getElementById('countrySearchInput');
            const query = (searchInput?.value || '').trim().toLowerCase();

            if (!query) {
                renderCountryList(allCountries);
                return;
            }

            const filtered = allCountries.filter(country => country.name.toLowerCase().includes(query));
            renderCountryList(filtered);
        }

        function selectCountry(country) {
            saveCountrySelection(country);
            closeCountryModal();
            document.getElementById('prayerGrid').innerHTML = '<div class="loading-spinner"><i class="bi bi-clock-history"></i></div>';
            loadPrayerTimes(country.lat, country.lng);
        }

        // Cleanup interval on page unload
        window.addEventListener('beforeunload', () => {
            if (updateInterval) {
                clearInterval(updateInterval);
            }
            clearCalibrationGuideInterval();
            if (qiblaOrientationStarted) {
                window.removeEventListener('deviceorientationabsolute', handleDeviceOrientation, true);
                window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
            }
        });
