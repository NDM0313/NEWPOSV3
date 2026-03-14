# ERP Commission Report — Forensic Final Fix

## Goal

Fix the Commission report so it shows the same rows that exist in the database for the selected filters, and keep filter behavior and commission batch logic intact.

## Root cause of “blank” report

1. **Payment eligibility default**  
   The default was **Fully paid only**, which filters to `due_amount <= 0 OR due_amount IS NULL`.  
   All commission sales that have a balance due (e.g. SL-0044, SL-0043) were excluded, so the report often showed no rows even when data existed.

2. **No guidance when empty**  
   When the report was empty with “Fully paid only” selected, the UI did not suggest trying “Include due sales”, so users did not know why they saw no data.

## Exact files changed

| File | Change |
|------|--------|
| `src/app/services/commissionReportService.ts` | Default `paymentEligibility` from `'fully_paid_only'` to `'include_due'`. Added dev-only `console.debug` when query returns 0 rows (params + hint for fully_paid_only). |
| `src/app/components/reports/CommissionReportPage.tsx` | Default `paymentEligibility` state from `'fully_paid_only'` to `'include_due'`. Empty state: when `paymentEligibility === 'fully_paid_only'`, show hint to try “Include due sales”. |

## Exact SQL used for ground truth

See `docs/ERP_COMMISSION_REPORT_GROUND_TRUTH_SQL.md` and `docs/commission_report_ground_truth.sql`. Example (Include due sales, all salesmen, all branches):

```sql
SELECT COUNT(*) AS row_count, COALESCE(SUM(s.commission_amount), 0) AS total_commission
FROM sales s
WHERE s.company_id = 'YOUR_COMPANY_ID'
  AND s.status = 'final'
  AND s.invoice_date >= '2015-12-31'
  AND s.invoice_date <= '2026-03-14'
  AND (COALESCE(s.commission_amount, 0) > 0 OR s.salesman_id IS NOT NULL);
```

Run with your company ID and date range; compare row count and totals with the report UI when filters are: All salesmen, All branches, All status, **Include due sales**.

## UI bug point

- **Not a render bug**: The condition `hasData = data && data.summary.length > 0` is correct.
- **Bug**: Default **Fully paid only** hid all sales with balance due, and the empty state did not explain this. Fix: default to **Include due sales** and add an empty-state hint when “Fully paid only” is selected.

## Proof that SQL rows now appear in the report

1. Set **Payment eligibility** to **Include due sales** (or leave default).
2. Set **Salesperson** to **All salesmen** (or a specific one, e.g. arslan).
3. Set **Branch** to **All branches**, **Status** to **All**.
4. Use a period that includes your test invoices (e.g. “From start” or the range in the screenshot).
5. The report should list the same invoices and totals as the ground truth SQL for that company and date range (e.g. SL-0044, SL-0043 and others).
6. With **Fully paid only**, only sales with no balance due appear; the new empty-state message explains this and suggests “Include due sales”.

## Verification steps

1. Open Reports → Commission.
2. Ensure period includes your data; leave or set **Include due sales**.
3. Confirm commission sales (e.g. SL-0044, SL-0043) appear in the table and totals.
4. Select **Fully paid only** → only fully paid commission sales (or empty); confirm the new hint appears when empty.
5. Select a specific salesman → only that salesman’s rows.
6. After “Post Commission”, switch Status to Posted → posted sales appear; Pending no longer shows them.

## Rollback notes

To revert:

- In `commissionReportService.ts`: set default back to `'fully_paid_only'` and remove the `console.debug` block.
- In `CommissionReportPage.tsx`: set initial `paymentEligibility` back to `'fully_paid_only'` and remove the conditional empty-state paragraph for `paymentEligibility === 'fully_paid_only'`.

No database or API contract changes. Commission batch model, no-repeat posting, and default commission autofill/override are unchanged.

## Docs created/updated

- `docs/ERP_COMMISSION_REPORT_GROUND_TRUTH_SQL.md` — Ground truth SQL and how to compare with UI.
- `docs/commission_report_ground_truth.sql` — Runnable SQL (replace company id/dates as needed).
- `docs/ERP_COMMISSION_REPORT_SERVICE_TRACE.md` — Service flow and comparison with SQL.
- `docs/ERP_COMMISSION_REPORT_UI_STATE_TRACE.md` — Filter state and wiring.
- `docs/ERP_COMMISSION_REPORT_RENDER_FIX.md` — Render condition and empty-state fix.
- `docs/ERP_COMMISSION_REPORT_FILTER_VALIDATION.md` — Filter validation cases.
- `docs/ERP_COMMISSION_REPORT_FORENSIC_FINAL_FIX.md` — This summary.
