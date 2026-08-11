-- Wave 0 Path 21 correctness: Step-1 client_operation_id idempotency,
-- settlement link lifecycle (no DELETE), active-only paid totals,
-- import_fx_client_operations receipts for Step 2/3 retries.
-- Additive only. Does not change Path 21 Dr wallet / Cr Agent AP meaning.
-- Does not touch pooled P1–P5 tables or Phase-3 FX accounts.

-- ---------------------------------------------------------------------------
-- A) fx_currency_purchases.client_operation_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.fx_currency_purchases
  ADD COLUMN IF NOT EXISTS client_operation_id uuid;

COMMENT ON COLUMN public.fx_currency_purchases.client_operation_id IS
  'Wave 0: client UUID for Step-1 idempotency; historical rows remain NULL';

CREATE UNIQUE INDEX IF NOT EXISTS uq_fx_currency_purchases_company_client_op
  ON public.fx_currency_purchases (company_id, client_operation_id)
  WHERE client_operation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- B) Settlement link lifecycle (orphan-safe; no physical deletes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.fx_currency_purchase_settlements
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_reason text,
  ADD COLUMN IF NOT EXISTS void_source text,
  ADD COLUMN IF NOT EXISTS client_operation_id uuid;

ALTER TABLE public.fx_currency_purchase_settlements
  DROP CONSTRAINT IF EXISTS fx_currency_purchase_settlements_status_check;

ALTER TABLE public.fx_currency_purchase_settlements
  ADD CONSTRAINT fx_currency_purchase_settlements_status_check
  CHECK (status IN ('active', 'inactive'));

COMMENT ON COLUMN public.fx_currency_purchase_settlements.status IS
  'active = counts toward FX credit paid/due; inactive = voided/orphan (retained for audit)';
COMMENT ON COLUMN public.fx_currency_purchase_settlements.void_source IS
  'payment_void | credit_void | backfill_wave0 | manual_reconcile';

CREATE UNIQUE INDEX IF NOT EXISTS uq_fx_settle_company_client_op
  ON public.fx_currency_purchase_settlements (company_id, client_operation_id)
  WHERE client_operation_id IS NOT NULL;

-- Deterministic backfill: voided payment or void FX credit → inactive (idempotent)
UPDATE public.fx_currency_purchase_settlements s
SET
  status = 'inactive',
  voided_at = COALESCE(s.voided_at, COALESCE(p.voided_at, f.updated_at, now())),
  voided_reason = COALESCE(
    s.voided_reason,
    CASE
      WHEN p.voided_at IS NOT NULL THEN 'payment voided'
      WHEN f.status = 'void' THEN 'fx credit voided'
      ELSE 'wave0 orphan reconcile'
    END
  ),
  void_source = COALESCE(s.void_source, 'backfill_wave0')
FROM public.fx_currency_purchases f,
     public.payments p
WHERE s.fx_currency_purchase_id = f.id
  AND p.id = s.payment_id
  AND s.status = 'active'
  AND (p.voided_at IS NOT NULL OR f.status = 'void');

-- ---------------------------------------------------------------------------
-- C) Client operation receipts (Step 2 / Step 3 retry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_fx_client_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  client_operation_id uuid NOT NULL,
  fx_currency_purchase_id uuid NULL,
  payment_id uuid NULL,
  journal_entry_id uuid NULL,
  purchase_id uuid NULL,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_fx_client_operations_event_type_check
    CHECK (event_type IN ('fx_credit', 'agent_settle', 'china_settle'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_fx_client_ops_company_event_op
  ON public.import_fx_client_operations (company_id, event_type, client_operation_id);

CREATE INDEX IF NOT EXISTS idx_import_fx_client_ops_company_created
  ON public.import_fx_client_operations (company_id, created_at DESC);

ALTER TABLE public.import_fx_client_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_fx_client_operations_select_company ON public.import_fx_client_operations;
CREATE POLICY import_fx_client_operations_select_company
  ON public.import_fx_client_operations
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- Writes go through SECURITY DEFINER RPCs only
REVOKE INSERT, UPDATE, DELETE ON public.import_fx_client_operations FROM authenticated;
GRANT SELECT ON public.import_fx_client_operations TO authenticated;
GRANT ALL ON public.import_fx_client_operations TO service_role;

COMMENT ON TABLE public.import_fx_client_operations IS
  'Wave 0 Path 21: idempotent receipts for credit/agent-settle/china-settle retries';

-- ---------------------------------------------------------------------------
-- D) Helpers: mark settlements inactive + recompute paid from active only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._recompute_fx_currency_purchase_paid_from_active(
  p_fx_currency_purchase_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.fx_currency_purchases%ROWTYPE;
  v_paid numeric(18, 2);
  v_due numeric(18, 2);
  v_status text;
BEGIN
  SELECT * INTO v_row
  FROM public.fx_currency_purchases
  WHERE id = p_fx_currency_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF v_row.status = 'void' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount_pkr), 0) INTO v_paid
  FROM public.fx_currency_purchase_settlements
  WHERE fx_currency_purchase_id = p_fx_currency_purchase_id
    AND status = 'active'
    AND voided_at IS NULL;

  v_due := GREATEST(0, round(v_row.amount_pkr - v_paid, 2));
  IF v_paid <= 0.009 THEN
    v_status := 'open';
  ELSIF v_due <= 0.009 THEN
    v_status := 'paid';
  ELSE
    v_status := 'partial';
  END IF;

  UPDATE public.fx_currency_purchases
  SET
    paid_amount_pkr = v_paid,
    due_amount_pkr = v_due,
    status = v_status,
    updated_at = now()
  WHERE id = p_fx_currency_purchase_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_fx_currency_purchase_settlements_inactive(
  p_company_id uuid,
  p_fx_currency_purchase_id uuid DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_void_source text DEFAULT 'manual_reconcile'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
  v_credit_id uuid;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.fx_currency_purchase_settlements s
  SET
    status = 'inactive',
    voided_at = COALESCE(s.voided_at, now()),
    voided_reason = COALESCE(s.voided_reason, COALESCE(p_reason, 'settlement inactivated')),
    void_source = COALESCE(s.void_source, p_void_source)
  WHERE s.company_id = p_company_id
    AND s.status = 'active'
    AND (
      (p_fx_currency_purchase_id IS NOT NULL AND s.fx_currency_purchase_id = p_fx_currency_purchase_id)
      OR (p_payment_id IS NOT NULL AND s.payment_id = p_payment_id)
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  FOR v_credit_id IN
    SELECT DISTINCT s.fx_currency_purchase_id
    FROM public.fx_currency_purchase_settlements s
    WHERE s.company_id = p_company_id
      AND (
        (p_fx_currency_purchase_id IS NOT NULL AND s.fx_currency_purchase_id = p_fx_currency_purchase_id)
        OR (p_payment_id IS NOT NULL AND s.payment_id = p_payment_id)
      )
  LOOP
    PERFORM public._recompute_fx_currency_purchase_paid_from_active(v_credit_id);
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_fx_currency_purchase_settlements_inactive(uuid, uuid, uuid, text, text)
  TO authenticated, service_role;

-- When a payment is voided, inactivate linked FX settlements (audit retained)
CREATE OR REPLACE FUNCTION public._trg_fx_settle_inactive_on_payment_void()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN
    PERFORM public.mark_fx_currency_purchase_settlements_inactive(
      NEW.company_id,
      NULL,
      NEW.id,
      COALESCE(NEW.voided_reason, 'payment voided'),
      'payment_void'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fx_settle_inactive_on_payment_void ON public.payments;
CREATE TRIGGER trg_fx_settle_inactive_on_payment_void
  AFTER UPDATE OF voided_at ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_fx_settle_inactive_on_payment_void();

-- ---------------------------------------------------------------------------
-- E) record_fx_currency_purchase_on_credit — idempotent Step 1
-- Drop prior 10-arg overload then create 11-arg with DEFAULT NULL (no ambiguity).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_fx_currency_purchase_on_credit(
  uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid
);

CREATE OR REPLACE FUNCTION public.record_fx_currency_purchase_on_credit(
  p_company_id uuid,
  p_branch_id uuid,
  p_agent_contact_id uuid,
  p_wallet_account_id uuid,
  p_document_currency text,
  p_foreign_amount numeric,
  p_fx_rate_to_base numeric,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_linked_purchase_id uuid DEFAULT NULL,
  p_client_operation_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
  v_agent RECORD;
  v_purchase RECORD;
  v_ap_id uuid;
  v_amount_pkr numeric(18, 2);
  v_currency text;
  v_credit_id uuid;
  v_je_id uuid;
  v_entry_no text;
  v_doc_no text;
  v_branch uuid;
  v_existing public.fx_currency_purchases%ROWTYPE;
BEGIN
  IF p_company_id IS NULL OR p_agent_contact_id IS NULL OR p_wallet_account_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'company, agent, and wallet are required');
  END IF;

  -- Idempotency: return prior result before any JE (same company + key)
  IF p_client_operation_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.fx_currency_purchases
    WHERE company_id = p_company_id
      AND client_operation_id = p_client_operation_id
    LIMIT 1;

    IF FOUND THEN
      RETURN json_build_object(
        'success', true,
        'idempotent_replay', true,
        'fx_currency_purchase_id', v_existing.id,
        'journal_entry_id', v_existing.journal_entry_id,
        'entry_no', v_existing.document_no,
        'amount_pkr', v_existing.amount_pkr,
        'due_amount_pkr', v_existing.due_amount_pkr
      );
    END IF;
  END IF;

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RETURN json_build_object(
      'success', false,
      'code', 'MULTI_CURRENCY_DISABLED',
      'error', 'MULTI_CURRENCY_DISABLED: Import FX requires Multi Currency Enabled in Settings'
    );
  END IF;

  IF COALESCE(p_foreign_amount, 0) <= 0 OR COALESCE(p_fx_rate_to_base, 0) <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'foreign_amount and fx_rate_to_base must be > 0');
  END IF;

  v_currency := public._normalize_import_fx_currency(p_document_currency);
  IF v_currency = '' OR v_currency = 'PKR' THEN
    RETURN json_build_object(
      'success', false,
      'code', 'IMPORT_FX_CURRENCY_NOT_ACTIVE',
      'error', 'IMPORT_FX_CURRENCY_NOT_ACTIVE: FX credit purchase requires a foreign document currency'
    );
  END IF;
  IF NOT public._company_import_fx_currency_allowed(p_company_id, v_currency) THEN
    RETURN json_build_object(
      'success', false,
      'code', 'IMPORT_FX_CURRENCY_NOT_ACTIVE',
      'error', format(
        'IMPORT_FX_CURRENCY_NOT_ACTIVE: %s is not in activeCurrencies',
        v_currency
      )
    );
  END IF;

  v_amount_pkr := round(p_foreign_amount * p_fx_rate_to_base, 2);
  IF v_amount_pkr <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'computed amount_pkr must be > 0');
  END IF;

  SELECT id, code, name, type::text AS type, company_id, COALESCE(is_active, true) AS is_active
  INTO v_wallet
  FROM accounts
  WHERE id = p_wallet_account_id AND company_id = p_company_id
  LIMIT 1;

  IF v_wallet.id IS NULL OR NOT v_wallet.is_active THEN
    RETURN json_build_object('success', false, 'error', 'wallet account not found');
  END IF;
  IF NOT public._is_tt_agent_wallet_account(v_wallet.code, v_wallet.name) THEN
    RETURN json_build_object('success', false, 'error', 'wallet must be a TT-agent 12xx wallet account');
  END IF;

  SELECT id, name, type::text AS type, company_id, COALESCE(is_active, true) AS is_active
  INTO v_agent
  FROM contacts
  WHERE id = p_agent_contact_id AND company_id = p_company_id
  LIMIT 1;

  IF v_agent.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'agent contact not found');
  END IF;
  IF COALESCE(v_agent.is_active, true) IS NOT TRUE THEN
    RETURN json_build_object(
      'success', false,
      'code', 'IMPORT_FX_AGENT_ROLE_INVALID',
      'error', 'IMPORT_FX_AGENT_ROLE_INVALID: agent contact is inactive'
    );
  END IF;
  IF lower(trim(COALESCE(v_agent.type, ''))) <> 'money_exchange' THEN
    RETURN json_build_object(
      'success', false,
      'code', 'IMPORT_FX_AGENT_ROLE_INVALID',
      'error', 'IMPORT_FX_AGENT_ROLE_INVALID: agent contact type must be money_exchange'
    );
  END IF;

  IF p_linked_purchase_id IS NOT NULL THEN
    SELECT id, supplier_id
    INTO v_purchase
    FROM purchases
    WHERE id = p_linked_purchase_id AND company_id = p_company_id
    LIMIT 1;

    IF v_purchase.id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'linked purchase not found');
    END IF;
    IF v_purchase.supplier_id IS NOT NULL
       AND v_purchase.supplier_id = p_agent_contact_id THEN
      RETURN json_build_object(
        'success', false,
        'code', 'IMPORT_FX_AGENT_SAME_AS_SUPPLIER',
        'error', 'IMPORT_FX_AGENT_SAME_AS_SUPPLIER: The money-exchange agent cannot be the same party as the purchase supplier.'
      );
    END IF;
  END IF;

  v_ap_id := public._ensure_ap_subaccount_for_contact(p_company_id, p_agent_contact_id);
  IF v_ap_id IS NULL OR public._is_account_control_code(v_ap_id, '2000') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Could not resolve Agent AP sub-ledger under 2000'
    );
  END IF;

  v_branch := p_branch_id;

  BEGIN
    v_entry_no := public.generate_document_number(
      p_company_id,
      public.erp_numbering_global_branch_sentinel(),
      'manual_journal',
      false
    );
  EXCEPTION WHEN OTHERS THEN
    v_entry_no := 'FXC-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || floor(random() * 1000)::text;
  END;
  v_doc_no := v_entry_no;

  BEGIN
    INSERT INTO public.fx_currency_purchases (
      company_id, branch_id, agent_contact_id, wallet_account_id,
      document_currency, foreign_amount, fx_rate_to_base, amount_pkr,
      paid_amount_pkr, due_amount_pkr, status, linked_purchase_id,
      document_no, notes, created_by, client_operation_id
    )
    VALUES (
      p_company_id, v_branch, p_agent_contact_id, p_wallet_account_id,
      v_currency, p_foreign_amount, p_fx_rate_to_base, v_amount_pkr,
      0, v_amount_pkr, 'open', p_linked_purchase_id,
      v_doc_no, p_notes, p_created_by, p_client_operation_id
    )
    RETURNING id INTO v_credit_id;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent retry raced the unique index
    SELECT * INTO v_existing
    FROM public.fx_currency_purchases
    WHERE company_id = p_company_id
      AND client_operation_id = p_client_operation_id
    LIMIT 1;
    IF FOUND THEN
      RETURN json_build_object(
        'success', true,
        'idempotent_replay', true,
        'fx_currency_purchase_id', v_existing.id,
        'journal_entry_id', v_existing.journal_entry_id,
        'entry_no', v_existing.document_no,
        'amount_pkr', v_existing.amount_pkr,
        'due_amount_pkr', v_existing.due_amount_pkr
      );
    END IF;
    RAISE;
  END;

  INSERT INTO public.journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, document_no,
    total_debit, total_credit
  )
  VALUES (
    p_company_id,
    v_branch,
    v_entry_no,
    CURRENT_DATE,
    format(
      'FX credit purchase %s %s @ %s → PKR %s (agent %s)',
      v_currency,
      trim(to_char(p_foreign_amount, 'FM999999999990.00')),
      trim(to_char(p_fx_rate_to_base, 'FM999999999990.########')),
      trim(to_char(v_amount_pkr, 'FM999999999990.00')),
      COALESCE(v_agent.name, 'agent')
    ),
    'fx_currency_purchase',
    v_credit_id,
    p_created_by,
    v_doc_no,
    v_amount_pkr,
    v_amount_pkr
  )
  RETURNING id INTO v_je_id;

  INSERT INTO public.journal_entry_lines (
    journal_entry_id, account_id, debit, credit, description
  )
  VALUES
    (
      v_je_id, p_wallet_account_id, v_amount_pkr, 0,
      'FC wallet funded (credit purchase)'
    ),
    (
      v_je_id, v_ap_id, 0, v_amount_pkr,
      'Agent payable for FC credit purchase'
    );

  UPDATE public.fx_currency_purchases
  SET journal_entry_id = v_je_id, updated_at = now()
  WHERE id = v_credit_id;

  IF p_client_operation_id IS NOT NULL THEN
    INSERT INTO public.import_fx_client_operations (
      company_id, event_type, client_operation_id,
      fx_currency_purchase_id, journal_entry_id, result_json
    )
    VALUES (
      p_company_id, 'fx_credit', p_client_operation_id,
      v_credit_id, v_je_id,
      json_build_object(
        'fx_currency_purchase_id', v_credit_id,
        'journal_entry_id', v_je_id,
        'entry_no', v_entry_no,
        'amount_pkr', v_amount_pkr
      )::jsonb
    )
    ON CONFLICT (company_id, event_type, client_operation_id) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'success', true,
    'idempotent_replay', false,
    'fx_currency_purchase_id', v_credit_id,
    'journal_entry_id', v_je_id,
    'entry_no', v_entry_no,
    'amount_pkr', v_amount_pkr,
    'due_amount_pkr', v_amount_pkr
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_fx_currency_purchase_on_credit IS
  'Path 21 Wave 0: Dr TT wallet / Cr Agent AP. Optional p_client_operation_id for idempotent retry. money_exchange-only agent.';

