-- Rental security document at pickup; security_status returned at return
-- Safe: only adds columns if missing

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'security_document_type') THEN
    ALTER TABLE rentals ADD COLUMN security_document_type VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'security_document_number') THEN
    ALTER TABLE rentals ADD COLUMN security_document_number VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'security_document_image_url') THEN
    ALTER TABLE rentals ADD COLUMN security_document_image_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'security_status') THEN
    ALTER TABLE rentals ADD COLUMN security_status VARCHAR(50);
  END IF;
END $$;

COMMENT ON COLUMN rentals.security_status IS 'collected at pickup, returned at return';
