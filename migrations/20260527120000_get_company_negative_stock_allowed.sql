-- Company-wide negative stock policy (RLS-safe read for all authenticated users).
-- OR-merge: inventory_settings, pos_settings, legacy allow_negative_stock.

CREATE OR REPLACE FUNCTION public.get_company_negative_stock_allowed(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_flag text;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN false;
  END IF;

  FOR v_row IN
    SELECT key, value
    FROM public.settings
    WHERE company_id = p_company_id
      AND key IN ('inventory_settings', 'pos_settings', 'allow_negative_stock')
  LOOP
    IF v_row.key IN ('inventory_settings', 'pos_settings') THEN
      IF v_row.value IS NULL THEN
        CONTINUE;
      END IF;
      IF jsonb_typeof(v_row.value) = 'object' AND v_row.value ? 'negativeStockAllowed' THEN
        v_flag := lower(trim(both FROM coalesce(v_row.value->>'negativeStockAllowed', '')));
        IF v_flag IN ('true', 't', '1', 'yes') THEN
          RETURN true;
        END IF;
      END IF;
    ELSIF v_row.key = 'allow_negative_stock' THEN
      IF v_row.value IS NULL THEN
        CONTINUE;
      END IF;
      IF jsonb_typeof(v_row.value) = 'boolean' AND v_row.value = 'true'::jsonb THEN
        RETURN true;
      END IF;
      v_flag := lower(trim(both FROM v_row.value#>>'{}'));
      IF v_flag IN ('true', 't', '1', 'yes') THEN
        RETURN true;
      END IF;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.get_company_negative_stock_allowed(uuid) IS
  'Returns true when company allows negative stock (inventory_settings OR pos_settings OR legacy allow_negative_stock). SECURITY DEFINER for staff RLS.';

GRANT EXECUTE ON FUNCTION public.get_company_negative_stock_allowed(uuid) TO authenticated;
