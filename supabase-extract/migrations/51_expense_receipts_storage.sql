-- Expense receipt attachments: storage bucket RLS for mobile/web expense form.
--
-- SETUP (do once in Supabase Dashboard → Storage):
--   New bucket: expense-receipts (public or private; RLS below allows authenticated insert/select).
-- Then run this migration.

DO $$
BEGIN
  DROP POLICY IF EXISTS "expense_receipts_insert" ON storage.objects;
  DROP POLICY IF EXISTS "expense_receipts_select" ON storage.objects;
  DROP POLICY IF EXISTS "expense_receipts_update" ON storage.objects;
  CREATE POLICY "expense_receipts_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts');
  CREATE POLICY "expense_receipts_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-receipts');
  CREATE POLICY "expense_receipts_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-receipts') WITH CHECK (bucket_id = 'expense-receipts');
END $$;
