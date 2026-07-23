# Flutter Phase 1 — Completion Report

**Date:** 2026-06-11  
**Scope:** Foundation only (no sales/POS/payments/offline/device features)  
**App path:** [`erp-flutter-app/`](../../erp-flutter-app/)

## Delivered

| Area | Status | Notes |
|------|--------|-------|
| Flutter scaffold | Done | `erp-flutter-app/` with Android + iOS platforms |
| Supabase init | Done | URL locked to `https://erp.dincouture.pk` |
| Anon key config | Done | `--dart-define=SUPABASE_ANON_KEY` |
| Email/password login | Done | `signInWithPassword` |
| Logout | Done | Clears Supabase session + secure branch key |
| Session restore | Done | Cold start via `currentSession` + profile load |
| `users` profile | Done | `company_id`, `role`, `is_active` check |
| Inactive user logout | Done | Throws if `is_active == false` |
| Branch resolution | Done | `get_effective_user_branch` + `user_branches` merge |
| `role_permissions` | Done | Engine role mapping from `functional_roles.dart` |
| `modules_config` | Done | rental/studio/accounting/pos toggles |
| Permission helpers | Done | `hasPermission`, `hasBranchAccess`, `isModuleEnabled` |
| Branch selection | Done | Multi-branch picker screen |
| Home module grid | Done | Permission + toggle gated cards (stub tap) |
| Dark theme | Done | `#111827` background, `#3B82F6` primary |
| README | Done | Setup and run commands |

## Key files

```
erp-flutter-app/lib/
  main.dart
  app/config/app_config.dart
  app/theme/app_theme.dart
  app/router/app_router.dart
  core/supabase/supabase_bootstrap.dart
  core/auth/functional_roles.dart
  core/permissions/permission_logic.dart
  core/permissions/permission_modules.dart
  data/repositories/auth_repository.dart
  data/repositories/branch_repository.dart
  data/repositories/permission_repository.dart
  data/repositories/settings_repository.dart
  features/auth/providers/auth_session_provider.dart
  features/auth/screens/login_screen.dart
  features/auth/screens/branch_selection_screen.dart
  features/home/home_screen.dart
```

## Parity references (Capacitor)

| Flutter | Capacitor / web |
|---------|-----------------|
| `functional_roles.dart` | `erp-mobile-app/src/config/functionalRoles.ts` |
| `permission_logic.dart` | `erp-mobile-app/src/api/permissions.ts` |
| `permission_modules.dart` | `erp-mobile-app/src/utils/permissionModules.ts` |
| `branch_repository.dart` | `erp-mobile-app/src/api/permissions.ts` |
| `settings_repository.dart` | `erp-mobile-app/src/api/settings.ts` `getModuleConfigs` |

## `flutter analyze`

Run after `flutter pub get`:

```bash
cd erp-flutter-app && flutter analyze
```

Expected: no errors (info-level lints only: underscore in GoRoute builders, deprecated `anonKey` in supabase_flutter).

## Manual acceptance (operator)

1. Run with production anon key:
   ```bash
   flutter run --dart-define=SUPABASE_ANON_KEY='...'
   ```
2. Admin login → home shows modules matching web permissions
3. Salesman login → fewer modules; own-branch behavior
4. Disable POS in web `modules_config` → POS card hidden
5. Multi-branch user → branch picker before home
6. Logout → login screen; re-open app → login (or session if still valid)

## Not implemented (by design)

- Sales, POS, payments, purchases, rentals, studio, expenses, accounting writes
- Offline sync / Drift
- Printing, barcode, WhatsApp share
- Counter/PIN mode
- OAuth Google login
- Database migrations or VPS changes

## Open issues / follow-ups

1. **Package ID:** `com.dincouture.erp.erp_flutter_app` — confirm parallel pilot vs replace Capacitor ID.
2. **iOS:** Scaffold included; not device-tested in Phase 1.
3. **OAuth:** Capacitor uses Google OAuth + deep link; Flutter Phase 6 or explicit request.
4. **Password grant on web host:** Capacitor uses REST grant on native; Flutter uses `signInWithPassword` (verify Kong CORS for Flutter if issues arise).
5. **GoRouter recreation:** Router rebuilds on each session change in `main.dart` — acceptable for Phase 1; consider `refreshListenable` in Phase 2.
6. **Live RPC smoke:** No transactional RPCs called in Phase 1.

## Next phase

**Phase 2:** Read-only contacts, products list, dashboard metrics per [`09_MIGRATION_PHASE_PLAN.md`](09_MIGRATION_PHASE_PLAN.md).
