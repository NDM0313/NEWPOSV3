-- ============================================================================
-- USER CODE AUTO-GENERATION (USR-001, USR-002, ...)
-- Ensures every user has a unique code per company. Trigger sets on INSERT when NULL.
-- ============================================================================

-- 1. Add column if missing (support both 'code' and 'user_code' for compatibility)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'user_code') THEN
    ALTER TABLE public.users ADD COLUMN user_code VARCHAR(20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'code') THEN
    ALTER TABLE public.users ADD COLUMN code VARCHAR(20);
  END IF;
END $$;

-- 2. Backfill code from user_code where code is null (so one canonical display column)
UPDATE public.users SET code = user_code WHERE code IS NULL AND user_code IS NOT NULL;

-- 3. Function: generate next user code for a company (format USR-XXX)
CREATE OR REPLACE FUNCTION public.generate_user_code(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_num INT := 0;
  v_code TEXT;
  v_match TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN code ~ '^USR-[0-9]+$' THEN NULLIF(SUBSTRING(code FROM 5)::INT, 0)
      WHEN user_code ~ '^USR-[0-9]+$' THEN NULLIF(SUBSTRING(user_code FROM 5)::INT, 0)
      ELSE NULL
    END
  ), 0)
  INTO v_max_num
  FROM public.users
  WHERE company_id = p_company_id;

  v_max_num := v_max_num + 1;
  v_code := 'USR-' || LPAD(v_max_num::TEXT, 3, '0');

  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION public.generate_user_code(UUID) IS 'Returns next USR-XXX code for the given company_id.';

-- 4. Trigger function: set code and user_code on INSERT when NULL
CREATE OR REPLACE FUNCTION public.set_user_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;
  v_code := COALESCE(NULLIF(TRIM(NEW.code), ''), NULLIF(TRIM(NEW.user_code), ''));
  IF v_code IS NULL OR v_code = '' THEN
    v_code := public.generate_user_code(NEW.company_id);
    NEW.code := v_code;
    NEW.user_code := v_code;
  ELSE
    IF (NEW.code IS NULL OR TRIM(NEW.code) = '') THEN NEW.code := v_code; END IF;
    IF (NEW.user_code IS NULL OR TRIM(NEW.user_code) = '') THEN NEW.user_code := v_code; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_user_code_on_insert ON public.users;
CREATE TRIGGER trigger_set_user_code_on_insert
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_code_on_insert();

-- 5. Backfill existing users with NULL code/user_code (per company)
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
  v_next INT;
  v_company UUID;
BEGIN
  FOR v_company IN SELECT DISTINCT company_id FROM public.users WHERE company_id IS NOT NULL
  LOOP
    SELECT COALESCE(MAX(
      CASE
        WHEN code ~ '^USR-[0-9]+$' THEN NULLIF(SUBSTRING(code FROM 5)::INT, 0)
        WHEN user_code ~ '^USR-[0-9]+$' THEN NULLIF(SUBSTRING(user_code FROM 5)::INT, 0)
        ELSE NULL
      END
    ), 0) INTO v_next FROM public.users WHERE company_id = v_company;

    FOR r IN
      SELECT id FROM public.users
      WHERE company_id = v_company
        AND (code IS NULL OR TRIM(COALESCE(code, '')) = '' OR user_code IS NULL OR TRIM(COALESCE(user_code, '')) = '')
      ORDER BY created_at NULLS LAST, id
    LOOP
      v_next := v_next + 1;
      v_code := 'USR-' || LPAD(v_next::TEXT, 3, '0');
      UPDATE public.users SET code = v_code, user_code = v_code WHERE id = r.id;
    END LOOP;
  END LOOP;
END $$;

-- 6. Unique constraint on (company_id, code) - skip if duplicates exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_company_code_unique') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_company_code_unique UNIQUE (company_id, code);
  END IF;
EXCEPTION WHEN unique_violation OR duplicate_object THEN
  NULL;
END $$;
