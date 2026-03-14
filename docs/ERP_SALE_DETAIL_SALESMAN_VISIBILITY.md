# ERP Sale Detail — Salesman Visibility (Issue 2)

## Requirement
If a salesman is selected on a sale, Sale Detail / Transaction Detail must show:
- Salesman name  
- Commission %  
- Commission amount  
- Commission status  

## Implementation

### Component
**File**: `src/app/components/sales/ViewSaleDetailsDrawer.tsx`

1. **State**
   - `salesmanName`: resolved from `users` by `sale.salesmanId` (or `sale.salesman_id`).

2. **Resolving salesman name**
   - When the drawer has a sale and `salesmanId` is set (and not `'none'` / `'1'`), a `useEffect` fetches `users.full_name` or `users.email` by `id = salesmanId` and sets `salesmanName`.

3. **UI block “Salesman & Commission”**
   - Rendered when `salesmanId` is set or `(sale as any).commissionAmount > 0`.
   - Placed after “Transaction Details” and before “Status Cards”.
   - Section title: “Salesman & Commission” with `UserCheck` icon.
   - Four fields in a responsive grid:
     - **Salesman**: `salesmanName` (or “…” while loading, “—” if none).
     - **Commission %**: `(sale as any).commissionPercent` or “—”.
     - **Commission amount**: formatted currency, green.
     - **Commission status**: “Pending” (amber) or “Posted” (blue) from `(sale as any).commissionStatus`.

### Data source
- Sale comes from `saleService.getSaleById(saleId)` then `convertFromSupabaseSale` (SalesContext). Converted sale already has `salesmanId`, `commissionAmount`, `commissionStatus`, `commissionPercent`, `commissionBatchId` from the batch commission implementation.
- `getSaleById` uses `select *` on `sales`, so `salesman_id`, `commission_amount`, `commission_status`, `commission_percent` are present when the migration and save path persist them.

## Files changed
- `src/app/components/sales/ViewSaleDetailsDrawer.tsx`: added `salesmanName` state, `useEffect` to load name from `users`, and “Salesman & Commission” section.

## Summary
Sale detail drawer now shows salesman name (resolved from `users`), commission %, commission amount, and commission status whenever the sale has a salesman or a commission amount, keeping the layout consistent with the existing Transaction Details / Status Cards.
