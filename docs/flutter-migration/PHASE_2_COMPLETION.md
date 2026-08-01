# Flutter Phase 2 — Completion Report

**Date:** 2026-06-11  
**Scope:** Read-only Contacts, Products, Dashboard (no writes, offline, printing, migrations)  
**App path:** [`erp-flutter-app/`](../../erp-flutter-app/)

## Delivered

| Area | Status | Notes |
|------|--------|-------|
| Contacts list | Done | `contacts` SELECT, role filter chips, search |
| Contact detail | Done | Read-only fields; balance gated by ledger permissions |
| Products list | Done | `products` SELECT, branch filter via `product_branches`, search |
| Product detail | Done | Retail/wholesale; cost/stock gated by `inventory.view` |
| Dashboard | Done | `get_dashboard_metrics` RPC; worker-scoped fallback for salesman |
| Home navigation | Done | Contacts / Products / Dashboard open real screens |
| Other modules | Done | Snackbar “coming in a later phase” |
| Loading / error / empty | Done | Shared widgets + per-screen states |
| Repositories | Done | Under `lib/data/repositories/` |
| Feature folders | Done | `contacts/`, `products/`, `dashboard/` |

## `flutter analyze`

```bash
cd erp-flutter-app && flutter analyze
```

**Result (2026-06-11):** `No issues found!`

## Files created / changed (Phase 2)

### New — data layer

| File | Role |
|------|------|
| `lib/data/models/contact.dart` | Contact DTO + `ContactRoleFilter` |
| `lib/data/models/product.dart` | Product DTO |
| `lib/data/models/dashboard_metrics.dart` | Dashboard metrics + low stock |
| `lib/data/repositories/contacts_repository.dart` | Read `contacts`; optional `get_contact_party_gl_balances` |
| `lib/data/repositories/products_repository.dart` | Read `products`, `product_branches`, `stock_movements` |
| `lib/data/repositories/dashboard_repository.dart` | `get_dashboard_metrics` + worker sales fallback |

### New — core / shared

| File | Role |
|------|------|
| `lib/core/utils/branch_id.dart` | `safeRpcBranchId`, `isRealBranchUuid` |
| `lib/core/utils/formatters.dart` | `formatMoney` |
| `lib/core/session/session_scope.dart` | Company / branch from session |
| `lib/core/permissions/contact_balance_visibility.dart` | Balance display rules |
| `lib/core/widgets/module_scaffold.dart` | Module app bar + search field |
| `lib/core/widgets/app_error_state.dart` | Error + retry |
| `lib/core/widgets/metric_card.dart` | Dashboard metric tiles |

### New — features

| File | Role |
|------|------|
| `lib/features/contacts/providers/contacts_providers.dart` | Riverpod list + detail |
| `lib/features/contacts/screens/contacts_list_screen.dart` | List + filter + search |
| `lib/features/contacts/screens/contact_detail_screen.dart` | Read-only detail |
| `lib/features/products/providers/products_providers.dart` | Riverpod list + detail |
| `lib/features/products/screens/products_list_screen.dart` | List + search |
| `lib/features/products/screens/product_detail_screen.dart` | Read-only detail |
| `lib/features/dashboard/providers/dashboard_providers.dart` | Dashboard Riverpod |
| `lib/features/dashboard/screens/dashboard_screen.dart` | Metrics grid + low stock |

### Modified (Phase 1 → Phase 2)

| File | Change |
|------|--------|
| `lib/features/auth/providers/repository_providers.dart` | Register Phase 2 repos |
| `lib/app/router/app_router.dart` | Routes `/contacts`, `/products`, `/dashboard` |
| `lib/app/router/module_navigation.dart` | Navigate vs placeholder snackbar |
| `lib/features/home/home_screen.dart` | Module cards use real navigation |

## Read paths & RPCs (read-only)

| Operation | Method |
|-----------|--------|
| Contacts list/detail | `contacts` SELECT |
| Contact GL balances | `get_contact_party_gl_balances` RPC (optional) |
| Products list/detail | `products` SELECT (+ joins) |
| Branch product filter | `product_branches` SELECT |
| Stock (read) | `stock_movements` SELECT (sum by product) |
| Dashboard (admin/manager) | `get_dashboard_metrics` RPC |
| Dashboard (salesman) | `sales` SELECT (today, `status=final`, `created_by` scope) |

**No** `.insert()`, `.upsert()`, `.update()` on Supabase tables. **No** stock/accounting/payment write RPCs.

## QA — Contacts (read-only)

