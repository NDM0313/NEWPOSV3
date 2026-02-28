-- ============================================================================
-- ERP CONTACTS GLOBAL FIX
-- 1) Customer codes: per-company global sequence (CUS-0001), DB-only.
-- 2) Walk-in: single system customer per company, code CUS-0000.
-- 3) RLS: Admin = all; User = own + system (is_system_generated).
-- 4) Backfill: sales with null customer_id → walk-in; contact codes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add code column to contacts (if missing)
-- ----------------------------------------------------------------------------
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS code VARCHAR(50);
COMMENT ON COLUMN public.contacts.code IS 'Unique per company. Customers: CUS-0000 (walk-in), CUS-0001, ... from get_next_document_number_global.';

-- Reserve CUS-0000 for walk-in (do not use in sequence)
-- Ensure walk-in has code CUS-0000
UPDATE public.contacts
SET code = 'CUS-0000'
WHERE is_default = true AND type IN ('customer', 'both') AND (code IS NULL OR code != 'CUS-0000');

UPDATE public.contacts
SET code = 'CUS-0000'
WHERE is_system_generated = true AND system_type = 'walking_customer' AND (code IS NULL OR code != 'CUS-0000');

-- Unique constraint: one code per company (allow NULL for legacy until backfill)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_company_code_unique
  ON public.contacts (company_id, code)
  WHERE code IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Add CUS to document_sequences_global (function prefix)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_document_number_global(
  p_company_id UUID,
  p_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next BIGINT;
  v_prefix TEXT;
BEGIN
  v_prefix := CASE UPPER(TRIM(p_type))
    WHEN 'SL' THEN 'SL-'
    WHEN 'DRAFT' THEN 'DRAFT-'
    WHEN 'QT' THEN 'QT-'
    WHEN 'SO' THEN 'SO-'
    WHEN 'CUS' THEN 'CUS-'
    WHEN 'PUR' THEN 'PUR-'
    WHEN 'PAY' THEN 'PAY-'
    WHEN 'RNT' THEN 'RNT-'
    WHEN 'STD' THEN 'STD-'
    ELSE UPPER(TRIM(p_type)) || '-'
  END;

  UPDATE public.document_sequences_global
  SET current_number = current_number + 1,
      updated_at = NOW()
  WHERE company_id = p_company_id
    AND document_type = UPPER(TRIM(p_type))
  RETURNING current_number INTO v_next;

  IF v_next IS NULL THEN
    INSERT INTO public.document_sequences_global (company_id, document_type, current_number)
    VALUES (p_company_id, UPPER(TRIM(p_type)), 1)
    RETURNING current_number INTO v_next;
  END IF;

  RETURN v_prefix || LPAD(v_next::TEXT, 4, '0');
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. One walk-in per company (by company only; code CUS-0000)
--    Ensure trigger-created walk-in gets code (trigger may not have code column when created)
-- ----------------------------------------------------------------------------
-- Backfill: one default walk-in per company with code CUS-0000
INSERT INTO public.contacts (company_id, type, name, code, is_default, is_system_generated, system_type, is_active, opening_balance, credit_limit, payment_terms)
SELECT c.id, 'customer', 'Walk-in Customer', 'CUS-0000', true, true, 'walking_customer', true, 0, 0, 0
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.contacts ct
  WHERE ct.company_id = c.id AND ct.is_default = true AND ct.type IN ('customer', 'both')
);

UPDATE public.contacts SET code = 'CUS-0000'
WHERE is_default = true AND type IN ('customer', 'both') AND (code IS NULL OR code = '');

-- ----------------------------------------------------------------------------
-- 4. Backfill sales with null customer_id → walk-in for same company
-- ----------------------------------------------------------------------------
UPDATE public.sales s
SET customer_id = (
  SELECT ct.id FROM public.contacts ct
  WHERE ct.company_id = s.company_id AND ct.is_default = true AND ct.type IN ('customer', 'both')
  LIMIT 1
)
WHERE s.customer_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.contacts ct
    WHERE ct.company_id = s.company_id AND ct.is_default = true
  );

-- ----------------------------------------------------------------------------
-- 5. RLS: Contacts — Admin sees all; User sees own + system (walk-in)
--    Use auth.uid() for created_by comparison (identity standard).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "contacts_select_role_based" ON public.contacts;
DROP POLICY IF EXISTS "contacts_select_enterprise" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_role_based" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_enterprise" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_role_based" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_enterprise" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_role_based" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_enterprise" ON public.contacts;

-- SELECT: admin all; non-admin own (created_by = auth.uid()) or system (is_system_generated)
CREATE POLICY "contacts_select_policy"
  ON public.contacts FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR created_by = auth.uid()
      OR is_system_generated = true
    )
  );

-- INSERT: same company; code assigned by app/trigger
CREATE POLICY "contacts_insert_policy"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- UPDATE: admin all; non-admin own or system (for read-only system fields)
CREATE POLICY "contacts_update_policy"
  ON public.contacts FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR created_by = auth.uid()
      OR is_system_generated = true
    )
  );

-- DELETE: admin or own; never system/default
CREATE POLICY "contacts_delete_policy"
  ON public.contacts FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (get_user_role() = 'admin' OR created_by = auth.uid())
    AND is_default = false
  );

COMMENT ON TABLE public.contacts IS 'Contacts (customers/suppliers/workers). Customer code: global CUS-xxx per company. Walk-in: one per company, code CUS-0000. RLS: admin=all, user=own+system.';

-- ----------------------------------------------------------------------------
-- 6. Backfill code for existing customers (non-walk-in) per company
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
BEGIN
  FOR r IN
    SELECT id, company_id
    FROM public.contacts
    WHERE type IN ('customer', 'both')
      AND (code IS NULL OR code = '')
      AND (is_default = false OR is_default IS NULL)
      AND (is_system_generated = false OR is_system_generated IS NULL)
    ORDER BY company_id, created_at
  LOOP
    BEGIN
      v_code := public.get_next_document_number_global(r.company_id, 'CUS');
      UPDATE public.contacts SET code = v_code WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip backfill code for contact %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;
