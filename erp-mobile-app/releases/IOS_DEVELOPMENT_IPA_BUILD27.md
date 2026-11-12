# iOS Development IPA — Build 27 (Mac / free)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 27  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base:** `https://erp.dincouture.pk`  
**Date:** 2026-08-08  

**Includes:** GitHub `main` through `d3f4e894` (Settings search, import FX purchasing UI, mobile DayBook/transactions updates) plus local ledger Description Easy View (web).

---

## IPA

`erp-mobile-app/releases/erp-mobile-1.0.5-build27.ipa` (~10 MB)

## Install

Xcode → Window → Devices and Simulators → drag IPA onto a registered iPhone.

## Rebuild

```bash
cd erp-mobile-app
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
IOS_EXPORT_METHOD=debugging npm run ios:ipa:release:mac
```
