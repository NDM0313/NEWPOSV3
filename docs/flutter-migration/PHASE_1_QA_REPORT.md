# Phase 1 QA Report — Flutter ERP Foundation

**Date:** 2026-06-11  
**App:** [`erp-flutter-app/`](../../erp-flutter-app/)  
**Scope:** QA and cleanup only — no Phase 2 features

## Commands run

```bash
cd erp-flutter-app
flutter pub get    # OK
flutter analyze    # see below
```

## `flutter analyze` result

**After cleanup (2026-06-11):**

```
Analyzing erp-flutter-app...
No issues found!
```

**Before cleanup:** 8 info-level issues (deprecated `anonKey`, GoRoute `__` builders, dangling library doc comments).

## Files changed in this QA pass

| File | Change |
|------|--------|
| `erp-flutter-app/lib/core/supabase/supabase_bootstrap.dart` | `anonKey` → `publishableKey` |
| `erp-flutter-app/lib/app/router/app_router.dart` | GoRoute builders use `(context, state)` |
| `erp-flutter-app/lib/features/auth/screens/branch_selection_screen.dart` | `separatorBuilder` param names |
| `erp-flutter-app/lib/core/auth/functional_roles.dart` | File comment style (no dangling library doc) |
| `erp-flutter-app/lib/core/permissions/permission_modules.dart` | File comment style |
| `erp-flutter-app/lib/app/config/app_config.dart` | File comment style |
| `docs/flutter-migration/PHASE_1_QA_REPORT.md` | This report |

## Forbidden work check (static code audit)

| Check | Result |
|-------|--------|
| Sales write screens | **None** — home grid shows snackbar only |
| POS write screens | **None** |
| Payment write RPCs (`record_payment_with_accounting`, etc.) | **None** |
| Stock/accounting write RPCs (`record_sale_with_accounting`, `ensure_sale_stock_movements`, etc.) | **None** |
| `insert` / `upsert` on operational tables | **None** |
| Database migrations in `erp-flutter-app/` | **None** |
| VPS / deploy changes | **None** |
| Offline sync (Drift/outbox) | **None** |
| Printing / barcode | **None** |

### Supabase calls in Phase 1 (read-only + auth only)

| Operation | Table / RPC | File |
|-----------|-------------|------|
| SELECT | `users` | `auth_repository.dart` |
| Auth | `signInWithPassword`, `signOut`, session restore | `auth_repository.dart` |
| SELECT | `role_permissions` | `permission_repository.dart` |
| SELECT | `modules_config` | `settings_repository.dart` |
| SELECT | `branches` | `branch_repository.dart` |
| SELECT | `user_branches` | `branch_repository.dart` |
| RPC (read) | `get_effective_user_branch` | `branch_repository.dart` |

**Confirmation:** No money, stock, or accounting write paths were added in Phase 1.

## Functional QA status

Automated login QA was **not run** in this session (requires production anon key and live test accounts; no credentials in repo).

### Admin login

| Item | Status |
|------|--------|
| Code path: email/password → profile → permissions → home | **Verified in code** |
| `is_admin_or_owner` bypass in `hasPermission` | **Verified** |
| All company branches for admin (`getUserAccessibleBranches`) | **Verified** |
| **Manual test on device/emulator** | **Pending operator** |

Operator steps:

```bash
cd erp-flutter-app
flutter run --dart-define=SUPABASE_ANON_KEY='...'
```

Log in as admin → expect full module grid (per `role_permissions` + `modules_config`).

### Salesman login

| Item | Status |
|------|--------|
| Engine role `user` → `role_permissions` for `user` | **Verified in code** |
| `hasPermission` does not bypass for non-admin | **Verified** |
| Restricted module list via `canViewScreen` | **Verified** |
| **Manual test** | **Pending operator** |

### Branch picker

| Item | Status |
|------|--------|
| `AuthStatus.needsBranch` → `/branch` route | **Verified** |
| Admin: all active branches from `branches` table | **Verified** |
| Non-admin: filtered by `user_branches` / RPC merge | **Verified** |
| Selection persisted in `flutter_secure_storage` | **Verified** |
| `hasBranchAccess` on select | **Verified** |
| **Manual multi-branch test** | **Pending operator** |

### `modules_config` gating

| Item | Status |
|------|--------|
| Loads `rentals`, `studio`, `accounting`, `pos` | **Verified** |
| `isModuleEnabled` hides rental/studio/pos/accounts when off | **Verified** |
| Fail-closed toggles on load error | **Verified** |
| Admin banner when modules disabled | **Verified** |
| **Manual toggle test (disable POS in web)** | **Pending operator** |

### Logout

| Item | Status |
|------|--------|
| `signOut()` clears Supabase session | **Verified** |
| Clears stored branch id | **Verified** |
| Redirect to `/login` | **Verified** |
| **Manual test** | **Pending operator** |

## Architecture notes (non-blocking)

1. **GoRouter** recreated in `main.dart` on every `authSessionProvider` change — acceptable for Phase 1; refine in Phase 2.
2. **Package ID** `com.dincouture.erp.erp_flutter_app` — parallel to Capacitor; confirm before production pilot.
3. **Google OAuth** not implemented (Capacitor has it).
4. **Supabase URL** hard-coded default `https://erp.dincouture.pk` — matches [`MOBILE_APK_LOCKED_PATTERN.md`](../../docs/infra/MOBILE_APK_LOCKED_PATTERN.md).

## Open issues

1. Operator must run manual login QA with real admin + salesman accounts before Phase 2 money-adjacent work.
2. Confirm VPS RPC `get_effective_user_branch` response shape if branch picker misbehaves on device.
3. iOS not device-tested.
4. `graphify-out/` may show unrelated repo changes from prior sessions.

## Recommendation

| Verdict | Detail |
|---------|--------|
| **Code / analyze** | **Ready** — `flutter analyze` clean; no forbidden writes; parity with Capacitor permission patterns. |
| **Phase 2 start** | **Conditionally ready** — proceed after operator completes **manual** admin/salesman login, branch picker, and modules_config toggle checks on one Android device (15 min smoke). |

Do **not** start Phase 3 (sales/POS/payments) until live RPC version check from migration docs is done.

## Related docs

- [PHASE_1_COMPLETION.md](PHASE_1_COMPLETION.md)
- [11_AGENT_NEXT_STEPS.md](11_AGENT_NEXT_STEPS.md)
- [09_MIGRATION_PHASE_PLAN.md](09_MIGRATION_PHASE_PLAN.md)
