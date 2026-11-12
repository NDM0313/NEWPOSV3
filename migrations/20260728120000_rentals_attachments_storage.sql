-- Rental booking attachments: JSONB column + dedicated storage bucket (sales/purchases parity).
-- Idempotent. Safe to re-run. Pickup identity photos remain on document_* columns.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE public.rentals ADD COLUMN attachments JSONB DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.rentals.attachments IS
  'Booking document attachments as [{url, name}, ...]; refs like rental-attachments/{companyId}/{rentalId}/...';

INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
SELECT 'rental-attachments', 'rental-attachments', false, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'rental-attachments');

DO $$
BEGIN
  DROP POLICY IF EXISTS "rental_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "rental_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "rental_attachments_update" ON storage.objects;

  CREATE POLICY "rental_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rental-attachments');

  CREATE POLICY "rental_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rental-attachments');

  CREATE POLICY "rental_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'rental-attachments')
  WITH CHECK (bucket_id = 'rental-attachments');
END $$;
