-- =============================================================================
-- VERIFY: Sale Form Deadline & Notes are linked to table "sales"
-- Run this in Supabase SQL Editor (same project as your app's VITE_SUPABASE_URL)
-- =============================================================================

-- Step 1: Check if columns exist (should return 2 rows: deadline, notes)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sales'
  AND column_name IN ('deadline', 'notes')
ORDER BY column_name;

-- Step 2: If columns are missing, run deploy/sales_deadline_notes_persistence.sql
-- Then run Step 1 again.

-- Step 3: After saving a Studio sale with Deadline + Notes, check data
SELECT id, invoice_no, deadline, notes, created_at
FROM sales
ORDER BY created_at DESC
LIMIT 10;

-- If deadline/notes stay NULL after save: ensure migration was run on THIS Supabase project.
-- Your app uses the project in .env (VITE_SUPABASE_URL).
