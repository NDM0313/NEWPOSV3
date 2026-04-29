-- ============================================================================
-- Migration 61: Create business bootstrap template (complete deterministic seed)
-- ============================================================================

DO $$
BEGIN
  DROP FUNCTION IF EXISTS create_business_transaction(
    TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '61: Skip old signature drop: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION create_business_transaction(
  p_business_name TEXT,
  p_owner_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_user_id UUID DEFAULT NULL,
  p_currency TEXT DEFAULT 'PKR',
  p_fiscal_year_start DATE DEFAULT NULL,
  p_branch_name TEXT DEFAULT 'Main Branch',
  p_branch_code TEXT DEFAULT 'HQ',
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_business_type TEXT DEFAULT NULL,
  p_modules JSONB DEFAULT NULL,
  p_accounting_method TEXT DEFAULT 'Accrual',
  p_tax_mode TEXT DEFAULT 'Inclusive',
  p_default_tax_rate NUMERIC DEFAULT 0,
  p_costing_method TEXT DEFAULT 'FIFO',
  p_allow_negative_stock BOOLEAN DEFAULT FALSE,
  p_default_unit TEXT DEFAULT 'pcs',
  p_base_units JSONB DEFAULT '["pcs"]'::JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_branch_id UUID;
  v_result JSON;
  v_fiscal_start DATE;
  v_module TEXT;
  v_unit TEXT;
  v_default_unit_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, gen_random_uuid());
  v_fiscal_start := COALESCE(p_fiscal_year_start::DATE, '2024-01-01'::DATE);

  INSERT INTO companies (
    id, name, email, currency, is_active, created_at, updated_at,
    phone, address, country, timezone, business_type
  )
  VALUES (
    gen_random_uuid(),
    p_business_name,
    p_email,
    COALESCE(NULLIF(TRIM(p_currency), ''), 'PKR'),
    TRUE, NOW(), NOW(),
    NULLIF(TRIM(COALESCE(p_phone, '')), ''),
    NULLIF(TRIM(COALESCE(p_address, '')), ''),
    NULLIF(TRIM(COALESCE(p_country, '')), ''),
    NULLIF(TRIM(COALESCE(p_timezone, '')), ''),
    NULLIF(TRIM(COALESCE(p_business_type, '')), '')
  )
  RETURNING id INTO v_company_id;

  BEGIN
    UPDATE companies SET financial_year_start = v_fiscal_start WHERE id = v_company_id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  INSERT INTO branches (
    id, company_id, name, code, is_active, created_at, updated_at,
    address, phone, country
  )
  VALUES (
    gen_random_uuid(),
    v_company_id,
    COALESCE(NULLIF(TRIM(p_branch_name), ''), 'Main Branch'),
    COALESCE(NULLIF(TRIM(p_branch_code), ''), 'HQ'),
    TRUE, NOW(), NOW(),
    NULLIF(TRIM(COALESCE(p_address, '')), ''),
    NULLIF(TRIM(COALESCE(p_phone, '')), ''),
    NULLIF(TRIM(COALESCE(p_country, '')), '')
  )
  RETURNING id INTO v_branch_id;

  INSERT INTO users (id, company_id, email, full_name, role, is_active, created_at, updated_at, auth_user_id)
  VALUES (v_user_id, v_company_id, p_email, p_owner_name, 'admin', TRUE, NOW(), NOW(), p_user_id);

  BEGIN
    INSERT INTO user_branches (user_id, branch_id, is_default, created_at)
    VALUES (v_user_id, v_branch_id, TRUE, NOW());
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Core accounts
  INSERT INTO accounts (company_id, code, name, type, is_active)
  SELECT v_company_id, x.code, x.name, x.type, TRUE
  FROM (VALUES
    ('1000', 'Cash', 'cash'),
    ('1010', 'Bank', 'bank'),
    ('1020', 'Mobile Wallet', 'mobile_wallet'),
    ('1100', 'Accounts Receivable', 'asset'),
    ('2000', 'Accounts Payable', 'liability'),
    ('5000', 'Operating Expense', 'expense')
  ) AS x(code, name, type)
  WHERE NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.company_id = v_company_id AND a.code = x.code
  );

  -- Units (global template)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'units') THEN
    -- Ensure a deterministic set even if UI sends only one base unit
    FOR v_unit IN
      SELECT DISTINCT u
      FROM (
        SELECT jsonb_array_elements_text(COALESCE(NULLIF(p_base_units, 'null'::JSONB), '["pcs"]'::JSONB)) AS u
        UNION ALL SELECT 'pcs'
        UNION ALL SELECT 'meter'
        UNION ALL SELECT 'kg'
        UNION ALL SELECT 'liter'
      ) s
      WHERE NULLIF(TRIM(s.u), '') IS NOT NULL
    LOOP
      INSERT INTO units (company_id, name, short_code, symbol, allow_decimal, is_default, is_active, sort_order, created_at, updated_at)
      VALUES (
        v_company_id,
        CASE lower(v_unit)
          WHEN 'pcs' THEN 'Piece'
          WHEN 'meter' THEN 'Meter'
          WHEN 'kg' THEN 'Kilogram'
          WHEN 'liter' THEN 'Liter'
          ELSE initcap(v_unit)
        END,
        lower(v_unit),
        lower(v_unit),
        CASE WHEN lower(v_unit) IN ('meter', 'kg', 'liter') THEN TRUE ELSE FALSE END,
        FALSE,
        TRUE,
        0,
        NOW(),
        NOW()
      )
      ON CONFLICT (company_id, name) DO NOTHING;
    END LOOP;

    UPDATE units SET is_default = FALSE WHERE company_id = v_company_id;
    UPDATE units
    SET is_default = TRUE
    WHERE company_id = v_company_id
      AND short_code = COALESCE(NULLIF(TRIM(lower(p_default_unit)), ''), 'pcs');

    IF NOT FOUND THEN
      UPDATE units SET is_default = TRUE
      WHERE company_id = v_company_id
        AND short_code = 'pcs';
    END IF;

    SELECT id INTO v_default_unit_id
    FROM units
    WHERE company_id = v_company_id
      AND is_default = TRUE
    LIMIT 1;
  END IF;

  -- Product categories (global template)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_categories') THEN
    INSERT INTO product_categories (company_id, name, parent_id, description, is_active, created_at, updated_at)
    SELECT v_company_id, c.name, NULL, c.description, TRUE, NOW(), NOW()
    FROM (VALUES
      ('General', 'Default root category'),
      ('Raw Material', 'Raw materials and inventory inputs'),
      ('Finished Goods', 'Ready to sell items'),
      ('Services', 'Service and non-stock items')
    ) AS c(name, description)
    WHERE NOT EXISTS (
      SELECT 1
      FROM product_categories pc
      WHERE pc.company_id = v_company_id
        AND lower(pc.name) = lower(c.name)
        AND pc.parent_id IS NULL
    );
  END IF;

  -- Module toggles
  IF p_modules IS NOT NULL AND jsonb_typeof(p_modules) = 'array' AND jsonb_array_length(p_modules) > 0 THEN
    FOR v_module IN SELECT jsonb_array_elements_text(p_modules)
    LOOP
      v_module := NULLIF(TRIM(v_module), '');
      IF v_module IS NOT NULL THEN
        INSERT INTO modules_config (company_id, module_name, is_enabled, created_at, updated_at)
        VALUES (v_company_id, v_module, TRUE, NOW(), NOW())
        ON CONFLICT (company_id, module_name) DO UPDATE
          SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW();
      END IF;
    END LOOP;
  END IF;

  -- Company settings bootstrap
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    INSERT INTO settings (company_id, key, value, category, description, updated_at)
    VALUES
    (
      v_company_id,
      'accounting_settings',
      jsonb_build_object(
        'fiscalYearStart', to_char(v_fiscal_start, 'YYYY-MM-DD'),
        'fiscalYearEnd', to_char((v_fiscal_start + INTERVAL '1 year' - INTERVAL '1 day')::DATE, 'YYYY-MM-DD'),
        'manualJournalEnabled', TRUE,
        'defaultCurrency', COALESCE(NULLIF(TRIM(p_currency), ''), 'PKR'),
        'multiCurrencyEnabled', FALSE,
        'taxCalculationMethod', COALESCE(NULLIF(TRIM(p_tax_mode), ''), 'Inclusive'),
        'defaultTaxRate', GREATEST(0, COALESCE(p_default_tax_rate, 0)),
        'accountingMethod', COALESCE(NULLIF(TRIM(p_accounting_method), ''), 'Accrual')
      ),
      'accounting',
      'Default accounting bootstrap settings',
      NOW()
    ),
    (
      v_company_id,
      'inventory_settings',
      jsonb_build_object(
        'lowStockThreshold', 5,
        'reorderAlertDays', 7,
        'negativeStockAllowed', COALESCE(p_allow_negative_stock, FALSE),
        'valuationMethod', COALESCE(NULLIF(TRIM(p_costing_method), ''), 'FIFO'),
        'autoReorderEnabled', FALSE,
        'barcodeRequired', FALSE,
        'defaultUnitId', v_default_unit_id
      ),
      'inventory',
      'Default inventory bootstrap settings',
      NOW()
    ),
    (
      v_company_id,
      'default_accounts',
      jsonb_build_object(
        'paymentMethods',
        jsonb_build_array(
          jsonb_build_object('id', 'cash', 'method', 'Cash', 'enabled', TRUE, 'defaultAccount', 'Cash'),
          jsonb_build_object('id', 'bank', 'method', 'Bank', 'enabled', TRUE, 'defaultAccount', 'Bank'),
          jsonb_build_object('id', 'wallet', 'method', 'Mobile Wallet', 'enabled', TRUE, 'defaultAccount', 'Mobile Wallet')
        )
      ),
      'accounts',
      'Default payment method bootstrap',
      NOW()
    )
    ON CONFLICT (company_id, key) DO UPDATE
      SET value = EXCLUDED.value,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          updated_at = NOW();
  END IF;

  -- Numbering defaults (company-level)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_sequences') THEN
    INSERT INTO document_sequences (company_id, branch_id, document_type, prefix, current_number, padding, updated_at)
    SELECT v_company_id, NULL::UUID, d.document_type, d.prefix, 0, 4, NOW()
    FROM (VALUES
      ('sale', 'SL-'),
      ('purchase', 'PUR-'),
      ('rental', 'RNT-'),
      ('expense', 'EXP-'),
      ('product', 'PRD-'),
      ('studio', 'STD-'),
      ('pos', 'POS-'),
      ('payment', 'PAY-'),
      ('job', 'JOB-'),
      ('journal', 'JV-')
    ) AS d(document_type, prefix)
    ON CONFLICT (company_id, branch_id, document_type) DO NOTHING;
  END IF;

  -- Global numbering defaults (used by get_next_document_number_global)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_sequences_global') THEN
    INSERT INTO document_sequences_global (company_id, document_type, current_number, updated_at)
    SELECT v_company_id, d.document_type, 0, NOW()
    FROM (VALUES
      ('SL'), ('PS'), ('DRAFT'), ('QT'), ('SO'),
      ('SDR'), ('SQT'), ('SOR'),
      ('PUR'), ('PDR'), ('POR'),
      ('EXP'), ('RNT'), ('STD'),
      ('PAY'), ('RCP'), ('PRD'),
      ('CUS'), ('SUP'), ('WRK'),
      ('JOB'), ('JE')
    ) AS d(document_type)
    ON CONFLICT (company_id, document_type) DO NOTHING;
  END IF;

  -- ERP numbering engine defaults (manual entry / journal / other generate_document_number users)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'erp_document_sequences') THEN
    INSERT INTO erp_document_sequences (
      company_id, branch_id, document_type, prefix, year, last_number, padding, updated_at
    )
    SELECT
      v_company_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      d.document_type,
      d.prefix,
      EXTRACT(YEAR FROM NOW())::INTEGER,
      0,
      4,
      NOW()
    FROM (VALUES
      ('SALE', 'SL'),
      ('PURCHASE', 'PUR'),
      ('PAYMENT', 'PAY'),
      ('EXPENSE', 'EXP'),
      ('RENTAL', 'REN'),
      ('JOURNAL', 'JE'),
      ('PRODUCT', 'PRD'),
      ('STUDIO', 'STD'),
      ('JOB', 'JOB'),
      ('POS', 'POS')
    ) AS d(document_type, prefix)
    ON CONFLICT (company_id, branch_id, document_type, year) DO NOTHING;
  END IF;

  v_result := json_build_object(
    'success', TRUE,
    'userId', v_user_id,
    'companyId', v_company_id,
    'branchId', v_branch_id
  );
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', FALSE, 'error', SQLERRM);
END;
$body$;

DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION create_business_transaction(
    TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, TEXT, JSONB
  ) TO service_role;
  GRANT EXECUTE ON FUNCTION create_business_transaction(
    TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, TEXT, JSONB
  ) TO authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '61: grants skipped: %', SQLERRM;
END $$;

