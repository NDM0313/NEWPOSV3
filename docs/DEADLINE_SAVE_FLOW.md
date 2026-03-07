# Deadline field – where the date is saved

## UI element (what you see)

- **Location:** Sale Form → purple Studio section → **Deadline** button (date picker)
- **Component:** `SaleForm.tsx` – state `studioDeadline` (Date | undefined)
- **Control:** `CalendarDatePicker` with `value={studioDeadline}`, `onChange={setStudioDeadline}`

## Save path (form → DB)

| Step | File | What happens |
|------|------|----------------|
| 1 | **SaleForm.tsx** | On Save, `saleData.deadline = isStudioSale && studioDeadline ? studioDeadline.toISOString().split('T')[0] : null` (e.g. `"2026-03-25"`) |
| 2 | **SaleForm.tsx** | `createSale(saleData)` is called with `saleData` containing `deadline` |
| 3 | **SalesContext.tsx** | Builds `supabaseSale.deadline = (saleData as any).deadline ?? null` and calls `saleService.createSale(supabaseSale, ...)` |
| 4 | **saleService.ts** | `deadlineForDb = sale.deadline` (trimmed string or null). Insert row includes `deadline: deadlineForDb`. **Then** a follow-up `UPDATE sales SET deadline = ? WHERE id = ?` runs so deadline is always written. |
| 5 | **Database** | Table: **`sales`**, column: **`deadline`** (type DATE). Same Supabase project as in your app env (e.g. `VITE_SUPABASE_URL`). |

## Database

- **Table:** `sales`
- **Column:** `deadline` (DATE)
- **Migration:** Run `deploy/sales_deadline_notes_persistence.sql` in Supabase SQL Editor if the column is missing.

## Verify

After saving a Studio sale with a deadline:

```sql
SELECT id, invoice_no, deadline, notes
FROM sales
ORDER BY created_at DESC
LIMIT 5;
```

`deadline` should show the date (e.g. `2026-03-25`). If it is still NULL, check:

1. You ran the migration on the **same** Supabase project the app uses.
2. RLS on `sales` allows UPDATE (the follow-up update that sets `deadline`).
3. Browser console for `[SALE SERVICE] createSale inserting deadline: ...` and any `deadline follow-up update failed` warning.
