# Flutter Phase 2.5 — Completion Report

**Date:** 2026-06-11  
**Scope:** Read-only Sales and Purchases lists + detail (no writes)  
**App path:** [`erp-flutter-app/`](../../erp-flutter-app/)

## Prerequisite note

[`PHASE_2_COMPLETION.md`](PHASE_2_COMPLETION.md) still records **BLOCKED** for manual admin/salesman QA. Phase 2.5 was implemented per explicit request; **live role QA remains required** before any Phase 3 write work.

## Delivered

| Area | Status | Routes |
|------|--------|--------|
| Sales list | Done | `/sales` |
| Sale detail | Done | `/sales/:id` |
| Purchases list | Done | `/purchases` |
| Purchase detail | Done | `/purchases/:id` |
| Home navigation | Done | Sales + Purchase module cards |
| Read-only UX | Done | No write buttons; read-only banner on detail |

## `flutter analyze`

```bash
cd erp-flutter-app && flutter analyze
```

**Result (2026-06-11):** `No issues found!`

## Files created / changed

### New — data

| File | Role |
|------|------|
| `lib/data/models/sale.dart` | Sale list/detail DTOs |
| `lib/data/models/purchase.dart` | Purchase list/detail DTOs |
| `lib/data/repositories/sales_read_repository.dart` | Read `sales`, `sale_items`/`sales_items`, `payments` |
| `lib/data/repositories/purchases_read_repository.dart` | Read `purchases`, `purchase_items` |

### New — core

| File | Role |
|------|------|
| `lib/core/permissions/counter_data_isolation.dart` | Worker list scoping (mobile parity) |
| `lib/core/utils/sale_document_no.dart` | Invoice / PO number display |
| `lib/core/widgets/read_only_banner.dart` | Detail footer message |
| `lib/core/widgets/detail_section.dart` | Shared detail rows |

### New — features

| File | Role |
|------|------|
| `lib/features/sales/providers/sales_providers.dart` | Riverpod list + detail |
| `lib/features/sales/screens/sales_list_screen.dart` | Search + list |
| `lib/features/sales/screens/sale_detail_screen.dart` | Read-only detail + items + payments |
| `lib/features/purchases/providers/purchases_providers.dart` | Riverpod list + detail |
| `lib/features/purchases/screens/purchases_list_screen.dart` | Search + list |
| `lib/features/purchases/screens/purchase_detail_screen.dart` | Read-only detail + items |

### Modified

| File | Change |
|------|--------|
| `lib/core/session/session_scope.dart` | `role`, `listBranchId`, `accessibleBranchIds` |
| `lib/features/auth/providers/repository_providers.dart` | Register read repos |
| `lib/app/router/app_router.dart` | Sales + purchase routes |
| `lib/app/router/module_navigation.dart` | Navigate Sales / Purchase |

## Read paths (no writes)

| Module | Tables / reads |
|--------|----------------|
| Sales list | `sales` SELECT (+ `branches` join) |
| Sale items | `sale_items` or `sales_items` SELECT |
| Sale payments summary | `payments` SELECT (`reference_type=sale`, not voided) |
| Purchases list | `purchases` SELECT |
| Purchase items | `purchase_items` SELECT (+ count on list) |

**No new RPCs.** No `.insert()`, `.upsert()`, `.update()` on Supabase tables.

## Scoping behavior

| Role | Sales | Purchases |
|------|-------|-----------|
| Admin / owner | Company + selected branch filter | Same |
| Manager / branch scope | `sales.view_branch` / `purchase.view_branch` via RLS + branch filter | Same |
| Salesman (`view_own`) | `created_by` filter + RLS | Same when `purchase.view_own` only |
| RLS deny | Empty / not found UI | Same |

Mirrors `erp-mobile-app` `counterDataIsolation` + list branch scope from session.

## QA — Sales list/detail

| Check | Expected | Agent |
|-------|----------|-------|
| Home → Sales | Opens list | Code only |
| Search invoice/customer | Client filter | Code only |
| Tap row | Detail read-only | Code only |
| Items section | Lines from sale_items | Code only |
| Payments summary | Read payments rows | Code only |
| No finalize / payment buttons | None | **PASS** (static) |
| Worker scope | Own sales when isolated | Code only |

## QA — Purchase list/detail

| Check | Expected | Agent |
|-------|----------|-------|
| Home → Purchase | Opens list | Code only |
| Search PO/supplier | Client filter | Code only |
| Tap row | Detail read-only | Code only |
| Items section | purchase_items | Code only |
| No create/edit/finalize | None | **PASS** (static) |

## Manual admin QA

**NOT VERIFIED** — operator must confirm on device:

- Sales list loads with branch filter
- Sale detail shows invoice, customer, totals, items
- Purchases list loads
- Purchase detail shows supplier, totals, items
- Logout still works

## Manual salesman QA

**NOT VERIFIED** — operator must confirm:

- Restricted sales list (own `created_by` when `view_own` only)
- Purchase list scope matches permissions
- No access to other workers’ documents (RLS)
- Read-only banners on detail screens

## RLS / permission issues (expected)

| Issue | Handling |
|-------|----------|
| `sale_items` vs `sales_items` table name | Fallback try both |
| Payments blocked by RLS | Empty payments section; header paid/due from sale row |
| Worker without branch permission | Empty list + empty state |
| Studio `order_no` only | `readSaleDocumentNo` shows order number |

## Forbidden work audit

| Check | Result |
|-------|--------|
| `.insert()` / `.upsert()` / `.update()` | **None** in `lib/` |
| Supabase `.delete()` | **None** (secure storage delete on logout only) |
| New write RPCs | **None** |
| `finalize_sale`, payments, stock, GL RPCs | **None** |
| Migrations | **None** in `erp-flutter-app/` |
| Deploy / VPS | **None** |
| Offline / print / barcode | **None** |

### RPCs in entire app (unchanged from Phase 2)

- `get_effective_user_branch` (session)
- `get_contact_party_gl_balances` (contacts)
- `get_dashboard_metrics` (dashboard)

## Open issues

1. Phase 2 manual admin/salesman QA still **BLOCKED** in docs.
2. Phase 2.5 manual device QA not run by agent (no credentials).
3. Sale payment summary does not include `payment_allocations` rollup (mobile enriches; header `paid_amount` still shown).
4. No studio charges / shipping enrichment on sale detail (read-only totals from sale row only).
5. List cap 100 rows (mobile uses similar limits on purchase list).

## Recommendation — true Phase 3

1. **Complete manual QA** for Phase 2 + 2.5 on iPhone (admin + salesman).
2. **First write flow:** draft sale create only — single RPC path reviewed against `erp-mobile-app/src/api/sales.ts`.
3. Do **not** bundle finalize, payments, returns, or stock in the same release.
4. Add `payment_allocations` read enrichment on sale detail before payment write UI.
5. Keep POS checkout separate from ERP sales module (different `ErpScreen.pos` gate).

## Run

```bash
cd erp-flutter-app
flutter run --dart-define=SUPABASE_ANON_KEY='...'
```

Tap **Sales** or **Purchase** on home.

## Final verdict

| Gate | Verdict |
|------|---------|
| Implementation complete | **PASS** |
| `flutter analyze` | **PASS** |
| Forbidden work audit | **PASS** |
| Manual role QA | **BLOCKED** |
| **Phase 3 writes** | **BLOCKED** until manual QA passes |
