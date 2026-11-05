# iOS Development IPA — Build 17 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 17 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`

---

## Status

**IPA file:** **BUILT** — `releases/erp-mobile-1.0.5-build17.ipa` (2026-07-10)

---

## Changelog vs build 16

- **Attachment paste:** clipboard se image paste — action sheet mein **Paste image** sirf tab dikhe jab clipboard mein image ho (confusion kam).
- **Paste fix:** user-gesture preserve (read clipboard pehle, sheet baad mein band); desktop localhost par `Ctrl+V` fallback jab sheet open ho.
- **PdfPreviewModal:** header safe-area height + close button alignment (build 16 follow-up).

---

## Install

Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build17.ipa` onto registered iPhone.

---

## UAT checklist (build 17 — clipboard paste)

| # | Check |
|---|--------|
| 1 | Photos se image copy → General Entry attachment sheet → **Paste image** option dikhe |
| 2 | Bina copy kiye sheet kholein → **Paste image** na dikhe |
| 3 | Paste image tap → file list mein attachment add ho |
| 4 | Camera + gallery ab bhi kaam karein (Payment, Expense, Purchase) |
| 5 | WhatsApp se copy agar fail ho → clear error + gallery fallback |

---

## Rebuild

```bash
cd erp-mobile-app
bash scripts/check-xcode-apple-account.sh
npm run ios:ipa:release:mac
```
