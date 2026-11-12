# iOS Development IPA — Build 26 (Mac / free)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 26 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — free Apple ID team **NLNZN84GX4**  
**API base:** `https://erp.dincouture.pk`  
**Date:** 2026-07-31

---

## Status

**IPA:** `erp-mobile-app/releases/erp-mobile-1.0.5-build26.ipa` (~10 MB)

Free account pe sirf Development IPA possible hai. Yeh profile baad mein expire / recycle ho kar **“No longer available”** dikha sakti hai — Ad Hoc ke liye paid Apple Developer Program chahiye.

---

## Install

Xcode → Window → Devices and Simulators → registered iPhone pe IPA drag karein (device UDID team pe registered hona chahiye).

---

## Rebuild

```bash
cd erp-mobile-app
IOS_EXPORT_METHOD=debugging npm run ios:ipa:release:mac
```
