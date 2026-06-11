# Flutter ERP migration — master status

**App path:** `erp-flutter-app/`  
**Backend:** `https://erp.dincouture.pk` (locked)  
**Version:** `1.0.5+6`  
**Last updated:** Phase 8A/8B/8C implementation pass

## Phase summary

| Phase | Status | Doc |
|-------|--------|-----|
| 0–7 Code | Done | `PHASE_MIGRATION_COMPLETE.md` |
| **8A Production gate** | **In progress** — automated checks pass; device QA + signed APK pending | `QA_SESSION_LOG.md` |
| **8B Device parity** | **Implemented** — Sunmi/BT channel, settings, POS auto-print | `06_PRINTING_BARCODE_DEVICE_RULES.md` |
| **8C Deep offline + PIN** | **Implemented** — Drift queue, journal offline, purchase cancel, counter PIN, studio GL | `05_OFFLINE_SYNC_RULES.md` |

## Implemented modules (routes)

Same as Phase 7 plus:

- Settings: printer config, counter PIN enroll, shared counter mode
- Ledger: manual journal create (`/ledger/new`)
- POS: keyboard wedge barcode, auto-print after checkout
- Android: `ErpPrinterChannel` (Sunmi AIDL + Bluetooth SPP)

## Offline queue types (Drift)

`draftSale`, `posSale`, `expense`, `draftPurchase`, `salePayment`, `purchasePayment`, `journalEntry`, `purchaseCancel`

List cache: products, contacts, branches, payment accounts (Drift).

## Before production APK distribution

1. Complete device QA on **test company** — `QA_SESSION_LOG.md`
2. Configure `android/key.properties` + keystore
3. `./scripts/build-release-apk.sh` or `build-release-apk.ps1`
4. User sign-off

## Run

```bash
cd erp-flutter-app
flutter pub get
dart run build_runner build
flutter run --dart-define=SUPABASE_ANON_KEY='...'
./scripts/build-release-apk.sh
```

Windows:

```powershell
.\scripts\smoke-api-check.ps1
.\scripts\build-release-apk.ps1
```
