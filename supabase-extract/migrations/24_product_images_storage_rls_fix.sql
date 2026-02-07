-- Fix product-images bucket RLS so authenticated users can upload/read.
-- Run this if uploads still fail with "new row violates row-level security policy".
DO $$
BEGIN
  -- Remove existing product_images policies (from migration 23)
  DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_update" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_delete" ON storage.objects;

  -- Insert: allow any authenticated user to upload to product-images bucket
  CREATE POLICY "product_images_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

  -- Select: allow authenticated to read (for signed URLs and list display)
  CREATE POLICY "product_images_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images');

  -- Update/Delete: allow authenticated (for replace/remove)
  CREATE POLICY "product_images_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

  CREATE POLICY "product_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');
END $$;
