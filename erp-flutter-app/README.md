# DIN Collection ERP — Flutter (Phase 1)

Native Flutter client for the **old/live DIN Collection ERP**. Shares the same Supabase backend as [`erp-mobile-app/`](../../erp-mobile-app/) and web [`src/`](../../src/).

**Phase 1 scope:** auth, permissions, branch selection, home module grid (no transactional modules).

Migration docs: [`docs/flutter-migration/`](../../docs/flutter-migration/).

## Prerequisites

- Flutter SDK 3.41+ (`flutter --version`)
- Anon key from repo root `.env.production` → `VITE_SUPABASE_ANON_KEY`

## Configuration

Native API base is **locked** to `https://erp.dincouture.pk` (see [`docs/infra/MOBILE_APK_LOCKED_PATTERN.md`](../../docs/infra/MOBILE_APK_LOCKED_PATTERN.md)).

Pass the anon key at run/build time:

```bash
cd erp-flutter-app
flutter pub get

flutter run \
  --dart-define=SUPABASE_ANON_KEY='paste_anon_key_from_root_env_production'
```

Optional URL override (default is correct for production):

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://erp.dincouture.pk \
  --dart-define=SUPABASE_ANON_KEY='...'
```

Copy [`.env.example`](.env.example) for local reference; `.env` is gitignored.

## Run

```bash
# Android device/emulator
flutter run --dart-define=SUPABASE_ANON_KEY='...'

# Analyze
flutter analyze

# Release APK (debug signing by default)
flutter build apk --dart-define=SUPABASE_ANON_KEY='...'
```

## Package ID

`com.dincouture.erp.erp_flutter_app` — parallel to Capacitor `com.dincouture.erp` (pilot install without replacing existing APK).

## Project structure

```
lib/
  app/          # theme, router, config
  core/         # supabase, auth roles, permissions, widgets
  data/         # models, repositories
  features/     # auth, home
```

## Phase 1 acceptance

- Admin login → all permitted modules on home grid
- Salesman login → restricted modules
- `modules_config` toggles hide POS / rental / studio / accounts
- Multi-branch users see branch picker
- Logout clears session

## Not implemented (Phase 2+)

Sales, POS, payments, offline sync, printing, barcode, studio, purchases, rentals, expenses, accounting writes.
