# iOS Development IPA — Build 19 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 19 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`

---

## Status

**IPA file:** **BUILT** — `releases/erp-mobile-1.0.5-build19.ipa` (2026-07-12)

Built after **git pull** from `origin/main` (through `74e357f6`) merged with local mobile work.

---

## Changelog vs build 18

- **Trial Balance (mobile):** account rows show **Current** balance prominently; labeled **Debit** / **Credit** sublines; tap row → Account Ledger.
- **Copy transaction:** duplicate manual and sale/purchase RCV/PAY rows into General Entry step 3.
- **PdfPreviewModal:** compact header and close button.
- **Upstream (pull):** pin lock hardening, on-account customer receipt, payment attachment finalize, roznamcha/report reload hooks, journal row presentation refactor.

---

## Install

Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build19.ipa` onto registered iPhone.

---

## UAT checklist (build 19)

| # | Check |
|---|--------|
| 1 | Reports → Trial Balance → balance + labeled Debit/Credit readable |
| 2 | Tap Trial Balance account → Account Ledger opens |
| 3 | Copy transaction on RCV/PAY rows |
| 4 | PDF preview header compact |
| 5 | Settings PIN lock still works after pull merge |

---

## Rebuild

```bash
cd erp-mobile-app
bash scripts/check-xcode-apple-account.sh
npm run ios:ipa:release:mac
```
