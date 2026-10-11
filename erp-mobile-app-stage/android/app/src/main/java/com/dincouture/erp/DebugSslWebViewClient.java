package com.dincouture.erp;

import android.net.http.SslError;
import android.util.Log;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Debug-only: allows WebView to proceed past TLS errors (e.g. self-signed dev HTTPS).
 * {@link BuildConfig#DEBUG} is false for release builds — release keeps default WebView SSL behavior.
 */
public class DebugSslWebViewClient extends BridgeWebViewClient {

    private static final String TAG = "DebugSslWebView";

    public DebugSslWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
        if (BuildConfig.DEBUG) {
            Log.w(TAG, "SSL error (debug proceed): " + (error != null ? error.toString() : "unknown"));
            handler.proceed();
            return;
        }
        super.onReceivedSslError(view, handler, error);
    }
}
