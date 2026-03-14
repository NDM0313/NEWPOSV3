# ERP Commission — Raw Data Model (Phase 2)

## Requirement
Sale stores raw commission data only. No ledger/payable entries are created at sale creation or finalization. Commission is posted only when admin uses "Post Commission" from the Commission Report.

## Fields on `sales`

| Column | Type | Purpose |
|--------|------|---------|
| **salesman_id** | UUID, nullable | User (salesperson) assigned for commission. Admin selects on form; salesman creating own sale is auto-assigned. |
| **commission_percent** | DECIMAL(5,2), nullable | Rate at time of sale (for audit). Set when commission type is percentage. |
| **commission_eligible_amount** | DECIMAL(15,2), nullable | Base for commission (e.g. subtotal). Excludes shipping, loading, freight, other non-commissionable extras. |
| **commission_amount** | DECIMAL(15,2), default 0 | Calculated commission for this sale. |
| **commission_status** | VARCHAR(20), default 'pending' | `pending` = not yet posted; `posted` = included in a commission batch. |
| **commission_batch_id** | UUID, nullable | Set when commission is posted via "Post Commission"; links to `commission_batches.id`. |

## Commission base (eligible amount)

- **Source**: From sale form, commission is calculated from **subtotal** (items only). Shipping, loading, freight, and other extras are in `expenses` / `sale_charges` and are not part of subtotal.
- **Stored**: `commission_eligible_amount` is set to `saleData.subtotal` in SalesContext (createSale/updateSale). So the base excludes non-commissionable extras by design.

## Who assigns salesman

1. **Admin creates sale**: Selects salesman from dropdown; that value is saved as `salesman_id`.
2. **Salesman creates own sale**: SaleForm auto-assigns current user as salesman (via salesmen list match by email/name). Same field `salesman_id`.

## What does NOT happen on sale save/finalize

- No `create_commission_journal_entry` RPC call.
- No user/agent ledger entry for commission.
- No `employee_ledger` commission entry (removed from saleService.updateSaleStatus).

## Migration

- **migrations/sales_commission_batch_status_and_batch_id.sql**
  - Adds `commission_status`, `commission_batch_id`, `commission_percent` to `sales`.
  - Creates `commission_batches` table (batch_no, entry_date, salesman_id, total_commission, sale_count, journal_entry_id, etc.).

## Code changes (Phase 2)

- **saleService.ts**: Sale interface extended with `commission_status`, `commission_batch_id`, `commission_percent`. Removed per-sale commission call to `employeeService.addLedgerEntry` in `updateSaleStatus`.
- **SalesContext.tsx**: createSale sends `commission_status: 'pending'`, `commission_batch_id: null`, `commission_percent` from payload. Removed commission journal RPC and user ledger block in createSale and updateSale. convertFromSupabaseSale maps `commission_status`, `commission_batch_id`, `commission_percent`.
- **SaleForm.tsx**: Payload includes `commissionPercent: commissionType === 'percentage' ? commissionValue : null`.
