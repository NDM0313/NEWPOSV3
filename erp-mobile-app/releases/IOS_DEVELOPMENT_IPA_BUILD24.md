# iOS Development IPA — Build 24 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 24 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`  
**Date:** 2026-07-23

---

## Status

**IPA file:** **BUILT** — `erp-mobile-app/releases/erp-mobile-1.0.5-build24.ipa` (~10 MB)

---

## Changelog vs build 23

- **Cash Flow:** full transaction list (no 100-row cap) + payment-account filter chips (All / each cash·bank·wallet). See `CASH_FLOW_ACCOUNT_FILTER.md`.
- **Payments:** branch default cash/bank preselect on payment pickers; reports default newest-first where applicable.
- Fresh Capacitor **prod** sync (`cap:sync:ios:prod`) + Development export.

---

## Install

Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build24.ipa` onto a registered iPhone.

---

## Rebuild

```bash
cd erp-mobile-app
bash scripts/check-xcode-apple-account.sh
npm run ios:ipa:release:mac
```

---

## GitHub

- Notes file: `IOS_DEVELOPMENT_IPA_BUILD24.md` (this file)
- Release notes (for `gh release`): `GH_RELEASE_NOTES_mobile-v1.0.5-build24.md`
- Artifact: `erp-mobile-1.0.5-build24.ipa`
