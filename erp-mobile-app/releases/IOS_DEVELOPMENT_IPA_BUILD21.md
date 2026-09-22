# iOS Development IPA — Build 21 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 21 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`

---

## Status

**IPA file:** **BUILT** — `releases/erp-mobile-1.0.5-build21.ipa` (2026-07-13)

---

## Changelog vs build 20

- **Copy transaction:** wire `onCopyTransaction` from AccountsModule → ReportsHub / My Activity (eligible type + both accounts).
- **Date range:** default **Current FY** across mobile DateRangeBar screens and web GlobalFilter fallback.
- **Inventory:** branch filter includes `branch_id IS NULL`; ProductHistory current stock from ledger running balance; purchased/sold buckets exclude transfers / include production_in.

---

## Install

Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build21.ipa` onto registered iPhone.

---

## Rebuild

```bash
cd erp-mobile-app
bash scripts/check-xcode-apple-account.sh
npm run ios:ipa:release:mac
```
