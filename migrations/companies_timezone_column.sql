-- Phase 2 Global Timezone: Ensure companies.timezone exists for multi-country ERP.
-- Database stores UTC; frontend and mobile convert using company timezone.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE companies ADD COLUMN timezone TEXT DEFAULT 'UTC';
    COMMENT ON COLUMN companies.timezone IS 'IANA timezone e.g. Asia/Karachi, Asia/Kolkata, UTC';
  END IF;
END $$;
