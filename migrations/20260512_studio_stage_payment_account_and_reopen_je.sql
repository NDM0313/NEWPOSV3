-- Studio stage Pay Now: optional explicit liquidity account (sub-account); reopen reversal uses original JE credit line.

-- Remove legacy overloads so CREATE OR REPLACE / COMMENT are unambiguous (Postgres 42725).
DROP FUNCTION IF EXISTS rpc_confirm_stage_payment(UUID, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS rpc_confirm_stage_payment(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION rpc_confirm_stage_payment(
  p_stage_id UUID,
  p_final_cost NUMERIC,
  p_pay_now BOOLEAN DEFAULT false,
  p_payment_account_id UUID DEFAULT NULL
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
  SET cost = p_final_cost, journal_entry_id = v_journal_id
  WHERE id = p_stage_id;

  RETURN jsonb_build_object('ok', true, 'journal_entry_id', v_journal_id);
END;
$$;

COMMENT ON FUNCTION rpc_confirm_stage_payment(UUID, NUMERIC, BOOLEAN, UUID) IS 'Confirm cost and Pay Now (Dr 5000 Cr liquidity) or Pay Later (Dr 5000 Cr 2010). Optional p_payment_account_id selects leaf liquidity account when p_pay_now.';

CREATE OR REPLACE FUNCTION rpc_reopen_stage(p_stage_id UUID)
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
  v_counterparty_account_id UUID;
  v_reversal_journal_id UUID;
  v_entry_no TEXT;
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

  IF v_stage.status != 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only completed stages can be reopened');
  END IF;

  IF v_stage.journal_entry_id IS NOT NULL AND v_stage.cost > 0 THEN
    SELECT jel.account_id INTO v_counterparty_account_id
    FROM journal_entry_lines jel
    JOIN accounts a ON a.id = jel.account_id AND a.company_id = v_stage.company_id
    WHERE jel.journal_entry_id = v_stage.journal_entry_id
      AND jel.credit > 0
    LIMIT 1;

    SELECT id INTO v_cost_account_id FROM accounts
    WHERE company_id = v_stage.company_id AND code = '5000' AND is_active = true LIMIT 1;
    SELECT id INTO v_payable_account_id FROM accounts
    WHERE company_id = v_stage.company_id AND code = '2010' AND is_active = true LIMIT 1;
    SELECT id INTO v_cash_account_id FROM accounts
    WHERE company_id = v_stage.company_id AND (code = '1000' OR code LIKE '100%') AND is_active = true
    ORDER BY code LIMIT 1;

    IF v_cost_account_id IS NOT NULL THEN
      IF v_counterparty_account_id IS NOT NULL THEN
        v_entry_no := 'JE-STD-REV-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
        INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual)
        VALUES (
          v_stage.company_id, v_stage.branch_id, v_entry_no, CURRENT_DATE,
          'Reversal: Studio ' || v_stage.production_no || ' – ' || v_stage.stage_type ||
            CASE WHEN v_worker_label IS NOT NULL THEN ' – ' || v_worker_label ELSE '' END,
          'studio_production_stage_reversal', p_stage_id, v_stage.cost, v_stage.cost, true, NOW(), false
        )
        RETURNING id INTO v_reversal_journal_id;
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES
          (v_reversal_journal_id, v_counterparty_account_id, v_stage.cost, 0, 'Reversal worker payment / payable'),
          (v_reversal_journal_id, v_cost_account_id, 0, v_stage.cost, 'Reversal production cost');
      ELSIF v_payable_account_id IS NOT NULL OR v_cash_account_id IS NOT NULL THEN
        v_entry_no := 'JE-STD-REV-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
        INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual)
        VALUES (
          v_stage.company_id, v_stage.branch_id, v_entry_no, CURRENT_DATE,
          'Reversal: Studio ' || v_stage.production_no || ' – ' || v_stage.stage_type ||
            CASE WHEN v_worker_label IS NOT NULL THEN ' – ' || v_worker_label ELSE '' END,
          'studio_production_stage_reversal', p_stage_id, v_stage.cost, v_stage.cost, true, NOW(), false
        )
        RETURNING id INTO v_reversal_journal_id;
        IF v_payable_account_id IS NOT NULL THEN
          INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
          VALUES
            (v_reversal_journal_id, v_payable_account_id, v_stage.cost, 0, 'Reversal worker payable'),
            (v_reversal_journal_id, v_cost_account_id, 0, v_stage.cost, 'Reversal production cost');
        ELSIF v_cash_account_id IS NOT NULL THEN
          INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
          VALUES
            (v_reversal_journal_id, v_cash_account_id, v_stage.cost, 0, 'Reversal worker payment'),
            (v_reversal_journal_id, v_cost_account_id, 0, v_stage.cost, 'Reversal production cost');
        END IF;
      END IF;
    END IF;
  END IF;

  DELETE FROM worker_ledger_entries
  WHERE reference_type = 'studio_production_stage' AND reference_id = p_stage_id;

  UPDATE studio_production_stages
  SET status = 'received', completed_at = NULL, cost = 0, journal_entry_id = NULL
  WHERE id = p_stage_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION rpc_reopen_stage(UUID) IS 'Reopen completed stage; reversal debits the original JE credit account when available.';
