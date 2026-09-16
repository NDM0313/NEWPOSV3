-- Dual-credit Agent FX (Phase 1): contact type, purchase FX columns, fx_currency_purchases, RPCs.
-- PKR GL only: credit purchase posts Dr TT wallet / Cr Agent AP. Does not alter record_payment_with_accounting.

-- ---------------------------------------------------------------------------
-- 1) contact_type: money_exchange
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'contact_type' AND e.enumlabel = 'money_exchange'
  ) THEN
    ALTER TYPE public.contact_type ADD VALUE 'money_exchange';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) AP ensure: supplier | both | money_exchange
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ensure_ap_subaccount_for_contact(p_company_id uuid, p_contact_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_control_id UUID;
  v_child_id UUID;
  v_contact RECORD;
  v_slug TEXT;
  v_code TEXT;
  v_name TEXT;
  v_type TEXT;
BEGIN
  SELECT id INTO v_control_id
  FROM accounts
  WHERE company_id = p_company_id
    AND trim(COALESCE(code, '')) = '2000'
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_control_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_contact_id IS NULL THEN
    RETURN v_control_id;
  END IF;

  SELECT id INTO v_child_id
  FROM accounts
  WHERE company_id = p_company_id
    AND parent_id = v_control_id
    AND linked_contact_id = p_contact_id
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_child_id IS NOT NULL THEN
    RETURN v_child_id;
  END IF;

  SELECT id, name, type::text AS type, code INTO v_contact
  FROM contacts
  WHERE company_id = p_company_id AND id = p_contact_id
  LIMIT 1;

  IF v_contact.id IS NULL THEN
    RETURN v_control_id;
  END IF;

  v_type := lower(trim(COALESCE(v_contact.type, '')));
  IF v_type NOT IN ('supplier', 'both', 'money_exchange')
     AND position('supplier' in v_type) = 0 THEN
    RETURN v_control_id;
  END IF;

  v_slug := public._party_slug_from_contact(v_contact.code, p_contact_id);
  v_code := 'AP-' || v_slug;
  v_name := left('Payable — ' || COALESCE(v_contact.name, 'Supplier'), 250);

  BEGIN
    INSERT INTO accounts (
      company_id, code, name, type, parent_id, linked_contact_id, is_active
    )
    VALUES (
      p_company_id, v_code, v_name, 'liability'::account_type, v_control_id, p_contact_id, TRUE
    )
    RETURNING id INTO v_child_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_child_id
      FROM accounts
      WHERE company_id = p_company_id AND code = v_code
      LIMIT 1;
  END;

  RETURN COALESCE(v_child_id, v_control_id);
END;
$function$;

COMMENT ON FUNCTION public._ensure_ap_subaccount_for_contact(uuid, uuid) IS
  'Ensure AP child under 2000 for supplier/both/money_exchange contacts.';

-- ---------------------------------------------------------------------------
-- 3) TT-agent wallet heuristic (mirrors isPartyTtAgentWalletAccount)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_tt_agent_wallet_account(p_code text, p_name text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits text := regexp_replace(TRIM(COALESCE(p_code, '')), '\D', '', 'g');
  v_name text := lower(TRIM(COALESCE(p_name, '')));
BEGIN
  -- Avoid POSIX \b (backspace); use simple substring matches (mirrors TS heuristics).
  IF v_name ~* 'clearing' THEN
    RETURN FALSE;
  END IF;
  IF length(v_digits) < 3 OR v_digits NOT LIKE '12%' THEN
    RETURN FALSE;
  END IF;
  IF v_name ~* 'tt[[:space:]]*agent' THEN RETURN TRUE; END IF;
  IF v_name ~* 'ik[[:space:]]*rmb' THEN RETURN TRUE; END IF;
  IF v_name ~* 'hamid' AND v_name ~* 'rmb' THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Additive FX columns on purchases / items / payments
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS document_currency text NULL,
  ADD COLUMN IF NOT EXISTS fx_rate_to_base numeric(18, 8) NULL,
  ADD COLUMN IF NOT EXISTS foreign_subtotal numeric(18, 2) NULL,
  ADD COLUMN IF NOT EXISTS foreign_total numeric(18, 2) NULL;

COMMENT ON COLUMN public.purchases.document_currency IS
  'Import FX document currency (CNY/USD/PKR). Null when multiCurrencyEnabled OFF.';
COMMENT ON COLUMN public.purchases.fx_rate_to_base IS
  'FC → company base (PKR) rate. Books amounts remain in total/subtotal PKR.';
COMMENT ON COLUMN public.purchases.foreign_subtotal IS
  'Foreign currency subtotal metadata; GL uses PKR subtotal.';
COMMENT ON COLUMN public.purchases.foreign_total IS
  'Foreign currency total metadata; GL uses PKR total.';

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS foreign_unit_price numeric(18, 4) NULL,
  ADD COLUMN IF NOT EXISTS foreign_line_total numeric(18, 2) NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS foreign_amount numeric(18, 2) NULL,
  ADD COLUMN IF NOT EXISTS fx_rate numeric(18, 8) NULL,
  ADD COLUMN IF NOT EXISTS document_currency text NULL;

-- ---------------------------------------------------------------------------
-- 5) fx_currency_purchases (FC buy on credit from money-exchange agent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fx_currency_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NULL REFERENCES public.branches(id) ON DELETE SET NULL,
  agent_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  wallet_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  document_currency text NOT NULL,
  foreign_amount numeric(18, 2) NOT NULL CHECK (foreign_amount > 0),
  fx_rate_to_base numeric(18, 8) NOT NULL CHECK (fx_rate_to_base > 0),
  amount_pkr numeric(18, 2) NOT NULL CHECK (amount_pkr > 0),
  paid_amount_pkr numeric(18, 2) NOT NULL DEFAULT 0 CHECK (paid_amount_pkr >= 0),
  due_amount_pkr numeric(18, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'partial', 'paid', 'void')),
  journal_entry_id uuid NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  linked_purchase_id uuid NULL REFERENCES public.purchases(id) ON DELETE SET NULL,
  document_no text NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fx_currency_purchases_paid_le_amount
    CHECK (paid_amount_pkr <= amount_pkr + 0.009)
);

CREATE INDEX IF NOT EXISTS idx_fx_currency_purchases_company_status
  ON public.fx_currency_purchases (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fx_currency_purchases_agent
  ON public.fx_currency_purchases (company_id, agent_contact_id);

CREATE TABLE IF NOT EXISTS public.fx_currency_purchase_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fx_currency_purchase_id uuid NOT NULL
    REFERENCES public.fx_currency_purchases(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  amount_pkr numeric(18, 2) NOT NULL CHECK (amount_pkr > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fx_currency_purchase_id, payment_id)
);

ALTER TABLE public.fx_currency_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_currency_purchase_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fx_currency_purchases_company ON public.fx_currency_purchases;
CREATE POLICY fx_currency_purchases_company
  ON public.fx_currency_purchases
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS fx_currency_purchase_settlements_company ON public.fx_currency_purchase_settlements;
CREATE POLICY fx_currency_purchase_settlements_company
  ON public.fx_currency_purchase_settlements
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_currency_purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_currency_purchase_settlements TO authenticated;
GRANT ALL ON public.fx_currency_purchases TO service_role;
GRANT ALL ON public.fx_currency_purchase_settlements TO service_role;

