package app.quran.fady.widgets;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    /** Must match the SharedPreferences name used by the AppWidget providers. */
    public static final String PREFS_NAME = "QuranWidgetPrefs";

    public static final String KEY_PRAYER_NAME = "nextPrayerName";
    public static final String KEY_PRAYER_NAME_AR = "nextPrayerNameAr";
    public static final String KEY_PRAYER_TIME = "nextPrayerTime";
    public static final String KEY_PRAYER_REMAINING = "nextPrayerRemainingMinutes";
    public static final String KEY_PRAYER_LOCATION = "nextPrayerLocation";
    public static final String KEY_PRAYER_IS_TOMORROW = "nextPrayerIsTomorrow";
    public static final String KEY_PRAYER_UPDATED_AT = "nextPrayerUpdatedAt";

    public static final String KEY_AYAH_TEXT = "ayahText";
    public static final String KEY_AYAH_SURAH = "ayahSurah";
    public static final String KEY_AYAH_NUMBER = "ayahNumber";
    public static final String KEY_AYAH_UPDATED_AT = "ayahUpdatedAt";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void setNextPrayer(PluginCall call) {
        SharedPreferences.Editor e = prefs().edit();
        e.putString(KEY_PRAYER_NAME, call.getString("name", ""));
        e.putString(KEY_PRAYER_NAME_AR, call.getString("nameAr", ""));
        e.putString(KEY_PRAYER_TIME, call.getString("time", ""));
        e.putInt(KEY_PRAYER_REMAINING, call.getInt("remainingMinutes", 0));
        e.putString(KEY_PRAYER_LOCATION, call.getString("location", ""));
        e.putBoolean(KEY_PRAYER_IS_TOMORROW, call.getBoolean("isTomorrow", false));
        e.putLong(KEY_PRAYER_UPDATED_AT, System.currentTimeMillis());
        e.apply();

        refreshWidgets();
        call.resolve();
    }

    @PluginMethod
    public void setAyahOfDay(PluginCall call) {
        SharedPreferences.Editor e = prefs().edit();
        e.putString(KEY_AYAH_TEXT, call.getString("text", ""));
        e.putString(KEY_AYAH_SURAH, call.getString("surah", ""));
        e.putInt(KEY_AYAH_NUMBER, call.getInt("ayah", 0));
        e.putLong(KEY_AYAH_UPDATED_AT, System.currentTimeMillis());
        e.apply();

        refreshWidgets();
        call.resolve();
    }

    @PluginMethod
    public void reloadAll(PluginCall call) {
        refreshWidgets();
        call.resolve();
    }

    private void refreshWidgets() {
        Context ctx = getContext();
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);

        for (Class<?> cls : new Class<?>[] { NextPrayerWidgetProvider.class, AyahWidgetProvider.class }) {
            ComponentName cn = new ComponentName(ctx, cls);
            int[] ids = mgr.getAppWidgetIds(cn);
            if (ids != null && ids.length > 0) {
                android.content.Intent intent = new android.content.Intent(ctx, cls);
                intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                ctx.sendBroadcast(intent);
            }
        }
    }
}
