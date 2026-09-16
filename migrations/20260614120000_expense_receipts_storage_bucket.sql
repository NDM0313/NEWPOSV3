-- Expense receipt attachments: storage bucket + RLS (idempotent). Safe to re-run.
-- Fixes mobile/web expense form receipt upload (bucket expense-receipts).

INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
SELECT 'expense-receipts', 'expense-receipts', false, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'expense-receipts');

DO $$
BEGIN
  DROP POLICY IF EXISTS "expense_receipts_insert" ON storage.objects;
  DROP POLICY IF EXISTS "expense_receipts_select" ON storage.objects;
  DROP POLICY IF EXISTS "expense_receipts_update" ON storage.objects;

  CREATE POLICY "expense_receipts_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts');

  CREATE POLICY "expense_receipts_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-receipts');

  CREATE POLICY "expense_receipts_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-receipts')
  WITH CHECK (bucket_id = 'expense-receipts');
END $$;
