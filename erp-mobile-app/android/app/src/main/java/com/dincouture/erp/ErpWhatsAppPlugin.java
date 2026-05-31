package com.dincouture.erp;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Share a PDF directly to a WhatsApp chat by phone (jid).
 * Generic Capacitor Share cannot pre-select the recipient.
 */
@CapacitorPlugin(name = "ErpWhatsApp")
public class ErpWhatsAppPlugin extends Plugin {

    private static final String PKG_WHATSAPP = "com.whatsapp";
    private static final String PKG_WHATSAPP_BUSINESS = "com.whatsapp.w4b";
    private static final String EXTRA_JID = "jid";

    @PluginMethod
    public void sharePdf(PluginCall call) {
        String uriStr = call.getString("uri");
        String phone = call.getString("phone");
        String text = call.getString("text");

        if (TextUtils.isEmpty(uriStr) || TextUtils.isEmpty(phone)) {
            call.reject("Missing uri or phone");
            return;
        }

        String digits = phone.replaceAll("\\D", "");
        if (digits.isEmpty()) {
            call.reject("Invalid phone");
            return;
        }

        Uri streamUri = Uri.parse(uriStr);
        Intent base = new Intent(Intent.ACTION_SEND);
        base.setType("application/pdf");
        base.putExtra(Intent.EXTRA_STREAM, streamUri);
        base.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        if (!TextUtils.isEmpty(text)) {
            base.putExtra(Intent.EXTRA_TEXT, text);
        }
        String jid = digits + "@s.whatsapp.net";
        base.putExtra(EXTRA_JID, jid);

        String pkg = resolveWhatsAppPackage();
        if (pkg == null) {
            call.reject("WhatsApp is not installed");
            return;
        }

        if (getActivity() == null) {
            call.reject("No activity");
            return;
        }

        try {
            Intent intent = new Intent(base);
            intent.setPackage(pkg);
            getActivity().grantUriPermission(pkg, streamUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (ActivityNotFoundException e) {
            call.reject("Could not open WhatsApp: " + e.getMessage());
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    private String resolveWhatsAppPackage() {
        if (getContext() == null) return null;
        if (isPackageInstalled(PKG_WHATSAPP)) return PKG_WHATSAPP;
        if (isPackageInstalled(PKG_WHATSAPP_BUSINESS)) return PKG_WHATSAPP_BUSINESS;
        return null;
    }

    private boolean isPackageInstalled(String packageName) {
        try {
            getContext().getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
