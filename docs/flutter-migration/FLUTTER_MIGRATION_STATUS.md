# Flutter ERP migration — master status

**App path:** `erp-flutter-app/`  
**Backend:** `https://erp.dincouture.pk` (locked)  
**Version:** `1.0.4+5`  
**Last updated:** Phase 8 office handoff doc added

## Next work (office)

**Start here:** [`12_OFFICE_REMAINING_PHASE.md`](12_OFFICE_REMAINING_PHASE.md) — Phase **8A** QA + signed APK + sign-off (mandatory); 8B/8C optional.

## Phase summary — code phases 0–7 complete (pilot scope)

| Phase | Status | Doc |
|-------|--------|-----|
| 0 Docs | Done | `00_MASTER_CONTEXT.md` … `PHASE_MIGRATION_COMPLETE.md` |
| 1 Auth / permissions / home | Done | `PHASE_1_COMPLETION.md` |
| 2 Read modules | Done | `PHASE_2_COMPLETION.md` |
| 2.5 Sales/purchases read | Done | `PHASE_2_5_COMPLETION.md` |
| 3 Core writes | Done | `PHASE_3_COMPLETION.md` |
| 4 Accounting adjacency | Done | `PHASE_4_PARTIAL_COMPLETION.md` + completion pass |
| 5 Offline awareness | Done | `PHASE_5_PARTIAL_COMPLETION.md` + payment queue |
| 6 Device features | Done | `PHASE_6_PARTIAL_COMPLETION.md` + studio/rental/print |
| 7 Production release | Prep done | `PHASE_7_RELEASE_PREP.md`, `PHASE_MIGRATION_COMPLETE.md` |
| **8 Office / prod gate** | **Not started** | **`12_OFFICE_REMAINING_PHASE.md`** |

## Implemented modules (routes)

| Module | Routes | Writes |
|--------|--------|--------|
| Auth / branch / home | `/login`, `/branch`, `/home` | — |
| Contacts | list, new, edit, ledger | Create, edit |
| Products | list, new, edit | Create, edit |
| Sales | full chain + return | Finalize, pay, void, share, print |
| POS | `/pos` | Checkout + barcode |
| Purchases | list, detail, create | Draft, finalize, pay, cancel |
| Expenses | list, detail, create | Create + GL RPC |
| Rentals | list, detail, new | Create, pay, pickup, return |
| Studio | list, `/studio/:saleId` | Assign, send, receive, confirm, complete |
| Accounts / Ledger | `/accounts`, `/ledger` | Read |
| Dashboard | `/dashboard` | Read |
| Settings | `/settings` | Branch switch |

## Offline queue types

`draftSale`, `posSale`, `expense`, `draftPurchase`, `salePayment`, `purchasePayment`

List cache: products, contacts (read-through on network failure).

## Documented exclusions (not in Flutter pilot)

- Full Drift offline DB + journal offline types
- Native thermal Sunmi / Bluetooth print
- Counter/PIN enroll (Capacitor APK for shared tablets)
- Studio invoice line + auto production finalize (web parity for bill finalize)
- Manual journal entry create (web)

## Before production APK distribution

1. Run `08_TESTING_QA_CHECKLIST.md` on test company
2. Compare money flows with Capacitor (`10_PRODUCTION_RELEASE_CHECKLIST.md`)
3. Configure `android/key.properties` + keystore
4. User sign-off

## Run

```bash
cd erp-flutter-app
flutter pub get
flutter run --dart-define=SUPABASE_ANON_KEY='...'
./scripts/build-release-apk.sh
```
