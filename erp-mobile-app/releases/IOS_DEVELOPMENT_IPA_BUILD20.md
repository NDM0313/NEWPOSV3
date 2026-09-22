# iOS Development IPA — Build 20 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 20 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`

---

## Status

**IPA file:** **BUILT** — `releases/erp-mobile-1.0.5-build20.ipa` (2026-07-12)

Built after **git pull** `origin/main` (`950d654b` roznamcha entr2y) + VPS full deploy (`bash deploy/deploy.sh`).

---

## Changelog vs build 19

- **Upstream (pull):** courier payment flow, duplicate-entry routing, accounts module / general entry updates, web accounting journal type filter + ledger polish, AR/AP Phase 2b rollout docs.
- **Deploy:** production `erp.dincouture.pk` rebuilt from `main` @ `950d654b`.

---

## Install

Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build20.ipa` onto registered iPhone.

---

## Rebuild

```bash
cd erp-mobile-app
bash scripts/check-xcode-apple-account.sh
npm run ios:ipa:release:mac
```
