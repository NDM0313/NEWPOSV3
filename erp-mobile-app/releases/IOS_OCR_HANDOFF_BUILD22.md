# iOS handoff — Receipt OCR + Supplier Bill OCR (Phase 1)

**Date:** 2026-07-18  
**App:** NDM ERP (Capacitor)  
**Branch:** `main`  
**Marketing version:** 1.0.5  
**Next IPA build:** bump `CURRENT_PROJECT_VERSION` to **22** (was 21)

**API base (prod sync):** `https://erp.dincouture.pk`

---

## What’s ready on GitHub (source)

- Bank receipt OCR (Meezan-style) + review sheet Confirm enrich
- Supplier bill OCR detect/parse (S.No, date, this-bill amount, supplier hint)
- Tesseract `eng` + `urd`
- Scan Receipt hub → Supplier Payment seed + fuzzy supplier suggestions
- Payment Auto description ON/OFF
- iOS Capacitor sync already run locally: `npm run cap:sync:ios:prod`

---

## Office: build IPA

```bash
cd /path/to/NEWPOSV3
git checkout main
git pull origin main

cd erp-mobile-app
npm ci   # if needed
npm run cap:sync:ios:prod
bash scripts/check-xcode-apple-account.sh
npm run ios:ipa:release:mac
```

Then install Development IPA on registered iPhone (Xcode → Devices and Simulators).

---

## Quick QA on device

1. Accounts → Scan Receipt → Meezan bank shot → Date + amount + Confirm → payment datetime from OCR.
2. Scan a printed supplier bill (Zarisham/Maryam) → badge **Supplier bill** → Ref/Date/amount → Confirm → Supplier Payment suggestions.
3. Handwritten bills: expect Confirm edits (Phase 1 limitation).

---

## Out of scope (still)

- Auto purchase line items / product match
- Perfect handwriting OCR
