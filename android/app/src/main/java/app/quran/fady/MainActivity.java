package app.quran.fady;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import app.quran.fady.widgets.WidgetBridgePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
