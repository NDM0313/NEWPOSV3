-- Performance: cheap low-stock badge query + company-wide account balances as-of (single SQL aggregate).
-- Additive only — does not change GL posting semantics.

SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_low_stock_products(
  p_company_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_limit int := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
BEGIN
  IF p_company_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF to_regclass('public.inventory_balance') IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  BEGIN
    EXECUTE format(
      $q$
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT
          p.id,
          p.name,
          p.sku,
          COALESCE(SUM(ib.qty), 0)::numeric AS current_stock,
          p.min_stock::numeric AS min_stock
        FROM products p
        LEFT JOIN inventory_balance ib
          ON ib.product_id = p.id
         AND ib.company_id = p.company_id
         AND ($2::uuid IS NULL OR ib.branch_id = $2)
        WHERE p.company_id = $1
          AND COALESCE(p.is_active, true) = true
          AND COALESCE(p.min_stock, 0) > 0
        GROUP BY p.id, p.name, p.sku, p.min_stock
        HAVING COALESCE(SUM(ib.qty), 0) < p.min_stock
        ORDER BY COALESCE(SUM(ib.qty), 0) ASC
        LIMIT %s
      ) t
      $q$,
      v_limit
    )
    INTO v_out
    USING p_company_id, p_branch_id;
  EXCEPTION WHEN OTHERS THEN
    v_out := '[]'::jsonb;
  END;

  RETURN COALESCE(v_out, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_low_stock_products(uuid, uuid, int) IS
  'Notification/dashboard low-stock list from inventory_balance — avoids full getInventoryOverview.';

GRANT EXECUTE ON FUNCTION public.get_low_stock_products(uuid, uuid, int) TO authenticated, service_role;

-- Company-wide leaf account balances as-of (debit - credit), non-void journals only.
CREATE OR REPLACE FUNCTION public.get_account_balances_as_of(
  p_company_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out jsonb := '{}'::jsonb;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(aid::text, bal),
    '{}'::jsonb
  )
  INTO v_out
  FROM (
    SELECT
      jel.account_id AS aid,
      ROUND(SUM(COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0))::numeric, 2) AS bal
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, false) = false
      AND je.entry_date::date <= COALESCE(p_as_of_date, CURRENT_DATE)
      AND (
        p_branch_id IS NULL
        OR je.branch_id = p_branch_id
        OR je.branch_id IS NULL
      )
    GROUP BY jel.account_id
  ) s;

  RETURN COALESCE(v_out, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_account_balances_as_of(uuid, date, uuid) IS
  'Account_id → net balance (Dr−Cr) as-of date; replaces client chunked trial-balance download for COA.';

GRANT EXECUTE ON FUNCTION public.get_account_balances_as_of(uuid, date, uuid) TO authenticated, service_role;
