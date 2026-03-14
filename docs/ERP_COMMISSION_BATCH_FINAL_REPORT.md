# ERP Commission Batch Posting — Final Report

## Root cause of previous blank/weak commission flow

1. **Multiple, inconsistent posting paths**: Commission was posted in three places — (a) SalesContext after createSale via RPC `create_commission_journal_entry` and user ledger, (b) SalesContext updateSale with the same RPC + user ledger, (c) saleService.updateSaleStatus via employee_ledger. There was no single “posted vs pending” state on the sale.
2. **Wrong accounting**: The existing RPC credited **Accounts Receivable (2000)** for commission, which is incorrect; commission liability should be **Salesman Payable**, not a reduction of AR.
3. **No batch concept**: Every sale created a separate journal entry, cluttering the ledger and making it hard to review or pay in bulk.
4. **Report gaps**: No branch or status filter, no summary (posted vs pending), no way to “Generate to Ledger” from the report.

## What was implemented

- **Sale stores raw commission only**: salesman_id, commission_percent, commission_eligible_amount, commission_amount, commission_status (pending/posted), commission_batch_id. No automatic ledger or employee_ledger posting on save/finalize.
- **Commission report**: Real period report with filters (salesman, branch, date range, status), summary totals (total sales, eligible, commission, posted, pending), and detail table (including branch, eligible base, %, status, batch).
- **Post Commission**: One action “Post Commission” on the report. Creates one commission_batch, one journal entry (Dr 5100 Sales Commission Expense, Cr 2040 Salesman Payable), and marks selected pending sales as posted and linked to the batch. Duplicate posting is prevented by only selecting pending sales.
- **Settlement**: Documented as a separate step: pay from Salesman Payable (2040) by Dr 2040, Cr Cash/Bank.

## Files changed

| File | Change |
|------|--------|
| **migrations/sales_commission_batch_status_and_batch_id.sql** | New. Adds sales.commission_status, commission_batch_id, commission_percent; creates commission_batches table. |
| **src/app/services/saleService.ts** | Sale interface: commission_status, commission_batch_id, commission_percent. Removed employee_ledger commission call in updateSaleStatus. |
| **src/app/context/SalesContext.tsx** | createSale: send commission_status, commission_batch_id, commission_percent; removed commission RPC and user ledger block. updateSale: removed commission journal + user ledger block. convertFromSupabaseSale: map commissionStatus, commissionBatchId, commissionPercent. updateSale: map commissionPercent. |
| **src/app/components/sales/SaleForm.tsx** | Payload: add commissionPercent when type is percentage. |
| **src/app/services/commissionReportService.ts** | Extended report with branch, status filters; totals; CommissionSaleRow with branch, commission_status, commission_batch_id, commission_percent. Added postCommissionBatch(), ensureCommissionAccounts() (5100, 2040). |
| **src/app/components/reports/CommissionReportPage.tsx** | Branch and status filters; summary totals cards; detail columns (branch, eligible base, %, status, batch); “Post Commission” button and handlePostCommission. |
| **docs/ERP_COMMISSION_BATCH_SOURCE_TRACE.md** | New. Phase 1 trace. |
| **docs/ERP_COMMISSION_RAW_DATA_MODEL.md** | New. Phase 2 data model. |
| **docs/ERP_COMMISSION_PERIOD_REPORT.md** | New. Phase 3 report. |
| **docs/ERP_COMMISSION_GENERATE_TO_LEDGER.md** | New. Phase 4 batch posting. |
| **docs/ERP_COMMISSION_SETTLEMENT_WORKFLOW.md** | New. Phase 5 settlement. |
| **docs/ERP_COMMISSION_BATCH_VERIFICATION.md** | New. Phase 6 verification cases. |

## Migration

- **migrations/sales_commission_batch_status_and_batch_id.sql** was added. Run it locally (e.g. in Supabase SQL editor or your migration runner) before using the new flow. It adds columns to `sales` and creates `commission_batches`.

## Raw commission fields on sale

- salesman_id, commission_percent, commission_eligible_amount, commission_amount, commission_status (pending/posted), commission_batch_id.

## How commission is reported

- Commission Report (Reports → Commission) uses date range from global filter and local filters: salesman, branch, status. It reads final sales, shows summary totals and a detail table. Data is real from `sales` and `commission_batches`.

## How Generate to Ledger works

- User clicks “Post Commission” on the report. Backend selects all **pending** sales in the current filter (company, date range, optional branch, optional salesman). Creates one `commission_batches` row and one journal entry: Dr 5100, Cr 2040 for total commission. Updates those sales to commission_status = 'posted' and commission_batch_id = batch.id. Report refetches.

## How accounting entry is posted

- One journal entry per batch: reference_type = 'commission_batch', reference_id = batch.id. Two lines: Dr Sales Commission Expense (5100), Cr Salesman Payable (2040). Account 2040 is created by the app if missing.

## How payment/settlement works

- After commission is posted, payment is separate: Dr Salesman Payable (2040), Cr Cash/Bank (1000/1010). Can be done via manual journal entry or a future payment flow. See ERP_COMMISSION_SETTLEMENT_WORKFLOW.md.

## Rollback notes

- To revert behavior to “post commission per sale” you would need to: (1) re-add the commission RPC and user ledger calls in SalesContext createSale/updateSale, (2) re-add the employee_ledger commission call in saleService.updateSaleStatus. The new columns and commission_batches table can remain; existing batch-posted sales would keep commission_status = 'posted' and commission_batch_id set. Rolling back the migration (dropping new columns and commission_batches) would require care if you already have posted batches; prefer to leave the schema and only revert app code if you need the old per-sale posting.
