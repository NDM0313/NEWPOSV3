# ERP Commission Report — Filter Behavior

## Overview

The commission report supports filters for period, salesperson, branch, status (pending/posted/all), and payment eligibility. This document describes how each filter behaves and how they combine.

## Filter Definitions

| Filter | Options | Effect on query |
|--------|---------|-----------------|
| **Period** | From global date filter (e.g. “From start”, custom range) | `invoice_date >= start` and `invoice_date <= end`. |
| **Salesperson** | All salesmen / specific salesman | When specific: `salesman_id = selected id`. When “All”: no salesman filter. |
| **Branch** | All branches / specific branch | When specific: `branch_id = selected id`. When “All”: no branch filter. |
| **Status** | All / Pending / Posted | **All**: no status filter. **Pending**: `commission_status IS NULL OR commission_status = 'pending'`. **Posted**: `commission_status = 'posted'`. |
| **Payment eligibility** | Fully paid only / Include due sales | **Fully paid only**: `due_amount <= 0 OR due_amount IS NULL`. **Include due sales**: no payment filter. |

Base criteria (always applied):

- `company_id`, `status = 'final'`, `invoice_date` in period.
- After fetch, rows are kept if `commission_amount > 0` or `salesman_id` is not null.

## Report Modes — Expected Behavior

- **All salesmen + Include due sales**  
  All commission-eligible sales in the period (any salesman, any due amount) appear.

- **Specific salesman (e.g. arslan) + Include due sales**  
  Only that salesman’s commission sales in the period; includes partial/unpaid (e.g. SL-0044, SL-0043 type rows).

- **Specific salesman + Fully paid only**  
  Only that salesman’s commission sales that are fully paid (`due_amount <= 0` or null).

- **Status = Pending**  
  Only sales with `commission_status` null or `'pending'`. Posted sales are excluded.

- **Status = Posted**  
  Only sales with `commission_status = 'posted'` (after “Post Commission”).

- **After Post Commission**  
  Posted sales move out of “Pending” and appear only when Status = Posted (or All). Pending view no longer shows them.

## Defaults (After Fix)

- **Payment eligibility**: **Include due sales** — so the report shows all commission sales by default; users can switch to “Fully paid only” to restrict to fully paid.
- **Status**: All  
- **Salesperson**: All salesmen  
- **Branch**: From global branch or “All branches” when not restricted

## Filter Combination Notes

- Filters are ANDed: period + optional branch + optional salesman + status + payment eligibility.
- No filter should remove valid rows except by design (e.g. “Fully paid only” correctly excludes due_amount > 0; “Pending” correctly excludes posted).
- If a combination returns no rows, it is because there are no sales matching that combination (e.g. no fully paid sales for that salesman in that period).

## Fix Applied

Previously, the default payment eligibility was “Fully paid only”, which excluded all sales with a balance due and could make the report blank. The default is now “Include due sales” so that valid commission sales (including those with due balance) appear by default.
