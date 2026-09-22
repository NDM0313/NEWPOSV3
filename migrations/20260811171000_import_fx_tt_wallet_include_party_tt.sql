-- Path 21: TT wallet helper must include party T/T routing under 12xx (e.g. WALI T/T 1202),
-- not only HAMID IK RMB-style names. Clearing parents (1201) stay excluded.

CREATE OR REPLACE FUNCTION public._is_tt_agent_wallet_account(p_code text, p_name text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits text := regexp_replace(TRIM(COALESCE(p_code, '')), '\D', '', 'g');
  v_name text := lower(TRIM(COALESCE(p_name, '')));
BEGIN
  IF v_name ~* 'clearing' THEN
    RETURN FALSE;
  END IF;
  IF length(v_digits) < 3 OR v_digits NOT LIKE '12%' THEN
    RETURN FALSE;
  END IF;
  IF v_name ~* 'tt[[:space:]]*agent' THEN
    RETURN TRUE;
  END IF;
  IF v_name ~* 'ik[[:space:]]*rmb' THEN
    RETURN TRUE;
  END IF;
  IF v_name ~* 'hamid' AND v_name ~* 'rmb' THEN
    RETURN TRUE;
  END IF;
  -- Party T/T routing wallets (WALI T/T, etc.)
  IF v_name ~* 't[[:space:]]*/[[:space:]]*t' THEN
    RETURN TRUE;
  END IF;
  IF v_name ~* '\mtt\M' AND v_name !~* 'telegraphic' THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public._is_tt_agent_wallet_account(text, text) IS
  'True for party TT wallets under 12xx (HAMID IK RMB, WALI T/T, …). Excludes clearing parents.';
