# DIN Collection ERP — Flutter

Native Flutter client for the **old/live DIN Collection ERP**. Same Supabase contract as [`erp-mobile-app/`](../../erp-mobile-app/) and web [`src/`](../../src/).

Migration docs: [`docs/flutter-migration/`](../../docs/flutter-migration/) — **office next steps:** [`12_OFFICE_REMAINING_PHASE.md`](../../docs/flutter-migration/12_OFFICE_REMAINING_PHASE.md)

## Prerequisites

- Flutter SDK 3.41+
- Anon key in `.env.local`, `.env.production`, or `erp-mobile-app/.env.production` → `VITE_SUPABASE_ANON_KEY`

## Configuration

API base is **locked** to `https://erp.dincouture.pk` ([`MOBILE_APK_LOCKED_PATTERN.md`](../../docs/infra/MOBILE_APK_LOCKED_PATTERN.md)).

```bash
cd erp-flutter-app
flutter pub get

flutter run --dart-define=SUPABASE_ANON_KEY='your_anon_key'
```

## Build release APK

Reads `VITE_SUPABASE_ANON_KEY` from the first file found:

- repo root `.env.production`
- repo root `.env.local`
- `erp-mobile-app/.env.production`

```bash
chmod +x scripts/*.sh
./scripts/build-release-apk.sh
```

Or manually:

```bash
flutter analyze
flutter build apk --release --dart-define=SUPABASE_ANON_KEY='your_anon_key'
```

APK: `build/app/outputs/flutter-apk/app-release.apk`

**Package ID:** `com.dincouture.erp.erp_flutter_app` (parallel pilot vs Capacitor `com.dincouture.erp`).

## Install on iPhone (Mac + Xcode)

1. iPhone USB ya **Wireless** (Xcode → Window → Devices) se connect karo.
2. Pehli dafa signing: `./scripts/open-ios-workspace.sh` → Runner target → **Signing & Capabilities** → Team select karo.
3. Install + run (reads anon key from `.env.local` etc.):

```bash
chmod +x scripts/*.sh
./scripts/run-ios-device.sh
```

Specific device:

```bash
flutter devices
./scripts/run-ios-device.sh 00008120-XXXXXXXX ios
```

iPhone par **Trust This Computer** / Developer app trust confirm karo. App name: **Erp Flutter App**.

## Features (summary)

- Auth, branch picker, permission-gated home
- Contacts, products, sales, purchases, expenses (CRUD slices)
- POS with barcode scan
- Offline queue for draft sale, POS, expense, draft purchase, sale/purchase payment, journal entry, purchase cancel
- Share sale as text or PDF
- Rental booking create, rentals/studio/ledger read views

## Project structure

```
lib/
  app/          router, theme, config
  core/         supabase, permissions, network, widgets
  data/         models, repositories, local, sync
  features/     auth, home, sales, pos, …
```

## Pilot exclusions

Native Sunmi thermal print, full Drift DB, counter/PIN enroll — see `PHASE_MIGRATION_COMPLETE.md`.
