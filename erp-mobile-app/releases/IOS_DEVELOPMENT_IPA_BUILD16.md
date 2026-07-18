# iOS Development IPA — Build 16 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 16 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`

---

## Status

**IPA file:** **BUILT** — `releases/erp-mobile-1.0.5-build16.ipa` (2026-07-10)

---

## Changelog vs build 15

- **Roznamcha parity (web):** voided-JE payment filter, correction-reversal exclusion, company-wide skipJeIds for manual backfill payments (fixes ghost rows / missing iOS JEs).
- **Write path:** liquidity payment backfill logs warnings; clears orphan `payment_id` when no payment inserted.
- **Day Book / Roznamcha UI:** `journalDescriptionForDisplay`, party line, liquidity chip, session-branch default, journal drill-down sheet.
- **COA alignment:** removed separate Account Transfer quick action; **Transfer** on Chart of Accounts rows → General Entry with credit account pre-filled (web `pure_journal` pattern).
- **General Entry:** always posts `reference_type: journal`.

---

## Install

Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build16.ipa` onto registered iPhone.

---

## UAT checklist (build 16)

| # | Check |
|---|--------|
| 1 | General Entry from iOS → appears in **web** Roznamcha same day/branch |
| 2 | Mobile Roznamcha (Day Book → Cash) shows correct Details (account title, not generic “Supplier Payment”) |
| 3 | COA → **Transfer** on account → General Entry with source account on credit side |
| 4 | No “Account Transfer” button on Accounts home |
| 5 | Login, sales scan, expense attach still work |

---

## Rebuild

```bash
cd erp-mobile-app
bash scripts/check-xcode-apple-account.sh
npm run ios:ipa:release:mac
```
