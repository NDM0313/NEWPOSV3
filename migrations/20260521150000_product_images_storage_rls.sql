-- Product-images bucket storage RLS (idempotent). Safe to re-run.
-- See docs/PRODUCT_IMAGES_STORAGE_RLS_FIX.md

DO $$
BEGIN
  DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_update" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_delete" ON storage.objects;

  CREATE POLICY "product_images_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

  CREATE POLICY "product_images_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

  CREATE POLICY "product_images_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

  CREATE POLICY "product_images_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');
END $$;
