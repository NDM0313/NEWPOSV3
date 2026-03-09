# Production Release Validation Report — Sale Final Stock Movement Trigger

**Release:** STEP 9 — Apply `sale_final_stock_movement_trigger.sql` to production only.  
**No other tables or schema modified.**

---

## 1. Full PostgreSQL Backup

**Status:** _To be completed before applying the migration._

### Instructions

- **Script:** Run `.\scripts\backup-production-db.ps1` (ensure `PRODUCTION_DATABASE_URL` is set in `.env.local`).
- **Manual:** See `backups/README.md` — use `pg_dump` with production URL or Supabase Dashboard backup.

### Result

| Item | Value |
|------|--------|
| Backup completed at | _YYYY-MM-DD HH:MM_ |
| Backup file | _e.g. backups/production_pre_sale_final_trigger_YYYYMMDD_HHMMSS.sql_ |
| Verified (file exists / size) | _Yes / No_ |

**Note:** Run backup from a machine where `pg_dump` can reach the database (e.g. `db.*.supabase.co`). If backup fails with "could not translate host name", run it from your local network or a server with DB access.

---

## 2. Migration Review — sale_final_stock_movement_trigger.sql

### Purpose

When a row in **sales** is updated and **status** changes to **'final'**, create one **stock_movements** row per sale line (from `sales_items` or `sale_items`) with:

- **quantity** negative (stock OUT)
- **movement_type** = 'SALE'
- **reference_type** = 'sale', **reference_id** = sale id

So inventory and stock ledger stay correct for any path that finalizes a sale (e.g. direct status update, not only the app flow).

### What the migration does (no other tables/schema)

| Action | Object | Effect |
|--------|--------|--------|
| CREATE OR REPLACE FUNCTION | `handle_sale_final_stock_movement()` | Function that runs on trigger; reads sales_items/sale_items, inserts into stock_movements. |
| DROP TRIGGER IF EXISTS | `sale_final_stock_movement_trigger` on `sales` | Removes existing trigger if present. |
| CREATE TRIGGER | `sale_final_stock_movement_trigger` on `sales` | AFTER UPDATE FOR EACH ROW, calls the function above. |
| COMMENT | On function and trigger | Documentation only. |

**Tables modified by the migration itself:** None (only adds/replaces function and trigger).  
**Tables modified at runtime:** Only **stock_movements** (INSERTs when a sale becomes final).

### Safety

- **Idempotent:** If there are already stock_movements for this sale (reference_type = 'sale', reference_id = sale id, movement_type = 'sale'), the function does nothing.
- **Compatibility:** Uses **sales_items** first; falls back to **sale_items** if present. Checks table existence.
- **Scope:** Only reacts to `status` changing to `'final'`; no other columns or tables touched.

### Review conclusion

- **Approved for production:** _Yes — single-purpose trigger, idempotent, no schema or other table changes._

---

## 3. Apply to Production Database

**Status:** _To be completed after backup._

### Steps

1. Ensure **PRODUCTION_DATABASE_URL** is set in `.env.local` (production Postgres connection string).
2. Run:
   ```bash
   node scripts/apply-production-sale-final-trigger.js
   ```
3. Expected output: `Done. Trigger sale_final_stock_movement_trigger is now active on sales.`

### Result

| Item | Value |
|------|--------|
| Applied at | _YYYY-MM-DD HH:MM_ |
| Script exit code | _0 = success_ |
| Trigger exists (optional check) | `SELECT tgname FROM pg_trigger WHERE tgname = 'sale_final_stock_movement_trigger';` → 1 row |

---

## 4. Verification with a Real Sale

**Status:** _To be completed after applying the migration._

### Steps

1. **Create a sale** (draft/quotation/order) with at least one line item (product, quantity).
2. **Generate invoice** (if your flow has a separate “generate invoice” step; otherwise ensure the sale has line items in `sales_items` or `sale_items`).
3. **Finalize the sale** (set status to **final** via app or SQL: `UPDATE sales SET status = 'final' WHERE id = '<sale_id>';`).
4. **Confirm stock_movements created:**
   ```sql
   SELECT id, product_id, quantity, movement_type, reference_type, reference_id, notes
   FROM stock_movements
   WHERE reference_type = 'sale' AND reference_id = '<sale_id>';
   ```
   - Expected: One row per sale line; **quantity** negative; **movement_type** = 'SALE'.

### Result

| Step | Done | Notes |
|------|------|--------|
| 1. Create sale | _Yes / No_ | _e.g. Sale ID, invoice no_ |
| 2. Generate invoice | _Yes / N/A_ | _N/A if invoice is same as sale_ |
| 3. Finalize sale | _Yes / No_ | _e.g. status = 'final'_ |
| 4. stock_movements created | _Yes / No_ | _Count: _ ; all quantities negative and movement_type SALE_ |

**Sale ID used for verification:** _UUID_  
**Number of sale lines:** _N_  
**Number of stock_movements rows after finalize:** _N (expected: same as lines)_  

---

## 5. Validation Summary

| Check | Result |
|-------|--------|
| Full backup taken before apply | _Yes / No_ |
| Migration applied (trigger only, no other schema) | _Yes / No_ |
| Real-sale verification: stock_movements created on finalize | _Pass / Fail_ |
| No other tables or schema modified | _Confirmed_ |

**Overall:** _Pass / Fail_

**Signed off:** _________________ **Date:** ___________

---

*End of Production Release Validation Report.*
