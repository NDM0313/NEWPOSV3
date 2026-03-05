-- ============================================================================
-- STUDIO PRODUCTION STAGE: SENT → RECEIVED → COMPLETED WORKFLOW
-- ============================================================================
-- Lifecycle: pending → assigned → sent_to_worker → received → completed
-- Dates: sent_date, received_date, completed_at
-- After "Receive Work": confirm payment (Pay Now / Pay Later) then "Complete Stage"
-- ============================================================================

-- 1. Add date columns
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS sent_date TIMESTAMPTZ;
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS received_date TIMESTAMPTZ;
COMMENT ON COLUMN studio_production_stages.sent_date IS 'When item was sent to worker.';
COMMENT ON COLUMN studio_production_stages.received_date IS 'When work was received back from worker.';

-- 2. Add new status enum values (sent_to_worker, received)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'studio_production_stage_status') AND enumlabel = 'sent_to_worker') THEN
    ALTER TYPE studio_production_stage_status ADD VALUE 'sent_to_worker' AFTER 'assigned';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'studio_production_stage_status') AND enumlabel = 'received') THEN
    ALTER TYPE studio_production_stage_status ADD VALUE 'received' AFTER 'sent_to_worker';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Data migration (in_progress → sent_to_worker) is in a SEPARATE file.
--    PostgreSQL requires new enum values to be committed before use.
--    Run: studio_production_stage_migrate_in_progress_to_sent.sql AFTER this migration is committed.

-- 4. Extend force_clean_insert to clear new date columns
CREATE OR REPLACE FUNCTION studio_production_stages_force_clean_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.assigned_worker_id := NULL;
  NEW.status := 'pending';
  NEW.assigned_at := NULL;
  NEW.cost := 0;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_production_stages' AND column_name = 'expected_cost') THEN
    NEW.expected_cost := 0;
  END IF;
  NEW.completed_at := NULL;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_production_stages' AND column_name = 'journal_entry_id') THEN
    NEW.journal_entry_id := NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_production_stages' AND column_name = 'sent_date') THEN
    NEW.sent_date := NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_production_stages' AND column_name = 'received_date') THEN
    NEW.received_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Update CHECK: worker required for assigned, sent_to_worker, received
ALTER TABLE studio_production_stages DROP CONSTRAINT IF EXISTS chk_studio_stage_assigned_has_worker;
ALTER TABLE studio_production_stages ADD CONSTRAINT chk_studio_stage_assigned_has_worker
  CHECK ((status::text NOT IN ('assigned', 'in_progress', 'sent_to_worker', 'received')) OR (assigned_worker_id IS NOT NULL));

