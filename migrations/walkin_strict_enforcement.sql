-- ============================================================================
-- WALK-IN STRICT ENFORCEMENT MODE
-- Run after walkin_consolidation_single_per_company.sql
-- 1) Only ONE walk-in per company (unique index on system_type = 'walking_customer').
-- 2) Walk-in code must be CUS-0000 (CHECK constraint).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Strict unique index — one walk-in per company by system_type
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.unique_walkin_per_company_strict;
CREATE UNIQUE INDEX unique_walkin_per_company_strict
  ON public.contacts (company_id)
  WHERE system_type = 'walking_customer';

-- ----------------------------------------------------------------------------
-- STEP 2: CHECK — walk-in must have code CUS-0000
-- ----------------------------------------------------------------------------
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS walkin_code_must_be_reserved;

ALTER TABLE public.contacts
  ADD CONSTRAINT walkin_code_must_be_reserved
  CHECK (
    (system_type = 'walking_customer' AND code = 'CUS-0000')
    OR
    (system_type IS DISTINCT FROM 'walking_customer')
  );

COMMENT ON CONSTRAINT walkin_code_must_be_reserved ON public.contacts
  IS 'Walk-in customer must have reserved code CUS-0000. No other contact may use that code for walk-in.';
