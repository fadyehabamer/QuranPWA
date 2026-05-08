import WidgetKit
import SwiftUI

// MARK: - Shared store

private let appGroup = "group.app.quran.fady"
private func defaults() -> UserDefaults? { UserDefaults(suiteName: appGroup) }

// MARK: - Next Prayer

private struct PrayerEntry: TimelineEntry {
    let date: Date
    let prayerName: String      // Arabic
    let prayerTime: String      // "04:48"
    let remainingMinutes: Int
    let location: String
    let isTomorrow: Bool

    static let placeholder = PrayerEntry(
        date: Date(),
        prayerName: "الفجر",
        prayerTime: "04:48",
        remainingMinutes: 72,
        location: "القاهرة",
        isTomorrow: false
    )
}

private struct PrayerProvider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        completion(read())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let now = Date()
        let entry = read()

        // Build short timeline so the "remaining" countdown stays roughly fresh
        // until the app pushes new data (or for at most 30 minutes).
        var entries: [PrayerEntry] = []
        for offset in stride(from: 0, through: 30, by: 5) {
            let date = now.addingTimeInterval(TimeInterval(offset * 60))
            let remaining = max(0, entry.remainingMinutes - offset)
            entries.append(PrayerEntry(
                date: date,
                prayerName: entry.prayerName,
                prayerTime: entry.prayerTime,
                remainingMinutes: remaining,
                location: entry.location,
                isTomorrow: entry.isTomorrow
            ))
        }

        let refresh = now.addingTimeInterval(30 * 60)
        completion(Timeline(entries: entries, policy: .after(refresh)))
    }

    private func read() -> PrayerEntry {
        guard let d = defaults() else { return .placeholder }
        return PrayerEntry(
            date: Date(),
            prayerName: d.string(forKey: "nextPrayerNameAr") ?? "افتح التطبيق",
            prayerTime: d.string(forKey: "nextPrayerTime") ?? "--:--",
            remainingMinutes: d.integer(forKey: "nextPrayerRemainingMinutes"),
            location: d.string(forKey: "nextPrayerLocation") ?? "",
            isTomorrow: d.bool(forKey: "nextPrayerIsTomorrow")
        )
    }
}

private struct PrayerWidgetView: View {
    var entry: PrayerEntry

    private var remainingLabel: String {
        if entry.isTomorrow { return "غداً في \(entry.prayerTime)" }
        if entry.remainingMinutes <= 0 { return entry.prayerTime }
        if entry.remainingMinutes < 60 { return "بعد \(entry.remainingMinutes) د" }
        let h = entry.remainingMinutes / 60
        let m = entry.remainingMinutes % 60
        return m > 0 ? "بعد \(h) س \(m) د" : "بعد \(h) س"
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text("الصلاة القادمة")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(Color(red: 1.0, green: 0.83, blue: 0.47))
            Text(entry.prayerName)
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.white)
                .lineLimit(1)
            Text(entry.prayerTime)
                .font(.system(size: 18))
                .foregroundColor(.white)
            Text(remainingLabel)
                .font(.system(size: 12))
                .foregroundColor(Color(red: 0.88, green: 0.91, blue: 0.76))
            if !entry.location.isEmpty {
                Text(entry.location)
                    .font(.system(size: 10))
                    .foregroundColor(Color(red: 0.65, green: 0.77, blue: 0.66))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .padding(14)
        .environment(\.layoutDirection, .rightToLeft)
        .containerBackgroundCompat()
    }
}

struct NextPrayerWidget: Widget {
    let kind: String = "NextPrayerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PrayerProvider()) { entry in
            PrayerWidgetView(entry: entry)
        }
        .configurationDisplayName("الصلاة القادمة")
        .description("يعرض اسم الصلاة القادمة والوقت المتبقي.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Ayah of the day

private struct AyahEntry: TimelineEntry {
    let date: Date
    let text: String
    let surah: String
    let ayah: Int

    static let placeholder = AyahEntry(
        date: Date(),
        text: "إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا",
        surah: "الشرح",
        ayah: 6
    )
}

private struct AyahProvider: TimelineProvider {
    func placeholder(in context: Context) -> AyahEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (AyahEntry) -> Void) {
        completion(read())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AyahEntry>) -> Void) {
        let entry = read()
        let refresh = Date().addingTimeInterval(60 * 60)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    private func read() -> AyahEntry {
        guard let d = defaults() else { return .placeholder }
        return AyahEntry(
            date: Date(),
            text: d.string(forKey: "ayahText") ?? AyahEntry.placeholder.text,
            surah: d.string(forKey: "ayahSurah") ?? "",
            ayah: d.integer(forKey: "ayahNumber")
        )
    }
}

private struct AyahWidgetView: View {
    var entry: AyahEntry

    private var reference: String {
        guard !entry.surah.isEmpty else { return "" }
        return entry.ayah > 0 ? "\(entry.surah) : \(entry.ayah)" : entry.surah
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: 6) {
            Text("آية اليوم")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(Color(red: 1.0, green: 0.83, blue: 0.47))
            Text(entry.text)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white)
                .multilineTextAlignment(.trailing)
                .lineLimit(4)
            if !reference.isEmpty {
                Text(reference)
                    .font(.system(size: 11))
                    .foregroundColor(Color(red: 0.88, green: 0.91, blue: 0.76))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .padding(14)
        .environment(\.layoutDirection, .rightToLeft)
        .containerBackgroundCompat()
    }
}

struct AyahWidget: Widget {
    let kind: String = "AyahWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AyahProvider()) { entry in
            AyahWidgetView(entry: entry)
        }
        .configurationDisplayName("آية اليوم")
        .description("يعرض آية من القرآن الكريم تتغير عند فتح التطبيق.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// MARK: - Bundle

@main
struct QuranWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextPrayerWidget()
        AyahWidget()
    }
}

// MARK: - iOS 17 background helper

extension View {
    @ViewBuilder
    fileprivate func containerBackgroundCompat() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) {
                LinearGradient(
                    colors: [Color(red: 0.106, green: 0.369, blue: 0.125),
                             Color(red: 0.059, green: 0.239, blue: 0.078)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        } else {
            self.background(
                LinearGradient(
                    colors: [Color(red: 0.106, green: 0.369, blue: 0.125),
                             Color(red: 0.059, green: 0.239, blue: 0.078)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
        }
    }
}
