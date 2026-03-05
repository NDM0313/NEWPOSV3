-- ============================================================================
-- Product module: Categories, Brands (RLS), SKU sequence, Uniques
-- Run on Supabase (VPS or hosted). Ensures:
-- 1. product_categories and brands load for all users in same company (RLS)
-- 2. Product SKU uses document_sequences 'product' (PRD-0001, ...)
-- 3. Sequence initialized from max existing PRD-* so existing data is safe
-- 4. UNIQUE(company_id, sku) and unique barcode per company
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ensure get_user_company_id() exists (supports id and auth_user_id)
-- Skip if public.users does not exist (e.g. Supabase auth schema only).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    CREATE OR REPLACE FUNCTION get_user_company_id()
    RETURNS UUID AS $fn$
      SELECT COALESCE(
        (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1),
        (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
      );
    $fn$ LANGUAGE sql STABLE SECURITY DEFINER;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. product_categories: RLS policies (company-scoped; all same-company users)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_categories') THEN
    ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_categories') THEN
    DROP POLICY IF EXISTS "product_categories_select_company" ON product_categories;
    DROP POLICY IF EXISTS "product_categories_insert_company" ON product_categories;
    DROP POLICY IF EXISTS "product_categories_update_company" ON product_categories;
    DROP POLICY IF EXISTS "product_categories_delete_company" ON product_categories;
    DROP POLICY IF EXISTS "Users can view categories in company" ON product_categories;
    DROP POLICY IF EXISTS "Users can insert categories in company" ON product_categories;
    DROP POLICY IF EXISTS "Users can update categories in company" ON product_categories;

    CREATE POLICY "product_categories_select_company"
      ON product_categories FOR SELECT TO authenticated
      USING (company_id = get_user_company_id());
    CREATE POLICY "product_categories_insert_company"
      ON product_categories FOR INSERT TO authenticated
      WITH CHECK (company_id = get_user_company_id());
    CREATE POLICY "product_categories_update_company"
      ON product_categories FOR UPDATE TO authenticated
      USING (company_id = get_user_company_id())
      WITH CHECK (company_id = get_user_company_id());
    CREATE POLICY "product_categories_delete_company"
      ON product_categories FOR DELETE TO authenticated
      USING (company_id = get_user_company_id());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. brands: ensure table exists and RLS (company-scoped)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'brands') THEN
    ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "brands_company" ON brands;
    DROP POLICY IF EXISTS "brands_select_company" ON brands;
    DROP POLICY IF EXISTS "brands_insert_company" ON brands;
    DROP POLICY IF EXISTS "brands_update_company" ON brands;
    DROP POLICY IF EXISTS "brands_delete_company" ON brands;

    CREATE POLICY "brands_select_company"
      ON brands FOR SELECT TO authenticated
      USING (company_id = get_user_company_id());
    CREATE POLICY "brands_insert_company"
      ON brands FOR INSERT TO authenticated
      WITH CHECK (company_id = get_user_company_id());
    CREATE POLICY "brands_update_company"
      ON brands FOR UPDATE TO authenticated
      USING (company_id = get_user_company_id())
      WITH CHECK (company_id = get_user_company_id());
    CREATE POLICY "brands_delete_company"
      ON brands FOR DELETE TO authenticated
      USING (company_id = get_user_company_id());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. get_next_document_number: ensure 'product' type returns PRD-XXXX
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_next_document_number(
  p_company_id UUID,
  p_branch_id UUID,
  p_document_type VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_current_number INTEGER;
  v_padding INTEGER;
  v_new_number VARCHAR;
BEGIN
  INSERT INTO document_sequences (company_id, branch_id, document_type, prefix, current_number, padding)
  VALUES (
    p_company_id,
    p_branch_id,
    p_document_type,
    CASE p_document_type
      WHEN 'sale' THEN 'INV-'
      WHEN 'purchase' THEN 'PO-'
      WHEN 'expense' THEN 'EXP-'
      WHEN 'rental' THEN 'RNT-'
      WHEN 'studio' THEN 'STD-'
      WHEN 'journal' THEN 'JE-'
      WHEN 'payment' THEN 'PMT-'
      WHEN 'receipt' THEN 'RCP-'
      WHEN 'product' THEN 'PRD-'
      ELSE 'DOC-'
    END,
    0,
    4
  )
  ON CONFLICT (company_id, branch_id, document_type)
  DO UPDATE SET
    current_number = document_sequences.current_number + 1,
    updated_at = NOW()
  RETURNING prefix, current_number, padding
  INTO v_prefix, v_current_number, v_padding;

  IF v_prefix IS NULL OR v_current_number IS NULL THEN
    RAISE EXCEPTION 'document_sequences row missing for company_id=%, branch_id=%, document_type=%', p_company_id, p_branch_id, p_document_type;
  END IF;

  v_new_number := v_prefix || LPAD(v_current_number::TEXT, COALESCE(v_padding, 4), '0');
  RETURN v_new_number;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5. Initialize product sequence from max existing SKU (PRD-*) per company/branch
--    So next generated SKU does not clash with existing products.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_max_num INTEGER;
  v_branch_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_sequences') THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT DISTINCT company_id FROM products
  LOOP
    -- Max numeric part from products.sku where sku like 'PRD-%' for this company
    SELECT COALESCE(MAX(
      NULLIF(REGEXP_REPLACE(sku, '^PRD-0*', ''), '')::INTEGER
    ), 0)
    INTO v_max_num
    FROM products
    WHERE company_id = r.company_id
      AND sku IS NOT NULL
      AND sku ~ '^PRD-[0-9]+$';

    -- Ensure we have a document_sequences row for product (branch_id NULL = company-level product SKU)
    -- Store last-used number so next get_next_document_number returns v_max_num+1
    INSERT INTO document_sequences (company_id, branch_id, document_type, prefix, current_number, padding, updated_at)
    VALUES (r.company_id, NULL, 'product', 'PRD-', v_max_num, 4, NOW())
    ON CONFLICT (company_id, branch_id, document_type)
    DO UPDATE SET
      current_number = GREATEST(document_sequences.current_number, v_max_num),
      updated_at = NOW();
  END LOOP;
END $$;

-- Also init per-branch product sequences if you use branch_id for products (optional)
DO $$
DECLARE
  r RECORD;
  v_max_num INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_sequences') THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT ds.company_id, ds.branch_id
    FROM document_sequences ds
    WHERE ds.document_type = 'product'
      AND ds.branch_id IS NOT NULL
  LOOP
    SELECT COALESCE(MAX(
      NULLIF(REGEXP_REPLACE(p.sku, '^PRD-0*', ''), '')::INTEGER
    ), 0)
    INTO v_max_num
    FROM products p
    WHERE p.company_id = r.company_id
      AND p.sku IS NOT NULL
      AND p.sku ~ '^PRD-[0-9]+$';
    UPDATE document_sequences
    SET current_number = GREATEST(COALESCE(current_number, 0), v_max_num), updated_at = NOW()
    WHERE company_id = r.company_id AND branch_id = r.branch_id AND document_type = 'product';
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 6. UNIQUE constraints: (company_id, sku) and barcode per company
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    RETURN;
  END IF;
  BEGIN
    ALTER TABLE products ADD CONSTRAINT products_company_id_sku_key UNIQUE (company_id, sku);
  EXCEPTION
    WHEN duplicate_object THEN NULL;  -- constraint already exists
    WHEN duplicate_table THEN NULL;   -- 42P07: relation "products_company_id_sku_key" already exists
  END;
  DROP INDEX IF EXISTS products_company_barcode_unique;
  CREATE UNIQUE INDEX products_company_barcode_unique
    ON products (company_id, barcode)
    WHERE barcode IS NOT NULL AND barcode != '';
END $$;

-- ----------------------------------------------------------------------------
-- 7. document_sequences RLS: ensure product sequence is readable by company users
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_sequences') THEN
    ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "document_sequences_select_company" ON document_sequences;
    DROP POLICY IF EXISTS "document_sequences_insert_company" ON document_sequences;
    DROP POLICY IF EXISTS "document_sequences_update_company" ON document_sequences;
    CREATE POLICY "document_sequences_select_company"
      ON document_sequences FOR SELECT TO authenticated
      USING (company_id = get_user_company_id());
    CREATE POLICY "document_sequences_insert_company"
      ON document_sequences FOR INSERT TO authenticated
      WITH CHECK (company_id = get_user_company_id());
    CREATE POLICY "document_sequences_update_company"
      ON document_sequences FOR UPDATE TO authenticated
      USING (company_id = get_user_company_id())
      WITH CHECK (company_id = get_user_company_id());
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'document_sequences RLS skip: %', SQLERRM;
END $$;
