-- Ensure worker row exists before assign (FK: assigned_worker_id → workers.id)
-- Upserts from contacts (type=worker) when sync trigger missed.

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
  v_contact RECORD;
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

  IF p_worker_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Worker is required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM workers w WHERE w.id = p_worker_id AND w.company_id = v_stage.company_id) THEN
    SELECT c.id, c.company_id, c.name, c.phone, c.mobile, c.worker_role, c.is_active
    INTO v_contact
    FROM contacts c
    WHERE c.id = p_worker_id
      AND c.company_id = v_stage.company_id
      AND (c.type::text = 'worker' OR c.type = 'worker')
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Worker not found. Open Contacts → Workers and save the worker again.'
      );
    END IF;

    INSERT INTO workers (id, company_id, name, phone, worker_type, is_active, created_at, updated_at)
    VALUES (
      v_contact.id,
      v_contact.company_id,
      COALESCE(v_contact.name, 'Worker')::VARCHAR(255),
      COALESCE(v_contact.phone, v_contact.mobile)::VARCHAR(50),
      COALESCE(v_contact.worker_role, 'General')::VARCHAR(50),
      COALESCE(v_contact.is_active, true),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      worker_type = EXCLUDED.worker_type,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();
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

COMMENT ON FUNCTION rpc_assign_worker_to_stage IS 'Assign worker to stage; upserts workers row from contact when missing (FK safe).';
