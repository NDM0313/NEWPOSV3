# 09 — Migration Phase Plan

Phased Flutter rollout for DIN Collection ERP. **Do not skip acceptance gates** on money modules.

Assumed Flutter root: **`erp-flutter-app/`** at repo root (sibling to `erp-mobile-app/`).

## Recommended `lib/` architecture

```
lib/
  main.dart
  app/
    router/
    theme/
    config/
  core/
    supabase/
    auth/
    permissions/
    errors/
    utils/
    widgets/
  features/
    auth/
    dashboard/
    contacts/
    products/
    inventory/
    sales/
    payments/
    rentals/
    purchases/
    studio/
    expenses/
    accounting/
    reports/
    settings/
  data/
    models/
    repositories/
    local_db/
    sync/
  device/
    printing/
    barcode/
    camera/
    sharing/
```

## Recommended packages

| Package | Use |
|---------|-----|
| `flutter` / `flutter_localizations` | SDK |
| `supabase_flutter` | Auth + PostgREST + RPC |
| `go_router` | Navigation |
| `flutter_riverpod` (or `bloc`) | State |
| `drift` + `sqlite3_flutter_libs` | Local DB / outbox |
| `flutter_secure_storage` | Session + PIN secrets |
| `freezed` + `json_serializable` | Models |
| `connectivity_plus` | Network status |
| `mobile_scanner` | Barcode |
| `pdf` + `printing` | PDF / print preview |
| `share_plus` | Share sheet |
| `intl` | Currency/date formatting |

Thermal Sunmi/Bluetooth: platform channels (port `ErpPrinterPlugin`) or `esc_pos_utils` + Bluetooth package.

---

## Phase 0: Audit and docs (this task)

| Item | Detail |
|------|--------|
| **Scope** | `docs/flutter-migration/*.md` only |
| **Files to create** | 11 markdown handoff docs |
| **Do not touch** | `migrations/`, `deploy/`, production VPS, app code |
| **Acceptance** | All docs cross-linked; RPC/table names from repo |
| **Risk** | Low |

---

## Phase 1: Flutter foundation / auth / permissions

| Item | Detail |
|------|--------|
| **Scope** | Project scaffold, Supabase init, login/logout, session restore, profile load (`users`), branch resolution (`get_effective_user_branch`), `role_permissions` + `modules_config`, branch picker, home shell with gated module grid (no module bodies) |
| **Files to create** | `erp-flutter-app/` full tree skeleton; `core/supabase/`, `core/auth/`, `core/permissions/`, `features/auth/`, `app/router/`, `app/theme/` |
| **Reference** | [`erp-mobile-app/src/api/auth.ts`](../../erp-mobile-app/src/api/auth.ts), [`permissions.ts`](../../erp-mobile-app/src/api/permissions.ts), [`PermissionContext.tsx`](../../erp-mobile-app/src/context/PermissionContext.tsx), [`functionalRoles.ts`](../../erp-mobile-app/src/config/functionalRoles.ts) |
| **Do not touch** | `migrations/`, GL RPC bodies, Kong/nginx, Capacitor app |
| **Acceptance** | Login as admin + salesman; branch load; module grid hides blocked modules; permission loading gate; native URL `https://erp.dincouture.pk` |
| **Risk** | Medium |

---

## Phase 2: Read-only modules

| Item | Detail |
|------|--------|
| **Scope** | Contacts list/detail (read), products list (read), dashboard metrics (read), branch-scoped filters |
| **Files** | `features/contacts/`, `features/products/`, `features/dashboard/`, `data/repositories/` |
| **Reference** | [`api/contacts.ts`](../../erp-mobile-app/src/api/contacts.ts), [`products.ts`](../../erp-mobile-app/src/api/products.ts), [`dashboardMetrics.ts`](../../erp-mobile-app/src/api/dashboardMetrics.ts) |
| **Do not touch** | Write RPCs, offline queue |
| **Acceptance** | Lists match web counts for test branch; salesman own-scope on contacts/sales preview |
| **Risk** | Low |

---

## Phase 3: Core write modules