-- 6. RPC: Send to worker (assigned → sent_to_worker, set sent_date)
CREATE OR REPLACE FUNCTION rpc_send_to_worker(p_stage_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
BEGIN
  SELECT s.* INTO v_stage
  FROM studio_production_stages s
  WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;
  IF v_stage.status != 'assigned' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only assigned stages can be sent to worker');
  END IF;
  IF v_stage.assigned_worker_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Assign a worker first');
  END IF;

  UPDATE studio_production_stages
  SET status = 'sent_to_worker', sent_date = NOW()
  WHERE id = p_stage_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. RPC: Receive work (sent_to_worker → received, set received_date)
CREATE OR REPLACE FUNCTION rpc_receive_work(p_stage_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
BEGIN
  SELECT s.* INTO v_stage
  FROM studio_production_stages s
  WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;
  IF v_stage.status != 'sent_to_worker' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only stages sent to worker can be received');
  END IF;

  UPDATE studio_production_stages
  SET status = 'received', received_date = NOW()
  WHERE id = p_stage_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 8. RPC: Confirm payment (set cost + accounting). Pay Now: Dr 5000 Cr Cash (1000); Pay Later: Dr 5000 Cr 2010 + worker_ledger unpaid
CREATE OR REPLACE FUNCTION rpc_confirm_stage_payment(
  p_stage_id UUID,
  p_final_cost NUMERIC,
  p_pay_now BOOLEAN DEFAULT false
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
  v_cash_account_id UUID;
  v_journal_id UUID;
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
    SELECT id INTO v_cash_account_id FROM accounts
    WHERE company_id = v_stage.company_id AND (code = '1000' OR code LIKE '100%') AND is_active = true
    ORDER BY code LIMIT 1;
    IF v_cash_account_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Cash account (1000) not found. Configure chart of accounts.');
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
      'Studio ' || v_stage.production_no || ' – ' || v_stage.stage_type || ' (Pay Now)',
      'studio_production_stage', p_stage_id, p_final_cost, p_final_cost, true, NOW(), false
    )
    RETURNING id INTO v_journal_id;
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES
      (v_journal_id, v_cost_account_id, p_final_cost, 0, 'Production cost – ' || v_stage.stage_type),
      (v_journal_id, v_cash_account_id, 0, p_final_cost, 'Worker payment – ' || v_stage.stage_type);

    INSERT INTO worker_ledger_entries (company_id, worker_id, amount, reference_type, reference_id, notes, status, paid_at)
    VALUES (v_stage.company_id, v_stage.assigned_worker_id, p_final_cost, 'studio_production_stage', p_stage_id,
      'Studio ' || v_stage.production_no || ' – paid', 'paid', NOW());
  ELSE
    v_entry_no := 'JE-STD-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
    INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual)
    VALUES (
      v_stage.company_id, v_stage.branch_id, v_entry_no, CURRENT_DATE,
      'Studio ' || v_stage.production_no || ' – ' || v_stage.stage_type || ' stage',
      'studio_production_stage', p_stage_id, p_final_cost, p_final_cost, true, NOW(), false
    )
    RETURNING id INTO v_journal_id;
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES
      (v_journal_id, v_cost_account_id, p_final_cost, 0, 'Production cost – ' || v_stage.stage_type),
      (v_journal_id, v_payable_account_id, 0, p_final_cost, 'Worker payable – ' || v_stage.stage_type);

    INSERT INTO worker_ledger_entries (company_id, worker_id, amount, reference_type, reference_id, notes, status)
    VALUES (v_stage.company_id, v_stage.assigned_worker_id, p_final_cost, 'studio_production_stage', p_stage_id,
      'Studio ' || v_stage.production_no || ' – stage', 'unpaid');
  END IF;

  UPDATE studio_production_stages
  SET cost = p_final_cost, journal_entry_id = v_journal_id
  WHERE id = p_stage_id;

  RETURN jsonb_build_object('ok', true, 'journal_entry_id', v_journal_id);
END;
$$;

-- 9. RPC: Complete stage (received → completed, set completed_at). Only when cost already set (payment confirmed).
CREATE OR REPLACE FUNCTION rpc_complete_stage(p_stage_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
BEGIN
  SELECT s.* INTO v_stage
  FROM studio_production_stages s
  WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;
  IF v_stage.status != 'received' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only received stages can be completed. Confirm payment first.');
  END IF;
  IF COALESCE(v_stage.cost, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Confirm payment (cost) before completing');
  END IF;

  UPDATE studio_production_stages
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_stage_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 10. Reopen: reset to received (keep cost/journal); allow manager to re-confirm or edit
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
  v_cash_account_id UUID;
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
    SELECT id INTO v_cash_account_id FROM accounts
    WHERE company_id = v_stage.company_id AND (code = '1000' OR code LIKE '100%') AND is_active = true
    ORDER BY code LIMIT 1;

    IF v_cost_account_id IS NOT NULL AND (v_payable_account_id IS NOT NULL OR v_cash_account_id IS NOT NULL) THEN
      v_entry_no := 'JE-STD-REV-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
      INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual)
      VALUES (
        v_stage.company_id, v_stage.branch_id, v_entry_no, CURRENT_DATE,
        'Reversal: Studio ' || v_stage.production_no || ' – ' || v_stage.stage_type,
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

  DELETE FROM worker_ledger_entries
  WHERE reference_type = 'studio_production_stage' AND reference_id = p_stage_id;

  UPDATE studio_production_stages
  SET status = 'received', completed_at = NULL, cost = 0, journal_entry_id = NULL
  WHERE id = p_stage_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION rpc_send_to_worker IS 'Mark stage as sent to worker. Sets sent_date.';
COMMENT ON FUNCTION rpc_receive_work IS 'Mark work received from worker. Sets received_date.';
COMMENT ON FUNCTION rpc_confirm_stage_payment IS 'Confirm cost and Pay Now (Dr 5000 Cr Cash) or Pay Later (Dr 5000 Cr 2010 + worker ledger).';
COMMENT ON FUNCTION rpc_complete_stage IS 'Mark stage completed. Payment must be confirmed first.';
COMMENT ON FUNCTION rpc_reopen_stage IS 'Reopen completed stage to received. Reverses accounting.';
