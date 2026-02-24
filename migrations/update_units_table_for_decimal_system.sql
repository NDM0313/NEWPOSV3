-- ============================================================================
-- UPDATE UNITS TABLE FOR DECIMAL SYSTEM
-- ============================================================================
-- Adds: allow_decimal, is_default, short_code columns
-- Ensures default Piece unit exists for all companies
-- ============================================================================

-- 1. Add new columns to units table
DO $$
BEGIN
  -- Add short_code column (if not exists)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'short_code') THEN
    ALTER TABLE units ADD COLUMN short_code VARCHAR(20);
    -- Migrate existing symbol to short_code
    UPDATE units SET short_code = symbol WHERE short_code IS NULL AND symbol IS NOT NULL;
  END IF;

  -- Add allow_decimal column (if not exists)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'allow_decimal') THEN
    ALTER TABLE units ADD COLUMN allow_decimal BOOLEAN DEFAULT false;
  END IF;

  -- Add is_default column (if not exists)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'is_default') THEN
    ALTER TABLE units ADD COLUMN is_default BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. Create unique constraint: only one default unit per company
DO $$
BEGIN
  -- First, ensure no duplicate defaults exist
  UPDATE units u1
  SET is_default = false
  WHERE is_default = true
  AND EXISTS (
    SELECT 1 FROM units u2
    WHERE u2.company_id = u1.company_id
    AND u2.id != u1.id
    AND u2.is_default = true
    AND u2.created_at < u1.created_at
  );

  -- Drop if exists (index, not constraint - pg_constraint won't find it)
  DROP INDEX IF EXISTS units_one_default_per_company;
  -- Create unique partial index
  CREATE UNIQUE INDEX units_one_default_per_company
  ON units(company_id)
  WHERE is_default = true;
END $$;

-- 3. Ensure default Piece unit exists for all existing companies
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT id FROM companies LOOP
    -- Check if default Piece unit exists for this company
    IF NOT EXISTS (
      SELECT 1 FROM units 
      WHERE company_id = company_record.id 
      AND (name ILIKE 'piece' OR name ILIKE 'pcs' OR is_default = true)
    ) THEN
      -- Insert default Piece unit
      INSERT INTO units (
        company_id,
        name,
        short_code,
        symbol,
        allow_decimal,
        is_default,
        is_active,
        sort_order,
        created_at,
        updated_at
      ) VALUES (
        company_record.id,
        'Piece',
        'pcs',
        'pcs',
        false,
        true,
        true,
        0,
        NOW(),
        NOW()
      );
    ELSE
      -- Update existing Piece unit to be default if not already
      UPDATE units
      SET 
        name = 'Piece',
        short_code = COALESCE(short_code, 'pcs'),
        symbol = COALESCE(symbol, 'pcs'),
        allow_decimal = false,
        is_default = true,
        is_active = true,
        updated_at = NOW()
      WHERE company_id = company_record.id
      AND (name ILIKE 'piece' OR name ILIKE 'pcs')
      AND is_default != true;
    END IF;
  END LOOP;
END $$;

-- 4. Add comments
COMMENT ON COLUMN units.short_code IS 'Short code for unit (e.g., pcs, m, kg, yd)';
COMMENT ON COLUMN units.allow_decimal IS 'Whether this unit allows decimal quantities (e.g., Meter=yes, Piece=no)';
COMMENT ON COLUMN units.is_default IS 'Whether this is the default unit for the company (only one per company)';