| Item | Detail |
|------|--------|
| **Scope** | Sales (draft/final), POS, payments (`record_payment_with_accounting`), contact/product create |
| **Files** | `features/sales/`, `features/payments/`, `data/repositories/sales_repository.dart` |
| **Reference** | [`api/sales.ts`](../../erp-mobile-app/src/api/sales.ts), [`accounts.ts`](../../erp-mobile-app/src/api/accounts.ts) |
| **Do not touch** | Custom client-side numbering; direct JE inserts bypassing RPC |
| **Acceptance** | Full sale finalize chain; payment RCV; stock + JE on server; QA checklist sale/payment sections |
| **Risk** | **High** (money, stock) |

**Gate:** Confirm live DB RPC versions before starting.

---

## Phase 4: Accounting / reporting

| Item | Detail |
|------|--------|
| **Scope** | Ledger views, manual JE, expenses, purchases, rentals (write paths) |
| **Files** | `features/accounting/`, `features/expenses/`, `features/purchases/`, `features/rentals/`, `features/reports/` |
| **Reference** | [`api/purchases.ts`](../../erp-mobile-app/src/api/purchases.ts), [`expenses.ts`](../../erp-mobile-app/src/api/expenses.ts), [`rentals.ts`](../../erp-mobile-app/src/api/rentals.ts), [`partyGlLedger.ts`](../../erp-mobile-app/src/api/partyGlLedger.ts) |
| **Do not touch** | GL account structure migrations |
| **Acceptance** | PUR/EXP finalize; party ledger matches web for sample contacts |
| **Risk** | **High** |

---

## Phase 5: Offline sync

| Item | Detail |
|------|--------|
| **Scope** | Drift outbox + list cache; `enqueueOrRun` parity; sync banner; idempotency keys |
| **Files** | `data/local_db/`, `data/sync/` |
| **Reference** | [`offlineStore.ts`](../../erp-mobile-app/src/lib/offlineStore.ts), [`registerSyncHandlers.ts`](../../erp-mobile-app/src/lib/registerSyncHandlers.ts), [05_OFFLINE_SYNC_RULES.md](05_OFFLINE_SYNC_RULES.md) |
| **Do not touch** | Server numbering / trigger behavior |
| **Acceptance** | Offline sale syncs once; ERROR retry; no duplicate payments |
| **Risk** | **High** |

---

## Phase 6: Device features

| Item | Detail |
|------|--------|
| **Scope** | Studio module, packing, thermal print, barcode scan, WhatsApp/PDF share, counter/PIN mode |
| **Files** | `device/printing/`, `device/barcode/`, `features/studio/`, `features/settings/` (printer) |
| **Reference** | [06_PRINTING_BARCODE_DEVICE_RULES.md](06_PRINTING_BARCODE_DEVICE_RULES.md), [`api/studio.ts`](../../erp-mobile-app/src/api/studio.ts) |
| **Do not touch** | Android signing keys in repo |
| **Acceptance** | Sunmi print on device; POS scan; studio stage RPC smoke test |
| **Risk** | Medium |

---

## Phase 7: QA and production release

| Item | Detail |
|------|--------|
| **Scope** | Full [08_TESTING_QA_CHECKLIST.md](08_TESTING_QA_CHECKLIST.md); staged rollout; APK release |
| **Files** | Release scripts, CI (optional), version bump |
| **Reference** | [10_PRODUCTION_RELEASE_CHECKLIST.md](10_PRODUCTION_RELEASE_CHECKLIST.md) |
| **Do not touch** | Force push; production DB migrations without approval |
| **Acceptance** | Sign-off checklist; rollback plan documented |
| **Risk** | **High** |

---

## Global do-not-touch list (all phases)

- [`migrations/`](../../migrations/) destructive changes (DROP, RLS bulk replace, trigger rewrites)
- [`deploy/`](../../deploy/) Kong, nginx, VPS env without explicit approval
- Production Supabase direct writes for testing
- Multi-currency exchange app codebase (not in this ERP scope)
- [`src/`](../../src/) web ERP unless fixing shared contract bugs with coordinated migration

## Parallel operation strategy

Keep **Capacitor APK** (`erp-mobile-app`) in production until Flutter reaches Phase 3+ parity on sales/POS. Both clients share one backend — no schema fork.
