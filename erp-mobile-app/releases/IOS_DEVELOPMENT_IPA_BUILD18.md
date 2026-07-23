# iOS Development IPA — Build 18 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 18 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`

---

## Status

**IPA file:** **BUILT** — `releases/erp-mobile-1.0.5-build18.ipa` (2026-07-10)

---

## Changelog vs build 17

- **Trial Balance (mobile):** account rows redesigned — prominent **Current** balance on the right; labeled **Debit** / **Credit** sublines below account name (no more confusing Dr/Cr/Bal column grid). Tap a row to open Account Ledger.
- **Copy transaction:** duplicate manual receipts/payments and sale/purchase RCV/PAY rows into General Entry step 3 (IN/OUT accounts prefilled).
- **Party account enrichment:** sale-linked receipts resolve party AR account for Copy button.
- **PdfPreviewModal:** compact header and close button alignment.

---

## Install

Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build18.ipa` onto registered iPhone.

---

## UAT checklist (build 18 — Trial Balance + Copy)

| # | Check |
|---|--------|
| 1 | Reports → Trial Balance → MCB row shows **Current** balance + labeled Debit/Credit |
| 2 | Tap any Trial Balance account → Account Ledger opens for that account |
| 3 | Totals footer shows Debit / Credit / Difference |
| 4 | Transactions timeline → RCV sale row → **Copy** opens General Entry with accounts prefilled |
| 5 | PDF preview header compact; close button aligned |

---

## Rebuild

```bash
cd erp-mobile-app
bash scripts/check-xcode-apple-account.sh
npm run ios:ipa:release:mac
```
