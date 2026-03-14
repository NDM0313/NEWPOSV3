# ERP Commission Report — Filter Accuracy Validation

## How to validate

For each case below, run the corresponding ground truth SQL (see `ERP_COMMISSION_REPORT_GROUND_TRUTH_SQL.md`) with the same company, dates, and filters, then compare:

- **UI row count** = number of sale rows in the “Commission by sale” table.
- **SQL row count** = result of the COUNT query with the same filters.
- **Totals** = report totals vs SQL `SUM(total)`, `SUM(commission_amount)`.

## Cases to test

| # | Salesperson | Branch | Status | Payment eligibility | Expected |
|---|-------------|--------|--------|----------------------|----------|
| 1 | All salesmen | All branches | All | Include due sales | All commission-eligible sales in period. |
| 2 | Specific (e.g. arslan) | All branches | All | Include due sales | Only that salesman’s commission sales (e.g. SL-0044, SL-0043 type). |
| 3 | Specific | All branches | All | Fully paid only | Only that salesman’s sales with due_amount ≤ 0 or null. |
| 4 | Any | Any | Pending | Include due / Fully paid | Only sales with commission_status null or 'pending'. |
| 5 | Any | Any | Posted | Include due / Fully paid | Only sales with commission_status = 'posted' (after Post Commission). |
| 6 | Any | Specific branch | Any | Any | Only sales in that branch. |
| 7 | Any | Any | Any | Any | Changing global date range updates period; row set should match new range. |

## Validation checklist

- [ ] **Case 1**: All salesmen + Include due sales → row count and totals match SQL (all commission sales in period).
- [ ] **Case 2**: Specific salesman (arslan) + Include due sales → only that salesman’s rows; invoice numbers match SQL.
- [ ] **Case 3**: Same salesman + Fully paid only → subset of Case 2 (only fully paid); may be 0 if all have balance due.
- [ ] **Case 4**: Status = Pending → only pending commission sales.
- [ ] **Case 5**: After Post Commission, Status = Posted → posted sales appear; they no longer appear under Pending.
- [ ] **Case 6**: Specific branch → only that branch’s sales.
- [ ] **Case 7**: Changing period in global filter → report period and rows update accordingly.

## Notes

- **Fully paid only** with 0 rows is correct when all commission sales have `due_amount > 0`; use **Include due sales** to see them.
- Salesman filter uses `users.id`; ensure `sales.salesman_id` stores the same id (from the same users table).
