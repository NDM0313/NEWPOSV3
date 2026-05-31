package com.dincouture.erp;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ErpPrinterPlugin.class);
        registerPlugin(ErpWhatsAppPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        // SSL bypass via DebugSslWebViewClient is intentional debug-only (see that class).
        if (!BuildConfig.DEBUG) {
            return;
        }
        Bridge bridge = getBridge();
        if (bridge == null) {
            return;
        }
        WebView webView = bridge.getWebView();
        if (webView == null) {
            return;
        }
        webView.setWebViewClient(new DebugSslWebViewClient(bridge));
    }
}