| Check | Expected |
|-------|----------|
| Open Contacts from home | List loads for company |
| Filter Customers / Suppliers / Workers | Type filter applied server-side |
| Walk-in / system contact | Visible (`is_system_generated` not filtered out) |
| Search name / phone / code | Client-side filter |
| Tap row | Detail screen read-only |
| Salesman balance | Hidden unless `canViewBalances` + ledger permission for type |
| Admin balance | Shown when RPC + ledger permissions allow |
| RLS deny | Empty list or “not found” — not a crash |
| Edit affordance | None |

## QA — Products (read-only)

| Check | Expected |
|-------|----------|
| Open Products from home | List loads |
| Branch scope | Products restricted by `product_branches` when configured |
| Search name / SKU / barcode | Client-side filter |
| Retail price | Shown when module visible |
| Cost price | Hidden unless `inventory.view` (+ adjust for non-admin) |
| Stock | Shown when `inventory.view`; summed from movements for branch |
| Variations | Label “Has variations”; stock not summed on parent |
| Tap row | Read-only detail |
| Stock adjustment | Not available |

## QA — Dashboard (read-only)

| Check | Expected |
|-------|----------|
| Admin / manager | Full `get_dashboard_metrics` cards + low stock |
| Salesman | Worker-scoped: “My sales today” + order count only |
| Financial cards (cash, bank, AR/AP) | Hidden when `!canViewBalances` |
| RPC failure | Error state with message; worker fallback when scoped |
| Write actions | None |

## Admin behavior

- Sees financial dashboard metrics when `get_dashboard_metrics` succeeds and role is owner/admin/manager (`canViewFinancialBalances`).
- Contact balances when `canViewCustomerLedger` / `canViewSupplierLedger` / full accounting.
- Product cost and stock when `inventory.view` (and cost when adjust permission or admin).
- Low-stock section on dashboard when RPC returns items.

## Salesman behavior

- Dashboard uses worker-scoped sales query (today’s finalized sales for `created_by`).
- No cash/bank/receivables/payables cards.
- Contact balances hidden by default (`canViewBalances` false for salesman role).
- Retail prices on products; stock only if `inventory.view` granted in `role_permissions`.
- Branch list still from Phase 1 session + RLS.

## RLS / permission issues found

| Issue | Handling |
|-------|----------|
| `get_contact_party_gl_balances` blocked | Falls back to `opening_balance`; no error spam |
| `stock_movements` blocked | Stock shows 0 / hidden per permission |
| `get_dashboard_metrics` blocked for salesman | Worker-scoped `sales` SELECT fallback |
| Empty RLS result | Empty state UI, not crash |
| Ledger view without balance role | Balance column omitted |

**Manual live QA** still required on device with admin + salesman accounts (same as Phase 1).

## Confirmation — no write actions

Verified via codebase search: no Supabase table `.insert()`, `.upsert()`, or `.update()` in `lib/`. RPCs used are read-only (`get_contact_party_gl_balances`, `get_dashboard_metrics`). Phase 1 `get_effective_user_branch` unchanged. Local secure-storage `delete` on logout only.

## Open issues

1. **Manual device QA** — operator smoke test on iOS/Android with live VPS not run in this session.
2. **Variation stock** — parent product stock not aggregated; detail notes variations only.
3. **Dashboard date scope** — worker fallback uses local device date for “today”.
4. **Cost visibility** — uses `inventory.adjust` as proxy for cost visibility for non-admin; may need tuning vs web ERP.
5. **Reports module** — Dashboard uses `reports` permission module; home “Reports” still Phase 3+.

## Recommendation — Phase 3

1. Complete manual Phase 1 + Phase 2 QA on device (admin + salesman, branch switch).
2. **Sales list read-only** — mirror `erp-mobile-app` sales API reads before any finalize/write.
3. **Purchase list read-only** — same pattern as contacts/products.
4. Keep write paths behind explicit phase gates; first write phase should be a single flow (e.g. draft sale) with RPC parity review.
5. Do not add offline sync until read modules are stable against production RLS.

## Run

```bash
cd erp-flutter-app
flutter run --dart-define=SUPABASE_ANON_KEY='...'
```

Tap **Contacts**, **Products**, or **Dashboard** on home. Other modules show “coming in a later phase”.

---

## Phase 2 QA pass (2026-06-11)

### Commands run

```bash
cd erp-flutter-app
flutter pub get    # OK
flutter analyze    # No issues found!
flutter run -d 00008120-001E11D921DB401E \
  --dart-define=SUPABASE_ANON_KEY='...'   # launch smoke — OK
```

### `GIT_WORKFLOW_RULES.txt`

**Diff found (accidental — reverted):**

```diff
@@ -3,7 +3,9 @@
 
 node migration-tools/importToSupabase.js --confirm --target-company-id 597a5292-14c8-4cd8-96bd-c61b5a0d8c92
 
-
+cd erp-flutter-app
+flutter pub get
+flutter run --dart-define=SUPABASE_ANON_KEY='...'
```

