-- Party TT agent foreign-currency wallets (e.g. HAMID IK RMB) — exclude from roznamcha liquidity

CREATE OR REPLACE FUNCTION public._unified_ledger_is_liquidity_account(
  p_code text,
  p_name text,
  p_type text,
  p_liquidity text DEFAULT 'all'
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $BODY$
DECLARE
  v_code text := TRIM(COALESCE(p_code, ''));
  v_digits text := regexp_replace(v_code, '\D', '', 'g');
  v_type text := LOWER(TRIM(COALESCE(p_type, '')));
  v_name text := LOWER(TRIM(COALESCE(p_name, '')));
  v_is_liq boolean := FALSE;
BEGIN
  -- Party T/T routing agents (e.g. WALI T/T) — not company roznamcha liquidity
  IF v_name ~* '\bclearing\b' AND (v_name ~* '\b(tt|telegraphic|bank|agent)\b' OR v_digits LIKE '12%') THEN
    NULL;
  ELSIF v_name ~* '\bt\/t\b' AND v_name !~* '\bclearing\b' THEN
    RETURN FALSE;
  ELSIF v_name ~* '\btt\b' AND v_name ~* '\bwali\b' AND v_name !~* '\bclearing\b' THEN
    RETURN FALSE;
  ELSIF v_digits LIKE '12%' AND v_name !~* '\bclearing\b'
    AND (v_name ~* '\bik\s*rmb\b' OR (v_name ~* '\bhamid\b' AND v_name ~* '\brmb\b') OR v_name ~* '\btt\s*agent\b') THEN
    RETURN FALSE;
  END IF;

  IF v_code IN ('1000', '1010', '1020') THEN v_is_liq := TRUE;
  ELSIF length(v_digits) >= 3 AND v_digits LIKE '102%' THEN v_is_liq := TRUE;
  ELSIF v_type IN ('cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos') THEN v_is_liq := TRUE;
  ELSIF v_name ~* 'cash|bank|mobile wallet|wallet|jazz|easypaisa|ndm|easy\s*paisa|mobicash|finja|upaisa|sadapay|nayapay' THEN
    v_is_liq := TRUE;
  END IF;

  IF NOT v_is_liq THEN RETURN FALSE; END IF;

  p_liquidity := LOWER(TRIM(COALESCE(p_liquidity, 'all')));
  IF p_liquidity = 'all' THEN RETURN TRUE; END IF;

  IF p_liquidity = 'bank' THEN
    RETURN v_type IN ('bank', 'card') OR v_code = '1010' OR v_digits LIKE '101%';
  ELSIF p_liquidity = 'wallet' THEN
    RETURN v_type IN ('mobile_wallet', 'wallet') OR v_code = '1020' OR v_digits LIKE '102%'
      OR v_name ~* 'wallet|jazz|easypaisa|sadapay|nayapay';
  ELSIF p_liquidity = 'cash' THEN
    RETURN v_type = 'cash' OR v_code = '1000' OR v_digits LIKE '100%';
  END IF;

  RETURN FALSE;
END;
$BODY$;

COMMENT ON FUNCTION public._unified_ledger_is_liquidity_account(text, text, text, text) IS
  'Liquidity filter for unified ledger. Excludes party T/T routing and TT agent RMB wallets (e.g. HAMID IK RMB).';
