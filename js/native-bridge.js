/**
 * Thin wrapper around Capacitor plugins so the same JS can run on:
 *   - the web (uses navigator.vibrate / Notification API / no-op widgets)
 *   - the iOS / Android Capacitor shell (uses Haptics / LocalNotifications / WidgetBridge)
 *
 * Plugins are read off `window.Capacitor.Plugins` which Capacitor populates
 * automatically inside the native WebView when the corresponding native
 * plugin is installed. No bundler required.
 */
(function () {
    const cap = window.Capacitor;
    const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    const platform = (cap && typeof cap.getPlatform === 'function') ? cap.getPlatform() : 'web';

    function plugin(name) {
        return (cap && cap.Plugins) ? cap.Plugins[name] : null;
    }

    // Capacitor's auto-registration handles WidgetBridge once the native side
    // declares it. registerPlugin makes the JS proxy available even before
    // the first call so we can still talk to the plugin if it loads late.
    if (cap && typeof cap.registerPlugin === 'function' && !plugin('WidgetBridge')) {
        try { cap.registerPlugin('WidgetBridge'); } catch (_) { /* ignore */ }
    }

    const NB = {
        isNative,
        platform,

        /** Light tactile feedback for taps (masbaha, button presses). */
        async haptic(style) {
            const Haptics = plugin('Haptics');
            if (Haptics && typeof Haptics.impact === 'function') {
                try {
                    await Haptics.impact({ style: style || 'Light' });
                    return;
                } catch (_) { /* fall through */ }
            }
            if (navigator.vibrate) {
                try { navigator.vibrate(style === 'Heavy' ? 40 : 20); } catch (_) {}
            }
        },

        /** Stronger haptic, used when a target is reached. */
        async hapticSuccess() {
            const Haptics = plugin('Haptics');
            if (Haptics && typeof Haptics.notification === 'function') {
                try { await Haptics.notification({ type: 'SUCCESS' }); return; } catch (_) {}
            }
            if (navigator.vibrate) {
                try { navigator.vibrate([30, 50, 30]); } catch (_) {}
            }
        },

        /**
         * Schedule a list of recurring daily notifications.
         *
         * `items` shape: [{ id: number, title: string, body: string, hour: number, minute: number, days: number[] }]
         * Days follow JS Date.getDay(): 0 = Sun, 6 = Sat.
         *
         * On native, replaces all previously-scheduled notifications.
         * On web, falls back to a one-shot setTimeout for today only.
         */
        async scheduleDailyNotifications(items) {
            if (!Array.isArray(items)) return false;

            const LN = plugin('LocalNotifications');
            if (LN) {
                try {
                    const perm = await LN.checkPermissions();
                    if (!perm || perm.display !== 'granted') {
                        const req = await LN.requestPermissions();
                        if (!req || req.display !== 'granted') return false;
                    }

                    const pending = await LN.getPending();
                    if (pending && Array.isArray(pending.notifications) && pending.notifications.length) {
                        await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
                    }

                    const notifications = [];
                    items.forEach((item, index) => {
                        const days = Array.isArray(item.days) && item.days.length ? item.days : [0, 1, 2, 3, 4, 5, 6];
                        days.forEach((dayJs, di) => {
                            // Capacitor weekday: 1=Sunday..7=Saturday
                            const weekday = ((Number(dayJs) % 7) + 7) % 7 + 1;
                            notifications.push({
                                id: (Number(item.id) || (index + 1)) * 10 + di,
                                title: item.title || 'القرآن الكريم',
                                body: item.body || 'حان وقت الذكر',
                                schedule: {
                                    on: {
                                        weekday,
                                        hour: Number(item.hour) || 0,
                                        minute: Number(item.minute) || 0
                                    },
                                    allowWhileIdle: true
                                },
                                smallIcon: 'ic_stat_notify',
                                iconColor: '#1B5E20'
                            });
                        });
                    });

                    if (notifications.length) {
                        await LN.schedule({ notifications });
                    }
                    return true;
                } catch (e) {
                    console.warn('[native-bridge] LocalNotifications failed', e);
                    return false;
                }
            }

            // Web fallback (original behaviour: one-shot for today only)
            if (!('Notification' in window) || Notification.permission !== 'granted') return false;
            try {
                items.forEach((item) => {
                    const today = new Date();
                    const target = new Date(today.getFullYear(), today.getMonth(), today.getDate(),
                        Number(item.hour) || 0, Number(item.minute) || 0);
                    const delay = target.getTime() - Date.now();
                    if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
                    setTimeout(() => {
                        try {
                            if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.ready.then((reg) => {
                                    reg.showNotification(item.title || 'القرآن الكريم', {
                                        body: item.body || 'حان وقت الذكر',
                                        icon: '/assets/icons/icon-192.png',
                                        badge: '/assets/icons/icon-192.png'
                                    });
                                });
                            } else {
                                new Notification(item.title || 'القرآن الكريم', {
                                    body: item.body || 'حان وقت الذكر',
                                    icon: '/assets/icons/icon-192.png'
                                });
                            }
                        } catch (_) {}
                    }, delay);
                });
                return true;
            } catch (_) {
                return false;
            }
        },

        async cancelAllNotifications() {
            const LN = plugin('LocalNotifications');
            if (!LN) return;
            try {
                const pending = await LN.getPending();
                if (pending && Array.isArray(pending.notifications) && pending.notifications.length) {
                    await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
                }
            } catch (e) {
                console.warn('[native-bridge] cancel failed', e);
            }
        },

        async requestNotificationPermission() {
            const LN = plugin('LocalNotifications');
            if (LN) {
                try {
                    const req = await LN.requestPermissions();
                    return req && req.display === 'granted';
                } catch (_) { return false; }
            }
            if (!('Notification' in window)) return false;
            try {
                const result = await Notification.requestPermission();
                return result === 'granted';
            } catch (_) { return false; }
        },

        /**
         * Push current "next prayer" info to the native widget store.
         * No-op on web. Silently swallows errors so the call site never has
         * to care about platform.
         */
        async setNextPrayer(payload) {
            const WB = plugin('WidgetBridge');
            if (!WB || typeof WB.setNextPrayer !== 'function') return;
            try {
                await WB.setNextPrayer({
                    name: String(payload.name || ''),
                    nameAr: String(payload.nameAr || ''),
                    time: String(payload.time || ''),
                    remainingMinutes: Number(payload.remainingMinutes || 0),
                    location: String(payload.location || ''),
                    isTomorrow: !!payload.isTomorrow
                });
            } catch (e) {
                console.warn('[native-bridge] setNextPrayer failed', e);
            }
        },

        async setAyahOfDay(payload) {
            const WB = plugin('WidgetBridge');
            if (!WB || typeof WB.setAyahOfDay !== 'function') return;
            try {
                await WB.setAyahOfDay({
                    text: String(payload.text || ''),
                    surah: String(payload.surah || ''),
                    ayah: Number(payload.ayah || 0)
                });
            } catch (e) {
                console.warn('[native-bridge] setAyahOfDay failed', e);
            }
        },

        async hideSplashScreen() {
            const SS = plugin('SplashScreen');
            if (SS && typeof SS.hide === 'function') {
                try { await SS.hide(); } catch (_) {}
            }
        }
    };

    window.NativeBridge = NB;

    // Hide splash as soon as the first page is interactive.
    if (isNative) {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            NB.hideSplashScreen();
        } else {
            document.addEventListener('DOMContentLoaded', () => NB.hideSplashScreen(), { once: true });
        }
    }
})();
