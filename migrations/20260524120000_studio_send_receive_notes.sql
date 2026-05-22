-- Studio: send/receive notes on workflow RPCs; customer_charge on stages; confirm payment stores customer_charge.
-- Additive only.

ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS customer_charge NUMERIC(15,2) NULL;

COMMENT ON COLUMN studio_production_stages.customer_charge IS 'Per-stage amount charged to customer (set at worker settlement).';

-- ---------------------------------------------------------------------------
-- Append [Send]: fragment (client fallback)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_append_send_notes_fragment(
  p_stage_id UUID,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing TEXT;
BEGIN
  IF NULLIF(TRIM(COALESCE(p_notes, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  SELECT s.notes INTO v_existing FROM studio_production_stages s WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;
  UPDATE studio_production_stages s
  SET notes = CASE
    WHEN NULLIF(TRIM(COALESCE(v_existing, '')), '') IS NULL THEN '[Send]: ' || TRIM(p_notes)
    ELSE TRIM(v_existing) || E'\n[Send]: ' || TRIM(p_notes)
  END
  WHERE s.id = p_stage_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION rpc_append_send_notes_fragment(UUID, TEXT) IS 'Appends [Send]: line to stage notes.';

-- ---------------------------------------------------------------------------
-- Send to worker: optional sent_date + notes
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS rpc_send_to_worker(UUID);
DROP FUNCTION IF EXISTS rpc_send_to_worker(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION rpc_send_to_worker(
  p_stage_id UUID,
  p_sent_date TIMESTAMPTZ DEFAULT NOW(),
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
  v_sent TIMESTAMPTZ;
  v_notes_merged TEXT;
BEGIN
  IF p_sent_date IS NOT NULL AND p_sent_date > (NOW() + INTERVAL '1 day') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sent date cannot be more than one day in the future');
  END IF;

  SELECT s.* INTO v_stage FROM studio_production_stages s WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;
  IF v_stage.status != 'assigned' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only assigned stages can be sent to worker');
  END IF;
  IF v_stage.assigned_worker_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Assign a worker first');
  END IF;

  v_sent := COALESCE(p_sent_date, NOW());

  IF NULLIF(TRIM(COALESCE(p_notes, '')), '') IS NULL THEN
    v_notes_merged := v_stage.notes;
  ELSIF NULLIF(TRIM(COALESCE(v_stage.notes, '')), '') IS NULL THEN
    v_notes_merged := '[Send]: ' || TRIM(p_notes);
  ELSE
    v_notes_merged := TRIM(v_stage.notes) || E'\n[Send]: ' || TRIM(p_notes);
  END IF;

  UPDATE studio_production_stages
  SET status = 'sent_to_worker', sent_date = v_sent, notes = v_notes_merged
  WHERE id = p_stage_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION rpc_send_to_worker(UUID, TIMESTAMPTZ, TEXT) IS 'Mark stage sent; optional p_sent_date and p_notes appended as [Send]:.';

-- ---------------------------------------------------------------------------
-- Receive work: optional received_date + notes
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS rpc_receive_work(UUID);
DROP FUNCTION IF EXISTS rpc_receive_work(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION rpc_receive_work(
  p_stage_id UUID,
  p_received_date TIMESTAMPTZ DEFAULT NOW(),
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
  v_recv TIMESTAMPTZ;
  v_notes_merged TEXT;
BEGIN
  IF p_received_date IS NOT NULL AND p_received_date > (NOW() + INTERVAL '1 day') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Received date cannot be more than one day in the future');
  END IF;

  SELECT s.* INTO v_stage FROM studio_production_stages s WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;
  IF v_stage.status != 'sent_to_worker' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only stages sent to worker can be received');
  END IF;

  v_recv := COALESCE(p_received_date, NOW());

  IF NULLIF(TRIM(COALESCE(p_notes, '')), '') IS NULL THEN
    v_notes_merged := v_stage.notes;
  ELSIF NULLIF(TRIM(COALESCE(v_stage.notes, '')), '') IS NULL THEN
    v_notes_merged := '[Receive]: ' || TRIM(p_notes);
  ELSE
    v_notes_merged := TRIM(v_stage.notes) || E'\n[Receive]: ' || TRIM(p_notes);
  END IF;

  UPDATE studio_production_stages
  SET status = 'received', received_date = v_recv, notes = v_notes_merged
  WHERE id = p_stage_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION rpc_receive_work(UUID, TIMESTAMPTZ, TEXT) IS 'Mark work received; optional p_received_date and p_notes appended as [Receive]:.';

-- ---------------------------------------------------------------------------
-- Confirm stage payment: optional customer_charge
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS rpc_confirm_stage_payment(UUID, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS rpc_confirm_stage_payment(UUID, NUMERIC, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS rpc_confirm_stage_payment(UUID, NUMERIC, BOOLEAN, UUID, TEXT);

CREATE OR REPLACE FUNCTION rpc_confirm_stage_payment(
  p_stage_id UUID,
  p_final_cost NUMERIC,
  p_pay_now BOOLEAN DEFAULT false,
  p_payment_account_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_customer_charge NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
  v_worker_label TEXT;
  v_cost_account_id UUID;
  v_payable_account_id UUID;
  v_cash_account_id UUID;
  v_journal_id UUID;
  v_entry_no TEXT;
  v_notes_merged TEXT;
BEGIN
  SELECT s.*, p.company_id, p.branch_id, p.production_no,
    COALESCE(w.name, c.name, '') AS worker_display_name
  INTO v_stage
  FROM studio_production_stages s
  JOIN studio_productions p ON p.id = s.production_id
  LEFT JOIN workers w ON w.id = s.assigned_worker_id
  LEFT JOIN contacts c ON c.id = s.assigned_worker_id AND w.id IS NULL
  WHERE s.id = p_stage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;

  v_worker_label := NULLIF(TRIM(COALESCE(v_stage.worker_display_name, '')), '');

  IF v_stage.status != 'received' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only received stages can confirm payment');
  END IF;

  IF p_final_cost <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Final cost must be greater than 0');
  END IF;

  IF v_stage.assigned_worker_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage has no worker');
  END IF;

  IF NULLIF(TRIM(COALESCE(p_notes, '')), '') IS NULL THEN
    v_notes_merged := v_stage.notes;
  ELSIF NULLIF(TRIM(COALESCE(v_stage.notes, '')), '') IS NULL THEN
    v_notes_merged := '[Payment Remarks]: ' || TRIM(p_notes);
  ELSE
    v_notes_merged := TRIM(v_stage.notes) || E'\n[Payment Remarks]: ' || TRIM(p_notes);
  END IF;

  SELECT id INTO v_cost_account_id FROM accounts
  WHERE company_id = v_stage.company_id AND code = '5000' AND is_active = true LIMIT 1;
  SELECT id INTO v_payable_account_id FROM accounts
  WHERE company_id = v_stage.company_id AND code = '2010' AND is_active = true LIMIT 1;

  IF p_pay_now THEN
    IF p_payment_account_id IS NOT NULL THEN
      SELECT a.id INTO v_cash_account_id
      FROM accounts a
      WHERE a.id = p_payment_account_id
        AND a.company_id = v_stage.company_id
        AND a.is_active = true
        AND COALESCE(a.is_group, false) = false
        AND a.type IN ('cash', 'bank', 'asset', 'mobile_wallet')
      LIMIT 1;
      IF v_cash_account_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Invalid payment account for this company');
      END IF;
    ELSE
      SELECT id INTO v_cash_account_id FROM accounts
      WHERE company_id = v_stage.company_id AND (code = '1000' OR code LIKE '100%') AND is_active = true
      ORDER BY code LIMIT 1;
      IF v_cash_account_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Cash account (1000) not found. Configure chart of accounts.');
      END IF;
    END IF;
  END IF;

  IF v_cost_account_id IS NULL OR v_payable_account_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Accounts 5000 or 2010 not found. Configure chart of accounts.');
  END IF;

  IF p_pay_now THEN
    v_entry_no := 'JE-STD-PAY-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
    INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual)
    VALUES (
      v_stage.company_id, v_stage.branch_id, v_entry_no, CURRENT_DATE,
      'Studio ' || v_stage.production_no || ' – ' || v_stage.stage_type ||
        CASE WHEN v_worker_label IS NOT NULL THEN ' – ' || v_worker_label ELSE '' END || ' (Pay Now)',
      'studio_production_stage', p_stage_id, p_final_cost, p_final_cost, true, NOW(), false
    )
    RETURNING id INTO v_journal_id;
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES
      (v_journal_id, v_cost_account_id, p_final_cost, 0,
        'Production cost – ' || v_stage.stage_type ||
        CASE WHEN v_worker_label IS NOT NULL THEN ' – ' || v_worker_label ELSE '' END),
      (v_journal_id, v_cash_account_id, 0, p_final_cost,
        'Worker payment – ' || v_stage.stage_type ||
        CASE WHEN v_worker_label IS NOT NULL THEN ' – ' || v_worker_label ELSE '' END);

    INSERT INTO worker_ledger_entries (company_id, worker_id, amount, reference_type, reference_id, notes, status, paid_at)
    VALUES (v_stage.company_id, v_stage.assigned_worker_id, p_final_cost, 'studio_production_stage', p_stage_id,
      'Studio ' || v_stage.production_no ||
        CASE WHEN v_worker_label IS NOT NULL THEN ' – ' || v_worker_label ELSE '' END || ' – paid',
      'paid', NOW());
  ELSE
    v_entry_no := 'JE-STD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
    INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual)
    VALUES (
      v_stage.company_id, v_stage.branch_id, v_entry_no, CURRENT_DATE,
      'Studio ' || v_stage.production_no || ' – ' || v_stage.stage_type ||
        CASE WHEN v_worker_label IS NOT NULL THEN ' – ' || v_worker_label ELSE '' END || ' stage',
      'studio_production_stage', p_stage_id, p_final_cost, p_final_cost, true, NOW(), false
    )
    RETURNING id INTO v_journal_id;
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES
      (v_journal_id, v_cost_account_id, p_final_cost, 0,
        'Production cost – ' || v_stage.stage_type ||
        CASE WHEN v_worker_label IS NOT NULL THEN ' – ' || v_worker_label ELSE '' END),
      (v_journal_id, v_payable_account_id, 0, p_final_cost,
        'Worker payable – ' || v_stage.stage_type ||
        CASE WHEN v_worker_label IS NOT NULL THEN ' – ' || v_worker_label ELSE '' END);

    INSERT INTO worker_ledger_entries (company_id, worker_id, amount, reference_type, reference_id, notes, status)
    VALUES (v_stage.company_id, v_stage.assigned_worker_id, p_final_cost, 'studio_production_stage', p_stage_id,
      'Studio ' || v_stage.production_no ||
        CASE WHEN v_worker_label IS NOT NULL THEN ' – ' || v_worker_label ELSE '' END || ' – stage',
      'unpaid');
  END IF;

  UPDATE studio_production_stages
  SET
    cost = p_final_cost,
    journal_entry_id = v_journal_id,
    notes = v_notes_merged,
    customer_charge = CASE
      WHEN p_customer_charge IS NOT NULL AND p_customer_charge > 0 THEN p_customer_charge
      ELSE customer_charge
    END
  WHERE id = p_stage_id;

  RETURN jsonb_build_object('ok', true, 'journal_entry_id', v_journal_id);
END;
$$;

COMMENT ON FUNCTION rpc_confirm_stage_payment(UUID, NUMERIC, BOOLEAN, UUID, TEXT, NUMERIC) IS
  'Confirm payment on received stage; optional p_notes and p_customer_charge.';
