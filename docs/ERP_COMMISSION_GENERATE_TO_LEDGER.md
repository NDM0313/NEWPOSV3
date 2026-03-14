# ERP Commission — Generate to Ledger (Phase 4)

## Requirement
Admin confirms selected pending commission and posts it as one summarized batch. One journal entry per batch: Dr Sales Commission Expense, Cr Salesman Payable.

## Flow
1. Admin opens Commission Report, sets filters (salesman, branch, date range). Status can be "Pending" or "All" to see pending rows.
2. Admin clicks **"Post Commission"**.
3. Backend collects all **pending** sales matching the current filters (company, date range, optional branch, optional salesman).
4. If no pending commission: show warning; do nothing.
5. Otherwise:
   - Create **commission_batches** row (batch_no, entry_date, salesman_id optional, total_commission, sale_count, created_by). batch_no format: `COMM-YYYYMMDD-NNN` (sequence per day).
   - Get or create accounts: **5100** (Sales Commission Expense), **2040** (Salesman Payable). Create 2040 if missing.
   - Create **one** journal entry:
     - reference_type = `commission_batch`, reference_id = batch.id
     - Dr 5100 (Sales Commission Expense) = total_commission
     - Cr 2040 (Salesman Payable) = total_commission
   - Update **commission_batches** with journal_entry_id.
   - Update all included **sales**: commission_status = 'posted', commission_batch_id = batch.id.
6. Show success toast; refetch report.

## Duplicate prevention
- Only sales with commission_status in (null, 'pending') and commission_amount > 0 are selected. Once posted, they are excluded from future runs for that period.

## API
- **postCommissionBatch(params)**: companyId, branchId?, salesmanId?, startDate, endDate, createdBy?.
- Returns: batchId, batchNo, journalEntryId, saleCount, totalCommission.

## Files
- **commissionReportService.ts**: postCommissionBatch(), ensureCommissionAccounts() (5100, 2040).
- **CommissionReportPage.tsx**: "Post Commission" button, handlePostCommission(), disabled when pending_commission <= 0 or posting.
