# ERP Commission and POS — Last Mile Closeout

## Summary

Three targeted fixes were implemented (local only):

1. **Commission batches RLS** — Ensure Post Commission works (no 403).
2. **Pending commission recalc** — Controlled “Recalculate Pending” using current user default %; posted sales unchanged.
3. **POS numbering** — POS sales use PS sequence/prefix; normal sales keep SL.

---

## 1. Commission Batches RLS

**Issue:** Post Commission could still return 403 / RLS violation.

**Deliverables:**

- **Original migration:** `migrations/commission_batches_rls_company_scoped.sql` (policies using `get_user_company_id()` and `has_branch_access(branch_id)`).
- **Fallback migration:** `migrations/commission_batches_rls_inline_company.sql` — same policies expressed with **inline subqueries** (no dependency on helper functions). Use this if the original still fails.

**Action:** Run **one** of these in the local Supabase SQL Editor. Then verify: Reports → Commission → Post Commission completes without 403; batch row, journal entry, and sales updates all succeed.

**Doc:** `docs/ERP_COMMISSION_BATCH_RLS_LAST_FIX.md`

---

## 2. Default Commission + Pending Recalc

**Issue:** Need a controlled way to update **pending** sales when user default commission % changes, without touching posted sales.

**Deliverables:**

- **Service:** `recalculatePendingCommissions(params)` in `commissionReportService.ts`:
  - Filters by company, date range, optional branch, optional salesman.
  - Selects only sales with `commission_status` in (null, 'pending') and `commission_batch_id` IS NULL.
  - For each such sale, uses the salesman’s current `users.default_commission_percent` to recompute `commission_percent` and `commission_amount` (base = commission_eligible_amount or total).
  - Updates only those columns; each update is guarded so posted rows are never changed.
- **UI:** “Recalculate Pending” button on Commission Report (next to Post Commission). Calls the service with current report filters, then refetches the report.

**Doc:** `docs/ERP_PENDING_COMMISSION_RECALC_IMPLEMENTATION.md`

---

## 3. POS Numbering (PS Prefix)

**Issue:** POS sales were using the same sequence as normal sales (SL-…).

**Deliverables:**

- **SalesContext:** When `docType === 'pos'`, set `sequenceType = 'PS'` (instead of falling through to `'SL'`).
- **documentNumberService:** Add `'PS'` to the `getNextDocumentNumberGlobal` type union.
- **DB:** No change; `get_next_document_number_global` already supports any type and uses `ELSE UPPER(TRIM(p_type)) || '-'` for prefix (so PS → PS-).

**Result:** Normal sales → SL-xxxx; POS sales → PS-xxxx.

**Doc:** `docs/ERP_POS_NUMBERING_FIX.md`

---

## Files Touched

| Area | File | Change |
|------|------|--------|
| RLS | `migrations/commission_batches_rls_inline_company.sql` | New: inline policies for commission_batches |
| Recalc | `src/app/services/commissionReportService.ts` | Added `recalculatePendingCommissions` |
| Recalc | `src/app/components/reports/CommissionReportPage.tsx` | Recalculate Pending button + handler |
| POS # | `src/app/context/SalesContext.tsx` | `sequenceType` for pos → 'PS' |
| POS # | `src/app/services/documentNumberService.ts` | Type union includes 'PS' |

---

## Verification Checklist

1. **Post Commission:** Run the chosen RLS migration locally → Post Commission works without 403; batch + JE + sales update succeed.
2. **Recalculate Pending:** Change a user’s default_commission_percent → run Recalculate Pending with filters that include that user’s pending sales → only those pending sales update; posted sales unchanged.
3. **POS numbering:** Create a normal sale → SL-xxxx; create a POS sale → PS-xxxx; sequences are independent.

---

## Rollback

- **RLS:** Disable RLS on `commission_batches` or reapply previous policies (see ERP_COMMISSION_BATCH_RLS_LAST_FIX.md).
- **Recalc:** Remove the button/handler and the `recalculatePendingCommissions` function (see ERP_PENDING_COMMISSION_RECALC_IMPLEMENTATION.md).
- **POS numbering:** Revert `sequenceType` and type union so POS again uses SL (see ERP_POS_NUMBERING_FIX.md).
