import Foundation
import Capacitor
#if canImport(WidgetKit)
import WidgetKit
#endif

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setNextPrayer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAyahOfDay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadAll", returnType: CAPPluginReturnPromise)
    ]

    /// Must match the App Group enabled on BOTH the App and the Widget Extension targets.
    /// Add it via Xcode → target → Signing & Capabilities → App Groups.
    public static let appGroup = "group.app.quran.fady"

    public enum Keys {
        public static let nextPrayerName = "nextPrayerName"
        public static let nextPrayerNameAr = "nextPrayerNameAr"
        public static let nextPrayerTime = "nextPrayerTime"
        public static let nextPrayerRemainingMinutes = "nextPrayerRemainingMinutes"
        public static let nextPrayerLocation = "nextPrayerLocation"
        public static let nextPrayerIsTomorrow = "nextPrayerIsTomorrow"
        public static let nextPrayerUpdatedAt = "nextPrayerUpdatedAt"

        public static let ayahText = "ayahText"
        public static let ayahSurah = "ayahSurah"
        public static let ayahNumber = "ayahNumber"
        public static let ayahUpdatedAt = "ayahUpdatedAt"
    }

    private func defaults() -> UserDefaults? {
        return UserDefaults(suiteName: WidgetBridgePlugin.appGroup)
    }

    @objc func setNextPrayer(_ call: CAPPluginCall) {
        guard let d = defaults() else {
            call.reject("App Group '\(WidgetBridgePlugin.appGroup)' is not configured. Enable it on the App and Widget targets.")
            return
        }
        d.set(call.getString("name") ?? "", forKey: Keys.nextPrayerName)
        d.set(call.getString("nameAr") ?? "", forKey: Keys.nextPrayerNameAr)
        d.set(call.getString("time") ?? "", forKey: Keys.nextPrayerTime)
        d.set(call.getInt("remainingMinutes") ?? 0, forKey: Keys.nextPrayerRemainingMinutes)
        d.set(call.getString("location") ?? "", forKey: Keys.nextPrayerLocation)
        d.set(call.getBool("isTomorrow") ?? false, forKey: Keys.nextPrayerIsTomorrow)
        d.set(Date().timeIntervalSince1970, forKey: Keys.nextPrayerUpdatedAt)

        reloadTimelines()
        call.resolve()
    }

    @objc func setAyahOfDay(_ call: CAPPluginCall) {
        guard let d = defaults() else {
            call.reject("App Group '\(WidgetBridgePlugin.appGroup)' is not configured.")
            return
        }
        d.set(call.getString("text") ?? "", forKey: Keys.ayahText)
        d.set(call.getString("surah") ?? "", forKey: Keys.ayahSurah)
        d.set(call.getInt("ayah") ?? 0, forKey: Keys.ayahNumber)
        d.set(Date().timeIntervalSince1970, forKey: Keys.ayahUpdatedAt)

        reloadTimelines()
        call.resolve()
    }

    @objc func reloadAll(_ call: CAPPluginCall) {
        reloadTimelines()
        call.resolve()
    }

    private func reloadTimelines() {
        #if canImport(WidgetKit)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        #endif
    }
}
