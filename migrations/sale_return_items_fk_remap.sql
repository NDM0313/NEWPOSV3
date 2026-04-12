-- Migration: Remap sale_return_items.sale_item_id FK from sale_items → sales_items
-- Date: 2026-04-13
--
-- PURPOSE:
--   After the sale_items data migration, all sale_item IDs exist in sales_items.
--   This migration updates the FK constraint so the eventual DROP TABLE sale_items
--   does not break referential integrity.
--
-- GATE — run verify_sale_return_item_fk_integrity_after_migration.sql FIRST.
--   Check 1 (unresolved FKs) MUST = 0 before running this migration.
--
-- SAFE TO RE-RUN: wrapped in DO $$ BEGIN...EXCEPTION block; constraint drop is IF EXISTS.

DO $$ BEGIN
  -- Drop existing FK constraint (named or unnamed)
  ALTER TABLE sale_return_items
    DROP CONSTRAINT IF EXISTS sale_return_items_sale_item_id_fkey;

  -- Add new FK pointing to sales_items (canonical table)
  ALTER TABLE sale_return_items
    ADD CONSTRAINT sale_return_items_sale_item_id_fkey
    FOREIGN KEY (sale_item_id)
    REFERENCES sales_items(id)
    ON DELETE SET NULL;

  RAISE NOTICE 'FK remap complete: sale_return_items.sale_item_id now references sales_items(id)';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK remap skipped or failed: % — check that sale_items data migration ran first.', SQLERRM;
END $$;

-- Verification query (run after migration to confirm):
-- SELECT
--   tc.constraint_name,
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
--   JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
--   JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name = 'sale_return_items'
--   AND kcu.column_name = 'sale_item_id';
-- Expected: foreign_table_name = 'sales_items'
