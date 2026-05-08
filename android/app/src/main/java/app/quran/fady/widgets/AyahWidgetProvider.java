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

public class AyahWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        SharedPreferences p = context.getSharedPreferences(WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE);

        String text = p.getString(WidgetBridgePlugin.KEY_AYAH_TEXT, "افتح التطبيق لعرض آية اليوم");
        String surah = p.getString(WidgetBridgePlugin.KEY_AYAH_SURAH, "");
        int ayah = p.getInt(WidgetBridgePlugin.KEY_AYAH_NUMBER, 0);

        String reference = (surah != null && !surah.isEmpty())
                ? surah + (ayah > 0 ? " : " + ayah : "")
                : "";

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                context, 1, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_ayah);
            views.setTextViewText(R.id.widget_ayah_text, text);
            views.setTextViewText(R.id.widget_ayah_reference, reference);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
            mgr.updateAppWidget(id, views);
        }
    }
}
