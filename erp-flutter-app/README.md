# DIN Collection ERP — Flutter

Native Flutter client for the **old/live DIN Collection ERP**. Same Supabase contract as [`erp-mobile-app/`](../../erp-mobile-app/) and web [`src/`](../../src/).

Migration docs: [`docs/flutter-migration/`](../../docs/flutter-migration/) — see [`FLUTTER_MIGRATION_STATUS.md`](../../docs/flutter-migration/FLUTTER_MIGRATION_STATUS.md) for current scope.

## Prerequisites

- Flutter SDK 3.41+
- Anon key from repo root `.env.production` → `VITE_SUPABASE_ANON_KEY`

## Configuration

API base is **locked** to `https://erp.dincouture.pk` ([`MOBILE_APK_LOCKED_PATTERN.md`](../../docs/infra/MOBILE_APK_LOCKED_PATTERN.md)).

```bash
cd erp-flutter-app
flutter pub get

flutter run --dart-define=SUPABASE_ANON_KEY='your_anon_key'
```

## Build release APK

With repo root `.env.production` (reads `VITE_SUPABASE_ANON_KEY`):

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

## Features (summary)

- Auth, branch picker, permission-gated home
- Contacts, products, sales, purchases, expenses (CRUD slices)
- POS with barcode scan
- Offline queue for draft sale, POS, expense, draft purchase
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

## Not in this build

Thermal print, full Drift offline DB, studio production writes. See migration status doc.
