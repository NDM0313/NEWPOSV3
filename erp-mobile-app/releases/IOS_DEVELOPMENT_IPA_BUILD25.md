# iOS Development IPA — Build 25 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 25 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`  
**Date:** 2026-07-25

---

## Status

**IPA file:** **BUILT** — `erp-mobile-app/releases/erp-mobile-1.0.5-build25.ipa` (~10 MB)

---

## Changelog vs build 24

- **Transfer Edit:** Fund transfers opened from Transactions no longer show only **Payment Account**. Edit sheet shows **Transfer From** and **Transfer To** (journal edit, JE- + `reference_type: transfer`).
- `canEditTransaction`: `payment_row` + `transfer` / `general` routes to journal edit (sale/purchase payments unchanged).
- Timeline / detail resolve missing `journalEntryId` via payment→JE lookup before opening edit.
- Web (same release if pushed together): Accounting **Fund Transfer CSV Import** (JE- sequence, leaf COA resolve, signed-amount flip).

---

## Install

Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build25.ipa` onto a registered iPhone.

---

## Rebuild

```bash
cd erp-mobile-app
bash scripts/check-xcode-apple-account.sh
npm run ios:ipa:release:mac
```

---

## GitHub

- Notes file: `IOS_DEVELOPMENT_IPA_BUILD25.md` (this file)
- Release notes (for `gh release`): `GH_RELEASE_NOTES_mobile-v1.0.5-build25.md`
- Artifact: `erp-mobile-1.0.5-build25.ipa`
