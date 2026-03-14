# ERP Commission — Period Report (Phase 3)

## Requirement
Commission report behaves as a real operational report with filters, summary totals, and detail table.

## Filters
- **Salesman**: All or a specific salesperson (from report data).
- **Branch**: All branches or a specific branch (from `branches` table).
- **Date range**: From global Reports date range (startDate, endDate).
- **Status**: All | Pending | Posted.

## Summary totals (company-wide for filtered set)
- **Total sales**: Sum of sale totals.
- **Total eligible**: Sum of commission_eligible_amount.
- **Total commission**: Sum of commission_amount.
- **Posted commission**: Sum of commission_amount where commission_status = 'posted'.
- **Pending commission**: Sum of commission_amount where commission_status is null or 'pending'.

## Detail table columns
- Salesperson, Invoice, Date, Customer, Branch, Total sale, Eligible base, %, Commission, Status, Batch (Yes/—).

## Data source
- **commissionReportService.getCommissionReport(companyId, startDate, endDate, options?)**
- options: branchId, salesmanId, status ('pending' | 'posted' | 'all').
- Reads from `sales` (final only), joins `branches` for branch name. Uses commission_status, commission_batch_id, commission_percent.

## UI
- **CommissionReportPage**: Uses global startDate/endDate; local state for salesman, branch, status. Shows summary cards, salesman cards, and detail table. Aligned with Reports & Analytics design (dark theme, cards, table).