GRANT EXECUTE ON FUNCTION public.record_fx_currency_purchase_on_credit(
  uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fx_currency_purchase_on_credit(
  uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- F) apply_fx_currency_purchase_settlement — active-only sums + client_op
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.apply_fx_currency_purchase_settlement(uuid, uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION public.apply_fx_currency_purchase_settlement(
  p_company_id uuid,
  p_fx_currency_purchase_id uuid,
  p_payment_id uuid,
  p_amount_pkr numeric,
  p_client_operation_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.fx_currency_purchases%ROWTYPE;
  v_pay RECORD;
  v_amt numeric(18, 2);
  v_paid numeric(18, 2);
  v_due numeric(18, 2);
  v_status text;
  v_prior jsonb;
  v_settle_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_fx_currency_purchase_id IS NULL OR p_payment_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'company, credit id, and payment id required');
  END IF;

  IF p_client_operation_id IS NOT NULL THEN
    SELECT result_json INTO v_prior
    FROM public.import_fx_client_operations
    WHERE company_id = p_company_id
      AND event_type = 'agent_settle'
      AND client_operation_id = p_client_operation_id
    LIMIT 1;
    IF v_prior IS NOT NULL THEN
      RETURN (v_prior || jsonb_build_object('success', true, 'idempotent_replay', true))::json;
    END IF;
  END IF;

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RETURN json_build_object(
      'success', false,
      'code', 'MULTI_CURRENCY_DISABLED',
      'error', 'MULTI_CURRENCY_DISABLED: Import FX requires Multi Currency Enabled in Settings'
    );
  END IF;

  v_amt := round(COALESCE(p_amount_pkr, 0), 2);
  IF v_amt <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'amount_pkr must be > 0');
  END IF;

  SELECT * INTO v_row
  FROM public.fx_currency_purchases
  WHERE id = p_fx_currency_purchase_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'fx_currency_purchase not found');
  END IF;
  IF v_row.status = 'void' THEN
    RETURN json_build_object('success', false, 'error', 'fx_currency_purchase is void');
  END IF;

  SELECT id, company_id, contact_id, amount, payment_type::text AS payment_type, voided_at
  INTO v_pay
  FROM payments
  WHERE id = p_payment_id AND company_id = p_company_id
  LIMIT 1;

  IF v_pay.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'payment not found');
  END IF;
  IF v_pay.voided_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'payment is voided');
  END IF;
  IF lower(COALESCE(v_pay.payment_type, '')) <> 'paid' THEN
    RETURN json_build_object('success', false, 'error', 'settlement payment must be paid');
  END IF;
  IF v_pay.contact_id IS DISTINCT FROM v_row.agent_contact_id THEN
    RETURN json_build_object('success', false, 'error', 'payment contact must match agent');
  END IF;
  IF v_amt > round(COALESCE(v_row.due_amount_pkr, 0), 2) + 0.009 THEN
    RETURN json_build_object('success', false, 'error', 'amount exceeds remaining due');
  END IF;

  INSERT INTO public.fx_currency_purchase_settlements (
    company_id, fx_currency_purchase_id, payment_id, amount_pkr,
    status, client_operation_id
  )
  VALUES (
    p_company_id, p_fx_currency_purchase_id, p_payment_id, v_amt,
    'active', p_client_operation_id
  )
  ON CONFLICT (fx_currency_purchase_id, payment_id) DO NOTHING
  RETURNING id INTO v_settle_id;

  PERFORM public._recompute_fx_currency_purchase_paid_from_active(p_fx_currency_purchase_id);

  SELECT paid_amount_pkr, due_amount_pkr, status
  INTO v_paid, v_due, v_status
  FROM public.fx_currency_purchases
  WHERE id = p_fx_currency_purchase_id;

  IF p_client_operation_id IS NOT NULL THEN
    INSERT INTO public.import_fx_client_operations (
      company_id, event_type, client_operation_id,
      fx_currency_purchase_id, payment_id, result_json
    )
    VALUES (
      p_company_id, 'agent_settle', p_client_operation_id,
      p_fx_currency_purchase_id, p_payment_id,
      jsonb_build_object(
        'success', true,
        'fx_currency_purchase_id', p_fx_currency_purchase_id,
        'payment_id', p_payment_id,
        'paid_amount_pkr', v_paid,
        'due_amount_pkr', v_due,
        'status', v_status
      )
    )
    ON CONFLICT (company_id, event_type, client_operation_id) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'success', true,
    'idempotent_replay', false,
    'fx_currency_purchase_id', p_fx_currency_purchase_id,
    'paid_amount_pkr', v_paid,
    'due_amount_pkr', v_due,
    'status', v_status
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.apply_fx_currency_purchase_settlement IS
  'Wave 0: allocate agent PAY to FX credit; active settlements only; optional client_operation_id replay.';

