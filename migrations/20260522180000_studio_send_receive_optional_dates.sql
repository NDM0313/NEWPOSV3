-- Studio: optional sent_date / received_date on Send & Receive RPCs (backdated entries).
-- Additive: default NOW() when param omitted (existing clients unchanged).

CREATE OR REPLACE FUNCTION rpc_send_to_worker(
  p_stage_id UUID,
  p_sent_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
  v_sent TIMESTAMPTZ;
BEGIN
  IF p_sent_date IS NOT NULL AND p_sent_date > (NOW() + INTERVAL '1 day') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sent date cannot be more than one day in the future');
  END IF;

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

  v_sent := COALESCE(p_sent_date, NOW());

  UPDATE studio_production_stages
  SET status = 'sent_to_worker', sent_date = v_sent
  WHERE id = p_stage_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_receive_work(
  p_stage_id UUID,
  p_received_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage RECORD;
  v_recv TIMESTAMPTZ;
BEGIN
  IF p_received_date IS NOT NULL AND p_received_date > (NOW() + INTERVAL '1 day') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Received date cannot be more than one day in the future');
  END IF;

  SELECT s.* INTO v_stage
  FROM studio_production_stages s
  WHERE s.id = p_stage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stage not found');
  END IF;
  IF v_stage.status != 'sent_to_worker' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only stages sent to worker can be received');
  END IF;

  v_recv := COALESCE(p_received_date, NOW());

  UPDATE studio_production_stages
  SET status = 'received', received_date = v_recv
  WHERE id = p_stage_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION rpc_send_to_worker(UUID, TIMESTAMPTZ) IS 'Mark stage sent to worker; optional p_sent_date (default NOW).';
COMMENT ON FUNCTION rpc_receive_work(UUID, TIMESTAMPTZ) IS 'Mark work received; optional p_received_date (default NOW).';
