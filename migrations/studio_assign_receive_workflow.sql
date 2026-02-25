-- ============================================================================
-- STUDIO ASSIGN → RECEIVE → FINALIZE WORKFLOW
-- ============================================================================
-- Manager-driven: Assign (worker + rate) → Save → Receive (final cost) → Finalize
-- No auto-assignment. Web + Mobile use same RPCs.
-- ============================================================================

-- 1. Add 'assigned' to stage status enum (pending → assigned → completed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'studio_production_stage_status') AND enumlabel = 'assigned') THEN
    ALTER TYPE studio_production_stage_status ADD VALUE 'assigned' AFTER 'pending';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. RPC: Assign worker to stage (STEP 1)
-- Sets assigned_worker_id, expected_cost, assigned_at, status='assigned'
CREATE OR REPLACE FUNCTION rpc_assign_worker_to_stage(
  p_stage_id UUID,
  p_worker_id UUID,
  p_expected_cost NUMERIC,
  p_expected_completion_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
BEGIN
  SELECT s.*, p.company_id, p.branch_id, p.production_no
  INTO v_stage
  FROM studio_production_stages s
  JOIN studio_productions p ON p.id = s.production_id
  WHERE s.id = p_stage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;

  IF v_stage.status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot assign to a completed stage');
  END IF;

  UPDATE studio_production_stages
  SET
    assigned_worker_id = p_worker_id,
    expected_cost = p_expected_cost,
    assigned_at = NOW(),
    expected_completion_date = p_expected_completion_date,
    notes = COALESCE(p_notes, notes),
    status = 'assigned',
    cost = 0,
    completed_at = NULL,
    journal_entry_id = NULL
  WHERE id = p_stage_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. RPC: Receive and finalize stage (STEP 2)
-- Creates journal entry (Dr 5000, Cr 2010), worker_ledger, sets cost, completed_at, status='completed'
CREATE OR REPLACE FUNCTION rpc_receive_stage_and_finalize(
  p_stage_id UUID,
  p_final_cost NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
  v_cost_account_id UUID;
  v_payable_account_id UUID;
  v_journal_id UUID;
  v_entry_no TEXT;
BEGIN
  SELECT s.*, p.company_id, p.branch_id, p.production_no, p.sale_id
  INTO v_stage
  FROM studio_production_stages s
  JOIN studio_productions p ON p.id = s.production_id
  WHERE s.id = p_stage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;

  IF v_stage.status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage already received');
  END IF;

  IF p_final_cost <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Final cost must be greater than 0');
  END IF;

  IF v_stage.assigned_worker_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Assign a worker before receiving');
  END IF;

  -- Lookup accounts (5000 = Cost of Production, 2010 = Worker Payable)
  SELECT id INTO v_cost_account_id FROM accounts
  WHERE company_id = v_stage.company_id AND code = '5000' AND is_active = true LIMIT 1;
  SELECT id INTO v_payable_account_id FROM accounts
  WHERE company_id = v_stage.company_id AND code = '2010' AND is_active = true LIMIT 1;

  IF v_cost_account_id IS NULL OR v_payable_account_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Accounts 5000 or 2010 not found. Configure chart of accounts.');
  END IF;

  -- Create journal entry
  v_entry_no := 'JE-STD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
  INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual)
  VALUES (
    v_stage.company_id,
    v_stage.branch_id,
    v_entry_no,
    CURRENT_DATE,
    'Studio production ' || v_stage.production_no || ' – ' || v_stage.stage_type || ' stage completed',
    'studio_production_stage',
    p_stage_id,
    p_final_cost,
    p_final_cost,
    true,
    NOW(),
    false
  )
  RETURNING id INTO v_journal_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_journal_id, v_cost_account_id, p_final_cost, 0, 'Production cost – ' || v_stage.stage_type),
    (v_journal_id, v_payable_account_id, 0, p_final_cost, 'Worker payable – ' || v_stage.stage_type);

  -- Update stage
  UPDATE studio_production_stages
  SET
    cost = p_final_cost,
    status = 'completed',
    completed_at = NOW(),
    journal_entry_id = v_journal_id,
    notes = COALESCE(p_notes, notes)
  WHERE id = p_stage_id;

  -- Worker ledger entry (status=unpaid; Pay Now / Accounting marks paid later)
  INSERT INTO worker_ledger_entries (company_id, worker_id, amount, reference_type, reference_id, notes, status)
  VALUES (
    v_stage.company_id,
    v_stage.assigned_worker_id,
    p_final_cost,
    'studio_production_stage',
    p_stage_id,
    'Studio production ' || v_stage.production_no || ' – stage completed',
    'unpaid'
  );

  RETURN jsonb_build_object('ok', true, 'journal_entry_id', v_journal_id);
END;
$$;

-- 4. RPC: Reopen completed stage (admin/manager)
-- Reverses journal, removes worker_ledger, resets stage to assigned
CREATE OR REPLACE FUNCTION rpc_reopen_stage(p_stage_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
  v_cost_account_id UUID;
  v_payable_account_id UUID;
  v_reversal_journal_id UUID;
  v_entry_no TEXT;
BEGIN
  SELECT s.*, p.company_id, p.branch_id, p.production_no
  INTO v_stage
  FROM studio_production_stages s
  JOIN studio_productions p ON p.id = s.production_id
  WHERE s.id = p_stage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;

  IF v_stage.status != 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only completed stages can be reopened');
  END IF;

  IF v_stage.journal_entry_id IS NOT NULL AND v_stage.cost > 0 THEN
    SELECT id INTO v_cost_account_id FROM accounts
    WHERE company_id = v_stage.company_id AND code = '5000' AND is_active = true LIMIT 1;
    SELECT id INTO v_payable_account_id FROM accounts
    WHERE company_id = v_stage.company_id AND code = '2010' AND is_active = true LIMIT 1;

    IF v_cost_account_id IS NOT NULL AND v_payable_account_id IS NOT NULL THEN
      v_entry_no := 'JE-STD-REV-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
      INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual)
      VALUES (
        v_stage.company_id,
        v_stage.branch_id,
        v_entry_no,
        CURRENT_DATE,
        'Reversal: Studio ' || v_stage.production_no || ' – ' || v_stage.stage_type || ' stage reopened',
        'studio_production_stage_reversal',
        p_stage_id,
        v_stage.cost,
        v_stage.cost,
        true,
        NOW(),
        false
      )
      RETURNING id INTO v_reversal_journal_id;

      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_reversal_journal_id, v_payable_account_id, v_stage.cost, 0, 'Reversal worker payable – ' || v_stage.stage_type),
        (v_reversal_journal_id, v_cost_account_id, 0, v_stage.cost, 'Reversal production cost – ' || v_stage.stage_type);
    END IF;
  END IF;

  -- Delete worker_ledger entry for this stage
  DELETE FROM worker_ledger_entries
  WHERE reference_type = 'studio_production_stage' AND reference_id = p_stage_id;

  -- Reset stage to assigned (keep worker, expected cost)
  UPDATE studio_production_stages
  SET
    status = 'assigned',
    cost = 0,
    completed_at = NULL,
    journal_entry_id = NULL
  WHERE id = p_stage_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION rpc_assign_worker_to_stage IS 'Assign worker to stage. Manager selects worker + rate. Status → assigned.';
COMMENT ON FUNCTION rpc_receive_stage_and_finalize IS 'Receive from worker. Final cost + accounting entry. Status → completed.';
COMMENT ON FUNCTION rpc_reopen_stage IS 'Reopen completed stage. Reverses accounting. Admin/manager only.';