GRANT EXECUTE ON FUNCTION public.apply_fx_currency_purchase_settlement(uuid, uuid, uuid, numeric, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_fx_currency_purchase_settlement(uuid, uuid, uuid, numeric, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- G) Register china_settle / generic client operation receipt (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_import_fx_client_operation(
  p_company_id uuid,
  p_event_type text,
  p_client_operation_id uuid,
  p_result_json jsonb,
  p_fx_currency_purchase_id uuid DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL,
  p_journal_entry_id uuid DEFAULT NULL,
  p_purchase_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing jsonb;
BEGIN
  IF p_company_id IS NULL OR p_client_operation_id IS NULL OR p_event_type IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'company, event_type, and client_operation_id required');
  END IF;
  IF p_event_type NOT IN ('fx_credit', 'agent_settle', 'china_settle') THEN
    RETURN json_build_object('success', false, 'error', 'invalid event_type');
  END IF;

  SELECT result_json INTO v_existing
  FROM public.import_fx_client_operations
  WHERE company_id = p_company_id
    AND event_type = p_event_type
    AND client_operation_id = p_client_operation_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('success', true, 'idempotent_replay', true, 'result', v_existing);
  END IF;

  INSERT INTO public.import_fx_client_operations (
    company_id, event_type, client_operation_id,
    fx_currency_purchase_id, payment_id, journal_entry_id, purchase_id, result_json
  )
  VALUES (
    p_company_id, p_event_type, p_client_operation_id,
    p_fx_currency_purchase_id, p_payment_id, p_journal_entry_id, p_purchase_id,
    COALESCE(p_result_json, '{}'::jsonb)
  );

  RETURN json_build_object('success', true, 'idempotent_replay', false);
EXCEPTION WHEN unique_violation THEN
  SELECT result_json INTO v_existing
  FROM public.import_fx_client_operations
  WHERE company_id = p_company_id
    AND event_type = p_event_type
    AND client_operation_id = p_client_operation_id
  LIMIT 1;
  RETURN json_build_object('success', true, 'idempotent_replay', true, 'result', v_existing);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_import_fx_client_operation(
  uuid, text, uuid, jsonb, uuid, uuid, uuid, uuid
) TO authenticated, service_role;
