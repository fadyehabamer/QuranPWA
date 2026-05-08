# Native build & widget setup

This document covers the **one-time manual steps** required after cloning the
repo, since two pieces of iOS configuration cannot be expressed in the source
files alone (they live inside `project.pbxproj`):

1. Adding the WidgetKit extension target to the Xcode project.
2. Enabling the App Group capability on both the App and Widget targets.

Everything else (icons, splash, web assets, plugin Swift/Java code, layouts,
manifest entries) is already in source and will be picked up by `npx cap sync`
without further input.

---

## 1. iOS — first-time Xcode setup

### 1.1 Open the workspace

```bash
npm run cap:ios
```

This runs `cap sync` then `cap open ios`, opening the project in Xcode.

### 1.2 Add the Widget Extension target

1. **File → New → Target…**
2. Select **Widget Extension** under iOS.
3. Fill in:
   - Product Name: `QuranWidget`
   - Bundle Identifier: `app.quran.fady.QuranWidget` (must extend the App's bundle id)
   - Language: `Swift`
   - **Uncheck** "Include Configuration App Intent" (we use static widgets)
   - **Uncheck** "Include Live Activity"
4. Click **Finish**, then **Activate** when prompted to activate the new scheme.

Xcode will create a `QuranWidget/` folder with a sample Swift file. Replace it
with the source files already in `ios/QuranWidget/`:

5. In Finder, the repo already contains `ios/QuranWidget/QuranWidget.swift`,
   `Info.plist`, and `QuranWidget.entitlements`. **Delete** the sample files
   that Xcode generated (`QuranWidget.swift`, `Info.plist`, etc) inside the new
   target's folder, then **drag** the three existing files from
   `ios/QuranWidget/` into the QuranWidget target in Xcode.
   - When dragging, choose **"Copy items if needed: OFF"**, **"Create groups"**,
     and check the **QuranWidget** target only (not App).

### 1.3 Enable App Groups on both targets

App Groups let the main app and the widget share a `UserDefaults` suite — that's
how prayer time and ayah data flow from JS → widget.

For **each** of the two targets (`App` and `QuranWidget`):

1. Select the target in Xcode.
2. Open the **Signing & Capabilities** tab.
3. Click **+ Capability** and add **App Groups**.
4. Click the **+** under App Groups and enter:

   ```
   group.app.quran.fady
   ```

5. Make sure the entitlement file path points to the matching file already in
   the repo:
   - App target → `App/App.entitlements`
   - QuranWidget target → `QuranWidget/QuranWidget.entitlements`

   If Xcode created its own entitlements files, point the build setting
   **CODE_SIGN_ENTITLEMENTS** at the existing files instead, or copy the
   `<key>com.apple.security.application-groups</key>` array into the auto-generated
   one.

### 1.4 Build & run

- Select the **App** scheme → ▶ to a simulator or device. The app should boot,
  show the splash, then load the PWA.
- Select the **QuranWidget** scheme → ▶ → choose a simulator. iOS will open the
  widget gallery; long-press on the home screen → + → search for "القرآن
  الكريم" to add the widget.

### 1.5 What feeds the widget

- Opening the home screen (`index.html`) calls `loadDailyVerse()` which writes
  ayah text into the App Group via the `WidgetBridge` plugin.
- Opening `prayer-times.html` calls `pushNextPrayerToWidget()` after every
  render and on the 1-minute interval, keeping the prayer widget fresh.

If a widget shows "افتح التطبيق", the JS hasn't pushed data yet — open the
relevant page in the app once.

---

## 2. Android

No extra steps required. The widget receivers and `WidgetBridge` plugin are
already declared in `AndroidManifest.xml` and registered in `MainActivity.java`.

After `npm run cap:android`, in Android Studio:

1. Open the project → **Run** ▶ to a connected device or emulator.
2. On the device home screen, long-press → **Widgets** → scroll to "القرآن
   الكريم" → drag onto the home screen.

Two widgets are exposed:
- **الصلاة القادمة** — small/medium, prayer name + remaining time.
- **آية اليوم** — medium/large, ayah text + reference.

Note: Capacitor 8 requires Java 17+ and Android Studio Hedgehog (2023.1) or
newer. If the Gradle sync errors with "Unable to locate a Java Runtime," install
JDK 17 (`brew install openjdk@17`) and point Android Studio at it under
**Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK**.

---

## 3. App Group / Bundle ID changes

If you change `appId` in `capacitor.config.json` from `app.quran.fady` to
something else, you must also update:

- `ios/App/App/App.entitlements` — the app group string
- `ios/QuranWidget/QuranWidget.entitlements` — the app group string
- `ios/App/App/WidgetBridgePlugin.swift` — the `appGroup` constant
- `ios/QuranWidget/QuranWidget.swift` — the `appGroup` constant
- The Xcode App Groups capability values for both targets

The Android side reads SharedPreferences within the same APK so it doesn't
require an equivalent change.
