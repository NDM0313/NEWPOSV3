package com.dincouture.erp;

import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onStart() {
        super.onStart();
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
