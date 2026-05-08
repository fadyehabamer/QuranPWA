package app.quran.fady.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import app.quran.fady.MainActivity;
import app.quran.fady.R;

public class NextPrayerWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        SharedPreferences p = context.getSharedPreferences(WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE);

        String nameAr = p.getString(WidgetBridgePlugin.KEY_PRAYER_NAME_AR, "");
        String time = p.getString(WidgetBridgePlugin.KEY_PRAYER_TIME, "--:--");
        int remaining = p.getInt(WidgetBridgePlugin.KEY_PRAYER_REMAINING, 0);
        String location = p.getString(WidgetBridgePlugin.KEY_PRAYER_LOCATION, "");
        boolean isTomorrow = p.getBoolean(WidgetBridgePlugin.KEY_PRAYER_IS_TOMORROW, false);

        if (nameAr == null || nameAr.isEmpty()) nameAr = "افتح التطبيق";

        String remainingLabel;
        if (isTomorrow) {
            remainingLabel = "غداً في " + time;
        } else if (remaining <= 0) {
            remainingLabel = time;
        } else if (remaining < 60) {
            remainingLabel = "بعد " + remaining + " د";
        } else {
            int h = remaining / 60;
            int m = remaining % 60;
            remainingLabel = "بعد " + h + " س " + (m > 0 ? (m + " د") : "");
        }

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_next_prayer);
            views.setTextViewText(R.id.widget_prayer_name, nameAr);
            views.setTextViewText(R.id.widget_prayer_time, time);
            views.setTextViewText(R.id.widget_prayer_remaining, remainingLabel);
            views.setTextViewText(R.id.widget_prayer_location, location != null ? location : "");
            views.setOnClickPendingIntent(R.id.widget_root, pi);
            mgr.updateAppWidget(id, views);
        }
    }
}
