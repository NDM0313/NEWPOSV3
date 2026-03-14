# ERP Commission and Payment — Last Mile Report

## Summary

This report documents the five targeted fixes applied for the sales payment and commission workflow. All changes are **local only**; no live VPS changes.

---

## Issue 1 — Payment dialog auto-fill amount

**Root cause:** The payment dialog always initialized the amount to `0` when opening in "add payment" mode, instead of using the sale’s due amount.

**Files changed:**  
- `src/app/components/shared/UnifiedPaymentDialog.tsx`  
  - Set initial amount to `Math.max(0, effectiveOutstanding)` when opening for a new payment.  
  - Added `effectiveOutstanding` to the effect dependency array.

**Exact UI behavior:**  
- Fully unpaid sale → dialog opens with amount = full due.  
- Partially paid sale → dialog opens with amount = remaining due.  
- User can still change the amount before saving.

**Verification:**  
- Case A: New sale → open payment dialog → amount = full amount.  
- Case B: Partial payment → Add Payment again → amount = remaining due.

**Rollback:** Revert to `setAmount(0)` in the else branch and remove `effectiveOutstanding` from dependencies.

---

## Issue 2 — Post Commission RLS error

**Root cause:** Table `commission_batches` had no RLS policies allowing INSERT for the authenticated user, causing 403 and "new row violates row-level security policy".

**Files / SQL changed:**  
- **New:** `migrations/commission_batches_rls_company_scoped.sql`  
  - Enable RLS on `commission_batches`.  
  - SELECT: company-scoped and optional branch via `get_user_company_id()`, `has_branch_access(branch_id)`.  
  - INSERT: same company and branch checks.  
  - UPDATE: company-scoped (e.g. set `journal_entry_id` after creating JE).

**Verification:**  
- Case C: Reports → Commission → Post Commission completes without 403; batch and JE are created; report refreshes.

**Rollback:** Run migration that disables RLS or drops the new policies (see `ERP_COMMISSION_BATCH_RLS_FIX.md`).

---

## Issue 3 — User default commission and pending sales

**Root cause:** No stored default commission % per user and no application of it when selecting a salesman on a new sale.

**Files / SQL changed:**  
- **New:** `migrations/users_default_commission_percent.sql` — add `users.default_commission_percent` (optional).  
- `src/app/services/userService.ts` — extend `User` with `default_commission_percent`.  
- `src/app/components/sales/SaleForm.tsx` — salesmen list includes `defaultCommissionPercent`; effect for new sales sets commission type and value from selected salesman’s default when present.  
- Pending sales are **not** auto-updated when default changes; a future "Recalculate pending commission" action can do that safely (pending only).

**Verification:**  
- Case D: Set a user’s `default_commission_percent` (DB or future UI); new sale with that salesman → default % and amount applied; admin can override; existing sale commission unchanged.

**Rollback:** Revert SaleForm and User type; optionally drop column `users.default_commission_percent`.

---

## Issue 4 — Self-created salesman sales in report

**Root cause:** Auto-assign of salesman for non-admin users matched only by name; if the match failed, the sale was saved without `salesman_id` and did not appear in the commission report.

**Files changed:**  
- `src/app/components/sales/SaleForm.tsx`  
  - Auto-assign effect now matches current user to salesmen by **id** first (`user.id` === `salesmen[].id`), then by name.  
  - Effect depends on `salesmen` so it runs after the list is loaded.

**Verification:**  
- Case E: Log in as salesman → create new sale (leave salesman as pre-filled) → save → Reports → Commission shows that sale for that salesman.

**Rollback:** Revert the auto-assign effect to name-only match and remove `salesmen` from dependencies.

---

## Issue 5 — POS sales in commission

**Root cause:** Web POS did not send `salesmanId` or commission fields to `createSale()`, so POS sales had null `salesman_id` and did not appear in the commission report.

**Files changed:**  
- `src/app/components/pos/POS.tsx`  
  - Add to `saleData`: `salesmanId: (user as any)?.id ?? null`, `commissionAmount: 0`, `commissionPercent: null`.  
  - Backend (SalesContext/saleService) already persists these; no backend change.

**Verification:**  
- Case F: Complete a POS sale as admin or salesman → Reports → Commission (Include due sales) shows the sale; sale detail shows salesman/commission.

**Rollback:** Remove `salesmanId`, `commissionAmount`, and `commissionPercent` from the POS `saleData` object.

---

## Case G — No repeat posting

**Requirement:** Posted commission sales must not be posted again.

**Status:** Unchanged. Existing logic in `commissionReportService.postCommissionBatch` only selects sales with `commission_status` null or `'pending'` and updates them to `'posted'` with `commission_batch_id`. Sales already posted are excluded by the query and are not updated again.

---

## Docs created/updated

- `docs/ERP_PAYMENT_DIALOG_AUTOFILL_FIX.md`  
- `docs/ERP_COMMISSION_BATCH_RLS_FIX.md`  
- `docs/ERP_DEFAULT_COMMISSION_PENDING_RECALC_FIX.md`  
- `docs/ERP_SELF_SALESMAN_COMMISSION_FIX.md`  
- `docs/ERP_POS_COMMISSION_FIX.md`  
- `docs/ERP_COMMISSION_AND_PAYMENT_LAST_MILE_REPORT.md` (this file)

---

## Applying migrations (local)

1. **commission_batches RLS** (required for Post Commission):  
   Run `migrations/commission_batches_rls_company_scoped.sql` in Supabase SQL Editor.

2. **User default commission** (optional):  
   Run `migrations/users_default_commission_percent.sql` if you want default commission % per user and the SaleForm behavior above.
