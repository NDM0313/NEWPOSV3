# Flutter ERP migration — completion summary

**App:** `erp-flutter-app/`  
**Version:** `1.0.5+6`  
**Status:** Phases 0–7 + Phase 8B/8C **code complete**; Phase 8A device QA + signed APK pending sign-off.

## Phase completion

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Docs | Done | `00`–`11`, status + phase completion files |
| 1 Auth / permissions | Done | Login, branch, module grid |
| 2 Read modules | Done | Contacts, products, dashboard |
| 2.5 Sales/purchases read | Done | Lists + detail |
| 3 Core writes | Done | Sales, POS, purchases, expenses |
| 4 Accounting adjacency | Done | Party ledger, journal list, void/return/cancel |
| 5 Offline | Done | Drift queue (8 types) + list cache |
| 6 Device features | Done | Sunmi/BT print, barcode wedge, share/PDF |
| 7 Release prep | Done | Build scripts (sh + ps1), signing template |
| 8B Thermal print | Done | `ErpPrinterChannel` + settings + POS auto-print |
| 8C Deep offline + PIN | Done | Drift, journal offline, counter PIN, studio GL |

## Module write coverage

- Sales: create, edit, finalize, pay, void, return, share, print preview
- POS: checkout + barcode camera + keyboard wedge + auto-print
- Purchases: draft, finalize, pay, cancel (incl. offline cancel queue)
- Expenses: create
- Rentals: create booking, pay, pickup, return
- Studio: assign, send, receive, confirm cost, complete, invoice line, GL finalize
- Ledger: manual journal create (online + offline)
- Contacts / products: create + edit
- Settings: printer + counter PIN enroll

## Remaining for production (Phase 8A gate)

| Item | Status |
|------|--------|
| Device QA on test company | Pending — see `QA_SESSION_LOG.md` |
| Signed APK + install on Sunmi/phone | Pending — configure `key.properties` |
| Capacitor parity sign-off | Pending |

## Documented non-goals

| Item | Notes |
|------|-------|
| WhatsApp-specific PDF intent | `share_plus` share sheet |
| iOS native thermal print | Android-only Sunmi/BT channel |

## Before production distribution

Follow **[`12_OFFICE_REMAINING_PHASE.md`](12_OFFICE_REMAINING_PHASE.md)** (Phase 8A–8C).

Quick list:

1. `./scripts/smoke-api-check.sh` then `QA_SESSION_LOG.md` + `08_TESTING_QA_CHECKLIST.md`
2. `10_PRODUCTION_RELEASE_CHECKLIST.md` vs Capacitor
3. `android/key.properties` + keystore → `./scripts/build-release-apk.sh`
4. User sign-off in QA log

## Build

```bash
cd erp-flutter-app
./scripts/build-release-apk.sh
```
