# Flutter ERP migration — master status

**App path:** `erp-flutter-app/`  
**Backend:** `https://erp.dincouture.pk` (locked)  
**Last updated:** Phase 7 release prep pass

## Phase summary

| Phase | Status | Doc |
|-------|--------|-----|
| 0 Docs | Done | `00_MASTER_CONTEXT.md` … `11_AGENT_NEXT_STEPS.md` |
| 1 Auth / permissions / home | Done | `PHASE_1_COMPLETION.md` |
| 2 Read modules | Done | `PHASE_2_COMPLETION.md` |
| 2.5 Sales/purchases read | Done | `PHASE_2_5_COMPLETION.md` |
| 3 Core writes | Done | `PHASE_3_COMPLETION.md` |
| 4 Accounting adjacency | Partial | `PHASE_4_PARTIAL_COMPLETION.md` |
| 5 Offline awareness | Partial | `PHASE_5_PARTIAL_COMPLETION.md` |
| 6 Device features | Partial | `PHASE_6_PARTIAL_COMPLETION.md` |
| 7 Production release | **Prep partial** | `PHASE_7_RELEASE_PREP.md`, `10_PRODUCTION_RELEASE_CHECKLIST.md` |

## Implemented modules (routes)

| Module | Routes | Writes |
|--------|--------|--------|
| Auth / branch / home | `/login`, `/branch`, `/home` | — |
| Contacts | `/contacts`, `/contacts/new`, `/contacts/:id/edit`, ledger | Create, edit |
| Products | `/products`, `/products/new`, `/products/:id/edit` | Create, edit |
| Sales | list, detail, create, edit, return, payment, void | Full chain |
| POS | `/pos` | Checkout + barcode |
| Purchases | list, detail, create, finalize, pay, cancel | Draft + finalize |
| Expenses | list, detail, create | Create + GL RPC |
| Rentals | list, detail, `/rentals/new` | Create booking |
| Studio | list | Read |
| Accounts / Ledger | `/accounts`, `/ledger` | Read |
| Dashboard / Reports | `/dashboard` | Read |
| Settings | `/settings` | Branch switch |

## Offline queue types

`draftSale`, `posSale`, `expense`, `draftPurchase` — sync via banner / reconnect.

## Not implemented (explicit scope)

- Drift full schema + payment/journal offline types
- Thermal Sunmi / Bluetooth native print
- Studio production pipeline writes
- Sale return is implemented; studio finalize writes not
- Counter/PIN mode

## Before production APK

1. Run `08_TESTING_QA_CHECKLIST.md` on test company
2. Compare money flows with Capacitor app (`10_PRODUCTION_RELEASE_CHECKLIST.md`)
3. Configure release signing (`versionCode` bumped to `2` in `1.0.1+2`)
4. User sign-off for production distribution

## Run

```bash
cd erp-flutter-app
flutter pub get
flutter run --dart-define=SUPABASE_ANON_KEY='...'
flutter build apk --dart-define=SUPABASE_ANON_KEY='...'
```
