-- Add company timezone/date format columns if not present (for global ERP date/time display).
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE companies ADD COLUMN IF NOT EXISTS date_format VARCHAR(20);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS time_format VARCHAR(10);

COMMENT ON COLUMN companies.date_format IS 'Display format: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD';
COMMENT ON COLUMN companies.time_format IS '12h or 24h';

-- Optional: set defaults for existing rows (leave null to use app default)
-- UPDATE companies SET date_format = 'DD/MM/YYYY' WHERE date_format IS NULL;
-- UPDATE companies SET time_format = '12h' WHERE time_format IS NULL;
