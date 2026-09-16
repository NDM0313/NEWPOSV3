# 11 — Agent Next Steps (Phase 1 Prompt)

Copy the prompt below into a **new Cursor agent session** after this documentation is reviewed.

---

## Prompt: Flutter ERP Phase 1 — Foundation

You are working in the **DIN Collection / DIN Couture old/live ERP** repository (`NEWPOSV3`). This is **not** the multi-currency exchange app.

### Read first (mandatory)

Read all files in `docs/flutter-migration/`:

- `00_MASTER_CONTEXT.md` through `11_AGENT_NEXT_STEPS.md`

Treat as source of truth for RPCs and permissions:

- `erp-mobile-app/src/api/auth.ts`
- `erp-mobile-app/src/api/permissions.ts`
- `erp-mobile-app/src/context/PermissionContext.tsx`
- `erp-mobile-app/src/config/functionalRoles.ts`
- `erp-mobile-app/src/utils/permissionModules.ts`
- `erp-mobile-app/src/lib/resolveSupabaseApiUrl.ts`

Do **not** trust `erp-mobile-app/README.md` module list — use `App.tsx` and `api/*`.

### Task: Create Flutter Phase 1 only

1. Create **`erp-flutter-app/`** at repo root (sibling to `erp-mobile-app/`).

2. Use architecture from `09_MIGRATION_PHASE_PLAN.md`:

```
lib/
  main.dart
  app/router/ theme/ config/
  core/supabase/ auth/ permissions/ errors/ utils/ widgets/
  features/auth/
  data/models/ repositories/
```

3. **Implement:**

   - `supabase_flutter` init with **native Android URL** `https://erp.dincouture.pk` (see `MOBILE_APK_LOCKED_PATTERN.md` — never use `window.location` or raw device localhost)
   - Anon key via `--dart-define=SUPABASE_ANON_KEY=...` or env file (gitignored); document sync from root `.env.production`
   - Email/password login + logout
   - Session restore on cold start
   - Load `public.users` profile (`company_id`, `role`, `is_active`); force sign-out if inactive
   - RPC `get_effective_user_branch` + `user_branches` logic mirroring `erp-mobile-app/src/api/permissions.ts`
   - Load `role_permissions` for engine role from `functionalRoles.ts` mapping
   - Load `modules_config` toggles mirroring `getModuleConfigs()` in `api/settings.ts`
   - `hasPermission('module.action')` matching mobile `PermissionContext`
   - `hasBranchAccess(branchId)` for assigned branches
   - `isModuleEnabled(screen)` for rental/studio/pos/accounts toggles
   - Branch selection screen (admin: all branches; salesman: assigned only)
   - Home shell with **permission-gated module grid** (cards only — no module implementation yet)
   - Dark theme per `07_UI_UX_DESIGN_RULES.md`

4. **Do NOT implement yet:**

   - Sales, POS, payments, or any write RPCs
   - Offline sync / Drift outbox
   - Printing, barcode, studio, purchases
   - Database migrations or edits to `migrations/`
   - Deploy, VPS changes, Kong/nginx changes
   - Counter/PIN mode (Phase 6 unless user requests earlier)

5. **Packages (minimum):**

   `supabase_flutter`, `go_router`, `flutter_riverpod`, `flutter_secure_storage`, `intl`

6. **Acceptance criteria:**

   - Admin login → see all modules user has permission for
   - Salesman login → restricted module grid; own-branch behavior
   - Module hidden when `modules_config` disables POS/rental/studio/accounting
   - Branch picker works for multi-branch users
   - Logout clears session and returns to login

7. **Git:** Do not commit unless user explicitly asks.

### Open questions (ask user only if blocked)

1. Flutter package ID: `com.dincouture.erp` (replace Capacitor) vs `com.dincouture.erp.flutter` (parallel pilot)?
2. iOS in Phase 1 or Android-only?
3. Counter/PIN in Phase 1?

---

## After Phase 1 completes

Proceed to **Phase 2** per `09_MIGRATION_PHASE_PLAN.md`: read-only contacts, products, dashboard.

Phase 3 (sales/POS/payments) requires **live DB RPC version confirmation** before starting.
