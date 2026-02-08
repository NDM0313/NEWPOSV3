-- Purchase and Sale attachments: columns + separate storage buckets (not payment-attachments).
--
-- SETUP (do once in Supabase Dashboard → Storage):
--   1. New bucket: purchase-attachments (private optional)
--   2. New bucket: sale-attachments (private optional)
-- Then run this migration.

-- Add attachments column to purchases (links to purchase-attachments bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE purchases ADD COLUMN attachments JSONB DEFAULT NULL;
  END IF;
END $$;

-- Add attachments column to sales (links to sale-attachments bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE sales ADD COLUMN attachments JSONB DEFAULT NULL;
  END IF;
END $$;

-- RLS for purchase-attachments bucket
DO $$
BEGIN
  DROP POLICY IF EXISTS "purchase_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "purchase_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "purchase_attachments_update" ON storage.objects;
  CREATE POLICY "purchase_attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'purchase-attachments');
  CREATE POLICY "purchase_attachments_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'purchase-attachments');
  CREATE POLICY "purchase_attachments_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'purchase-attachments') WITH CHECK (bucket_id = 'purchase-attachments');
END $$;

-- RLS for sale-attachments bucket
DO $$
BEGIN
  DROP POLICY IF EXISTS "sale_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "sale_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "sale_attachments_update" ON storage.objects;
  CREATE POLICY "sale_attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sale-attachments');
  CREATE POLICY "sale_attachments_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sale-attachments');
  CREATE POLICY "sale_attachments_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'sale-attachments') WITH CHECK (bucket_id = 'sale-attachments');
END $$;
