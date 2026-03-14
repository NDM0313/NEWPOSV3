# ERP Commission Batch — Source Trace (Phase 1)

## Purpose
Trace where salesman and commission are assigned, stored, and posted so we can implement batch-only ledger posting.

## 1. Sale form and salesman assignment

| Location | What happens |
|----------|---------------|
| **SaleForm.tsx** | `salesmanId` state: admin can select from dropdown; non-admin gets auto-assigned via `useEffect` that finds user in `salesmen` list by email/full_name. Default "1" = "No Salesman". |
| **SaleForm.tsx** | Commission: `commissionType` ('percentage' \| 'fixed'), `commissionValue`. Commission amount = percentage of subtotal or fixed value. |
| **SaleForm.tsx** | Payload: `commissionAmount`, `salesmanId` sent to context (lines ~2051–2052). Commission base is effectively **subtotal** (extras/shipping not in subtotal). |

## 2. Sales table (current columns)

- **salesman_id** (UUID, nullable) — from migration `sales_salesman_commission_columns.sql`
- **commission_amount** (DECIMAL, default 0)
- **commission_eligible_amount** (DECIMAL, nullable) — set to subtotal in SalesContext

Missing for batch workflow:

- **commission_status** ('pending' \| 'posted')
- **commission_batch_id** (UUID, nullable)
- **commission_percent** (optional, for audit)

## 3. Where commission is saved on sale

| Location | Behavior |
|----------|----------|
| **SalesContext.createSale** | Builds `supabaseSale` with `salesman_id`, `commission_amount`, `commission_eligible_amount: saleData.subtotal`. Calls `saleService.createSale(supabaseSale, ...)`. |
| **SalesContext.updateSale** | Maps `salesmanId` → `salesman_id`, `commissionAmount` → `commission_amount`, `commissionEligibleAmount` → `commission_eligible_amount`. |

## 4. Current ledger posting (to be removed for batch-only)

### 4a. SalesContext after createSale (lines ~929–972)

- If `commissionAmount > 0` and accounting enabled:
  - Calls **`supabase.rpc('create_commission_journal_entry', ...)`** → creates one journal entry per sale (Dr Commission Expense 5100, Cr **AR 2000** — note: existing RPC credits AR, not payable).
  - Then **`addLedgerEntry`** to "user" ledger (ledger_entries or similar) so agent ledger shows commission.

### 4b. SalesContext updateSale (lines ~1631–1688)

- When status is final and commission > 0:
  - Checks for existing commission journal by `reference_type='sale'`, `reference_id=id`, description ILIKE '%commission%'.
  - If none: calls **`create_commission_journal_entry`** and same **user ledger** entry.

### 4c. saleService.updateSaleStatus (lines ~458–470)

- When `status === 'final'` and `data.salesman_id`:
  - **`employeeService.getEmployeeByUser(data.salesman_id)`** then **`employeeService.addLedgerEntry(emp.id, 'commission', amount, ...)`** → writes to **employee_ledger** (one row per sale).

## 5. Commission report (current)

| Location | Behavior |
|----------|----------|
| **commissionReportService.ts** | Fetches sales for company + date range (invoice_date), status = 'final'. Selects `salesman_id`, `commission_amount`, `commission_eligible_amount`, `total`, etc. Groups by salesman; no branch filter, no status (pending/posted) filter. |
| **CommissionReportPage.tsx** | Uses global `startDate`/`endDate` from Reports dashboard. Filter: salesman (all vs single). Shows summary cards and "Commission by sale" table. No "Post to Ledger" action. |

## 6. Gaps and root cause of blank/weak flow

- **Root cause**: Commission was posted in three places (createSale journal + user ledger, updateSale journal + user ledger, updateSaleStatus employee_ledger), but:
  - No single source of truth for "posted vs pending".
  - No batch entity; ledger gets one entry per sale (clutter).
  - Report has no branch, no status filter, no way to "Generate to Ledger" for selected period/salesman.
- **Gaps**:
  - sales table: no `commission_status`, `commission_batch_id`, `commission_percent`.
  - Commission base: currently subtotal (OK); shipping/loading/freight are in expenses/charges — ensure they are excluded (they are, as subtotal is items-only).
  - No `commission_batches` table; no single summarized journal entry (Dr Commission Expense, Cr Salesman Payable) per batch.
  - No Salesman Payable account (2040 or similar) for liability; existing RPC uses AR which is incorrect for commission payable.

## 7. Files referenced

- `src/app/components/sales/SaleForm.tsx` — salesman dropdown, commission %, payload
- `src/app/context/SalesContext.tsx` — createSale/updateSale mapping, commission RPC + user ledger
- `src/app/services/saleService.ts` — createSale insert, updateSaleStatus (employee_ledger commission)
- `src/app/services/commissionReportService.ts` — report query
- `src/app/components/reports/CommissionReportPage.tsx` — UI, filters
- `migrations/sales_salesman_commission_columns.sql` — salesman_id, commission_amount, commission_eligible_amount
- `FIX_ACCOUNTING_SYSTEM_COMPLETE.sql` — create_commission_journal_entry (5100 Dr, 2000 Cr)

## 8. Next steps (Phases 2–4)

- Phase 2: Add migration for `commission_status`, `commission_batch_id`, `commission_percent`; ensure sale save sets pending; **remove** all per-sale commission posting (SalesContext RPC + user ledger, saleService employee_ledger).
- Phase 3: Report filters (branch, status pending/posted/all), summary (total sales, eligible, commission, posted, pending), detail (branch, batch ref).
- Phase 4: `commission_batches` table + "Post Commission" action: one JE (Dr 5100, Cr 2040 Salesman Payable), link batch to JE, mark sales posted and link to batch.