**Action:** Reverted with `git checkout -- GIT_WORKFLOW_RULES.txt`. Flutter run notes were pasted into the workflow rules file by mistake; not an intentional rule change.

### `graphify-out/` changes

**Expected** from `graphify update .` after adding `erp-flutter-app/` and `docs/flutter-migration/`:

| File | Change |
|------|--------|
| `graphify-out/.graphify_root` | Path updated to this Mac workspace (`/Users/ndm/Documents/Development/CursorDev/NEWPOSV3`) |
| `graphify-out/GRAPH_REPORT.md` | Regenerated report (date 2026-06-11, corpus + node counts, commit `16f93cdb`) |

Keep these changes if committing graphify output with the Flutter work; otherwise reset graphify separately.

### Device / emulator

| Item | Value |
|------|-------|
| Device | iPhone (wireless) |
| Device ID | `00008120-001E11D921DB401E` |
| OS | iOS 26.5 (23F77) |
| Connection | Wireless debugging |
| Build | Xcode debug install succeeded |

### Launch smoke (agent-verified)

| Check | Result |
|-------|--------|
| `flutter pub get` | Pass |
| `flutter analyze` | Pass — no issues |
| App install on iPhone | Pass |
| Supabase init log | Pass — `Supabase init completed` |
| Hot reload session | Running (debug attach OK) |

### Manual admin QA

**Status: NOT VERIFIED by agent** — requires live admin credentials on device.

Operator checklist (not run in this agent session):

| Step | Operator result |
|------|-----------------|
| Login | _pending_ |
| Branch picker | _pending_ |
| Home module grid | _pending_ |
| Contacts list/detail read-only | _pending_ |
| Products list/detail read-only | _pending_ |
| Dashboard read-only (full financial cards) | _pending_ |
| Logout | _pending_ |

Prior terminal session showed `Signing out user` after launch — suggests logout was exercised once, but full admin module walk-through was not recorded.

### Manual salesman QA

**Status: NOT VERIFIED by agent** — requires live salesman credentials on device.

| Step | Operator result |
|------|-----------------|
| Login | _pending_ |
| Assigned branch behavior | _pending_ |
| Restricted module grid | _pending_ |
| Contacts scope / no balances | _pending_ |
| Products visibility (retail vs cost/stock) | _pending_ |
| Dashboard — worker cards only | _pending_ |
| Financial cards hidden | _pending_ |

**Static expectation (code audit):** salesman gets `canViewBalances == false` → dashboard hides cash/bank/AR/AP; contacts omit balance column; dashboard uses worker-scoped `sales` SELECT fallback.

### Forbidden work audit (2026-06-11)

| Check | Result |
|-------|--------|
| `.insert()` | **None** in `erp-flutter-app/lib` |
| `.upsert()` | **None** |
| `.update()` | **None** |
| Supabase table `.delete()` | **None** |
| `FlutterSecureStorage.delete` on logout | **Only** local branch key clear (`auth_session_provider.dart`) |
| Write RPCs (sales/payments/stock/accounting) | **None** — no `finalize_sale`, `record_payment_with_accounting`, `record_sale_with_accounting`, etc. |
| RPCs present | Read/session only: `get_effective_user_branch`, `get_contact_party_gl_balances`, `get_dashboard_metrics` |
| Table writes via repositories | **None** |
| Migrations in `erp-flutter-app/` | **None** |
| Deploy / VPS changes | **None** |
| Offline sync | **None** |
| Printing / barcode | **None** |

### Open issues (post-QA)

1. **Manual admin + salesman device QA** — still required; agent cannot authenticate without operator credentials.
2. **Variation stock** — parent SKU stock not aggregated.
3. **Worker dashboard “today”** — uses device local date.
4. **Cost visibility heuristic** — `inventory.adjust` proxy for non-admin cost; may differ from web ERP.
5. **Wireless iOS debug** — slower; occasional `Lost connection to device` after session end.
6. **graphify-out** — large diff from corpus refresh; decide at commit time whether to include.

### Final verdict

| Gate | Verdict |
|------|---------|
| Static / analyzer / safety cleanup | **PASS** |
| Launch smoke on physical iPhone | **PASS** |
| Manual admin + salesman module QA | **BLOCKED** (operator pending) |
| **Phase 2 overall** | **BLOCKED** until manual role QA completes |
| **Phase 2.5** (read-only Sales / Purchase lists) | **BLOCKED** — do not start until Phase 2 manual QA is **PASS** |

**Recommendation:** Operator runs admin and salesman checklists on the wireless iPhone (or USB), records pass/fail per row above, then re-run this QA gate. Phase 2.5 can proceed once both roles pass read-only Contacts / Products / Dashboard flows with correct permission boundaries.
