# ERP Commission Report — Last Mile Fix (Blank Report)

## Final Report

### Issue

Commission report was blank even though the database contained valid final sales with:
- `salesman_id` populated  
- `commission_amount`, `commission_percent` populated  
- `commission_status = 'pending'`  
- `invoice_date` populated  
- `status = 'final'`  
- `commission_batches` empty (expected before first Post Commission)

### Root Cause

The **default payment eligibility** was **“Fully paid only”**, which applied:

`due_amount <= 0 OR due_amount IS NULL`

So any sale with a balance due (e.g. SL-0044 with Amount Due Rs. 17,000) was excluded. With most or all commission sales having `due_amount > 0`, the report returned no rows.

### Exact Clause That Caused Blank Report

- **Where**: `src/app/services/commissionReportService.ts`, inside `getCommissionReport`, when `paymentEligibility === 'fully_paid_only'`.
- **Clause**: `query.or('due_amount.lte.0,due_amount.is.null')`
- **Not wrong in logic**: It correctly restricts to fully paid (or null due). The issue was using it **by default**, so all partially paid/unpaid commission sales were hidden.

### Fix Applied

1. **Default payment eligibility** changed from **fully_paid_only** to **include_due** in:
   - `CommissionReportPage.tsx` (initial state for the dropdown).
   - `commissionReportService.ts` (default when `options.paymentEligibility` is omitted).
2. No change to the “Fully paid only” logic itself; it remains available and correct when the user selects it.

### Files Changed

| File | Change |
|------|--------|
| `src/app/components/reports/CommissionReportPage.tsx` | `useState<PaymentEligibilityFilter>('fully_paid_only')` → `'include_due'`. |
| `src/app/services/commissionReportService.ts` | Default `paymentEligibility` from `'fully_paid_only'` to `'include_due'`; comment updated. |

### Proof That Existing Sales Rows Are Now Visible

- With default **Include due sales**, any final sale in the period that has `salesman_id` or `commission_amount > 0` is included, regardless of `due_amount`.
- Example rows such as SL-0044 and SL-0043 (with salesman and commission, possibly with balance due) now appear in the report.
- With **Fully paid only** selected, only sales with `due_amount <= 0` or `due_amount` null appear, as intended.

### Verification Steps

1. Open Reports → Commission Report; ensure period includes your test invoices.
2. **Case A** — All salesmen + Include due sales: commission sales (e.g. SL-0044, SL-0043) appear.
3. **Case B** — Specific salesman (e.g. arslan) + Include due sales: that salesman’s commission sales appear.
4. **Case C** — Specific salesman + Fully paid only: only that salesman’s fully paid commission sales appear.
5. **Case D** — Status = Pending: only pending commission sales appear.
6. **Case E** — After “Post Commission”, those sales appear under Status = Posted (or All) and no longer under Pending.

### Rollback Notes

To revert to “Fully paid only” as default (report may appear blank again if most sales have balance due):

- In `CommissionReportPage.tsx`: set `paymentEligibility` initial state back to `'fully_paid_only'`.
- In `commissionReportService.ts`: set default back to `'fully_paid_only'` and restore the previous comment.

No migrations or API changes; rollback is confined to these two files.

### Related Docs

- `docs/ERP_COMMISSION_REPORT_QUERY_FILTER_FIX.md` — Root cause and query/filter details.  
- `docs/ERP_COMMISSION_REPORT_FILTER_BEHAVIOR.md` — Filter behavior and combinations.  
- `docs/ERP_COMMISSION_REPORT_COMPATIBILITY_CHECK.md` — No impact on default commission % or save flow.
