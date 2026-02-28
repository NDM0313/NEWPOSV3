-- ============================================================================
-- GLOBAL IDENTITY & RECEIVED BY
-- 1) payments.received_by = auth.users.id (who received the payment)
-- 2) activity_logs.performed_by FK -> auth.users(id), keep performed_by_name for display
-- 3) Ensure created_by/received_by/performed_by always store auth.uid()
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. payments: add received_by (auth.users.id)
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.payments.received_by IS 'Identity: auth.users(id) of user who received/recorded the payment.';

-- Backfill: where created_by matches a user, set received_by = auth_user_id
UPDATE public.payments p
SET received_by = u.auth_user_id
FROM public.users u
WHERE p.received_by IS NULL
  AND (p.created_by = u.id OR p.created_by = u.auth_user_id)
  AND u.auth_user_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. activity_logs: performed_by -> auth.users(id)
-- ----------------------------------------------------------------------------
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_performed_by_fkey;
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_performed_by_user_id_fkey;
-- Some schemas may name it differently
DO $$
BEGIN
  ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_performed_by_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.activity_logs
    ADD CONSTRAINT activity_logs_performed_by_fkey
    FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%already exists%' THEN RAISE; END IF;
END $$;

COMMENT ON COLUMN public.activity_logs.performed_by IS 'Identity: auth.users(id). Set to auth.uid() when logging.';

-- Backfill performed_by from public.users.id to auth_user_id where possible
UPDATE public.activity_logs al
SET performed_by = u.auth_user_id
FROM public.users u
WHERE al.performed_by = u.id AND u.auth_user_id IS NOT NULL AND al.performed_by IS DISTINCT FROM u.auth_user_id;

-- ----------------------------------------------------------------------------
-- 3. log_activity RPC: resolve user name by auth_user_id (performed_by = auth.uid())
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_activity(
  p_company_id UUID,
  p_module VARCHAR(50),
  p_entity_id UUID,
  p_entity_reference VARCHAR(100),
  p_action VARCHAR(50),
  p_field VARCHAR(100) DEFAULT NULL,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_amount DECIMAL(15, 2) DEFAULT NULL,
  p_payment_method VARCHAR(50) DEFAULT NULL,
  p_payment_account_id UUID DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_name VARCHAR(255);
  v_user_email VARCHAR(255);
  v_log_id UUID;
  v_actor_id UUID;
BEGIN
  v_actor_id := COALESCE(p_performed_by, auth.uid());
  -- Resolve name: performed_by is auth.users.id → match users.auth_user_id first, then users.id
  IF v_actor_id IS NOT NULL THEN
    SELECT u.full_name, u.email INTO v_user_name, v_user_email
    FROM public.users u
    WHERE u.auth_user_id = v_actor_id;
    IF v_user_name IS NULL AND v_user_email IS NULL THEN
      SELECT u.full_name, u.email INTO v_user_name, v_user_email
      FROM public.users u
      WHERE u.id = v_actor_id;
    END IF;
  END IF;

  INSERT INTO public.activity_logs (
    company_id, module, entity_id, entity_reference, action, field,
    old_value, new_value, amount, payment_method, payment_account_id,
    performed_by, performed_by_name, performed_by_email, description, notes
  ) VALUES (
    p_company_id, p_module, p_entity_id, p_entity_reference, p_action, p_field,
    p_old_value, p_new_value, p_amount, p_payment_method, p_payment_account_id,
    v_actor_id, v_user_name, v_user_email, p_description, p_notes
  )
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;
