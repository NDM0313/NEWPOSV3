# iOS Development IPA — Build 29 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 29 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base:** `https://erp.dincouture.pk`  
**Date:** 2026-08-15  

**Includes:** Mobile Cancel Payment / Cancel Entry (void, not hard-delete) on Accounts, Day Book, Reports Hub, Transactions timeline, and Purchase payment history; voided payments hidden from live transaction lists.

---

## IPA

`erp-mobile-app/releases/erp-mobile-1.0.5-build29.ipa` (~10 MB)

Also: `releases/ios-export-build29/NDM ERP.ipa`

## Install

Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build29.ipa` onto a registered iPhone.

## Rebuild

```bash
cd erp-mobile-app
npm run ios:ipa:release:mac
```
