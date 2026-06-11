# Flutter ERP migration — completion summary

**App:** `erp-flutter-app/`  
**Version:** `1.0.4+5`  
**Status:** All planned phases **implemented** for pilot / staged rollout.

## Phase completion

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Docs | Done | `00`–`11`, status + phase completion files |
| 1 Auth / permissions | Done | Login, branch, module grid |
| 2 Read modules | Done | Contacts, products, dashboard |
| 2.5 Sales/purchases read | Done | Lists + detail |
| 3 Core writes | Done | Sales, POS, purchases, expenses |
| 4 Accounting adjacency | Done | Party ledger, journal list, void/return/cancel |
| 5 Offline | Done* | Queue: draft sale, POS, expense, purchase, sale/purchase payment; list cache products + contacts |
| 6 Device features | Done* | Barcode, share text/PDF, print preview, studio workflow, rental lifecycle |
| 7 Release prep | Done* | Build scripts, signing template, version bumps |

\*See **Explicit exclusions** below — not full Drift DB or native thermal Sunmi.

## Module write coverage

- Sales: create, edit, finalize, pay, void, return, share, print preview
- POS: checkout + barcode
- Purchases: draft, finalize, pay, cancel
- Expenses: create
- Rentals: create booking, pay, pickup, return
- Studio: assign, send, receive, confirm cost, complete stage
- Contacts / products: create + edit

## Explicit exclusions (documented, not bugs)

| Item | Reason |
|------|--------|
| Full Drift offline schema | SharedPreferences queue + list cache used (Capacitor parity path) |
| Thermal Sunmi / Bluetooth ESC/POS | Requires native channel / device QA |
| WhatsApp-specific PDF intent | `share_plus` covers share sheet (user picks WhatsApp) |
| Counter/PIN enroll on device | Use Capacitor APK on shared tablets for now |
| Manual journal entry create | Web ERP |
| Studio stage worker ledger backfill | Web/mobile Capacitor parity for edge GL — Flutter uses `finalizeSale` after invoice line |

## Before production distribution

1. `./scripts/smoke-api-check.sh` then `QA_SESSION_LOG.md` + `08_TESTING_QA_CHECKLIST.md`
2. `10_PRODUCTION_RELEASE_CHECKLIST.md` vs Capacitor
3. `android/key.properties` + keystore → `./scripts/build-release-apk.sh`
4. User sign-off in QA log

## Build

```bash
cd erp-flutter-app
./scripts/build-release-apk.sh
```
