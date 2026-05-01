-- Replica / outfit title for unified studio production (one production per sale).

ALTER TABLE studio_productions ADD COLUMN IF NOT EXISTS design_name TEXT;

COMMENT ON COLUMN studio_productions.design_name IS 'Customer-facing replica or new design name for the studio outfit (optional).';
