-- expense-receipts: 5MB file limit + delete policy (idempotent).

UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'expense-receipts';

DO $$
BEGIN
  DROP POLICY IF EXISTS "expense_receipts_delete" ON storage.objects;

  CREATE POLICY "expense_receipts_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'expense-receipts');
END $$;
