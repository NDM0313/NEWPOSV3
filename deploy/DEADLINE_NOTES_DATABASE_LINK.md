# Sale Form: Deadline & Notes – Database Link

## Issue
The **Deadline** and **Notes** in the Sale Form (purple Studio section) must persist. If they show in the form but not in Studio Sales list or when you Edit again, the DB link is missing or the migration was not run.

---

## 1. Which database?

- **Backend:** Supabase (Postgres)
- **Connection:** Your app uses the Supabase project configured in `.env` (e.g. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- **Table:** `sales`
- **Columns:**

| Column    | Type | Used for                          |
|----------|------|------------------------------------|
| `deadline` | DATE | Studio delivery/deadline (e.g. Mar 25, 2026) |
| `notes`    | TEXT | Sale notes (Studio can also store `StudioDeadline:YYYY-MM-DD` here) |

---

## 2. Code flow (form → DB)

1. **Sale Form** (Studio section)  
   - User picks **Deadline** (date) and types **Notes**.  
   - On Save: `saleData.deadline = studioDeadline.toISOString().split('T')[0]` (e.g. `"2026-03-25"`).  
   - `saleData.notes = buildNotesWithStudioDeadline(studioDeadline, saleNotes...)` or plain notes.

2. **SalesContext** → `createSale(saleData)` / `updateSale(id, saleData)`  
   - Builds Supabase payload: `notes: saleData.notes`, `deadline: saleData.deadline`.

3. **saleService**  
   - **createSale:** `supabase.from('sales').insert({ ...sale, notes: sale.notes ?? null, deadline: sale.deadline ?? null })`  
   - **updateSale:** updates `sales` with `notes` and `deadline` when provided.  
   - **getSaleById / getSale:** `select *` from `sales` → returns `deadline` and `notes`.

4. **Database**  
   - Table: `sales` in the **same Supabase project** your app points to (see `.env`).  
   - Columns must exist: `deadline` (DATE), `notes` (TEXT).

---

## 3. Fix: run migration on the correct database

If `deadline` / `notes` are not in the `sales` table, the app cannot save or load them.

1. Open **Supabase Dashboard** for the project that your app uses (same as `VITE_SUPABASE_URL`).
2. Go to **SQL Editor**.
3. Run the script: **`deploy/sales_deadline_notes_persistence.sql`**

```sql
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS deadline DATE;

COMMENT ON COLUMN sales.notes IS 'Sale notes from form; Studio may store StudioDeadline:YYYY-MM-DD.';
COMMENT ON COLUMN sales.deadline IS 'Delivery/deadline from form; used in Studio Sales list and Pipeline.';
```

4. Run the **verification** query (see below). You should see `deadline` and `notes` in the result.

---

## 4. Verify link

Run this in the **same** Supabase project (SQL Editor):

```sql
-- 1) Check columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sales'
  AND column_name IN ('deadline', 'notes');

-- 2) After saving a Studio sale, check data
SELECT id, invoice_no, deadline, notes, created_at
FROM sales
ORDER BY created_at DESC
LIMIT 5;
```

- If (1) returns no rows for `deadline` or `notes` → run `sales_deadline_notes_persistence.sql` on this project.
- If (2) shows `deadline` and `notes` as NULL for a sale you just saved with a date and notes → check the same Supabase project is used by the app (env) and that you clicked Save after entering data.

---

## 5. Summary

| What you see in UI | Database link |
|--------------------|----------------|
| Sale Form → Deadline (e.g. Mar 25, 2026) | `sales.deadline` (DATE) |
| Sale Form → Notes | `sales.notes` (TEXT) |
| Studio Sales list → Deadline / Notes | Same columns, via `getStudioSales()` → `*` |
| Edit sale → Deadline / Notes loaded | Same columns, via `getSaleById()` → `*` |

**Database** = Supabase project used by your app (see `VITE_SUPABASE_URL`). Run the migration there once.
