-- ERP Final Stabilization: Consolidated dashboard RPC (1 call instead of 5–13).
-- Returns: financial metrics (via existing get_financial_dashboard_metrics), sales_by_category, low_stock_items.
-- Safe: read-only, SECURITY DEFINER with search_path, company-scoped.

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_dashboard_metrics'
  ) THEN
    CREATE FUNCTION get_dashboard_metrics(
      p_company_id UUID,
      p_branch_id UUID DEFAULT NULL,
      p_start_date DATE DEFAULT NULL,
      p_end_date DATE DEFAULT NULL
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      v_metrics JSONB;
      v_sales_by_cat JSONB := '[]'::JSONB;
      v_low_stock JSONB := '[]'::JSONB;
      v_start DATE;
      v_end DATE;
      sales_col TEXT;
      items_table TEXT;
      r RECORD;
    BEGIN
      -- Default date range to current month
      v_start := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::DATE);
      v_end := COALESCE(p_end_date, CURRENT_DATE);
      IF v_end < v_start THEN v_end := v_start; END IF;

      -- 1) Financial metrics (reuse existing RPC)
      BEGIN
        v_metrics := get_financial_dashboard_metrics(p_company_id);
      EXCEPTION WHEN OTHERS THEN
        v_metrics := jsonb_build_object(
          'today_sales', 0, 'today_profit', 0, 'monthly_revenue', 0, 'monthly_expenses', 0,
          'monthly_profit', 0, 'profit_margin_pct', 0, 'cash_balance', 0, 'bank_balance', 0,
          'receivables', 0, 'payables', 0,
          'sales_trend', '[]'::jsonb, 'expense_trend', '[]'::jsonb, 'profit_trend', '[]'::jsonb,
          'error', SQLERRM
        );
      END;

      -- Detect sales date column
      SELECT column_name INTO sales_col FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'sales' AND column_name IN ('sale_date', 'invoice_date') LIMIT 1;
      IF sales_col IS NULL THEN sales_col := 'sale_date'; END IF;

      -- 2) Sales by category: use sales_items first, else sale_items
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items') THEN
        items_table := 'sales_items';
      ELSE
        items_table := 'sale_items';
      END IF;

      EXECUTE format(
        'SELECT COALESCE(jsonb_agg(jsonb_build_object(''categoryName'', cat_name, ''total'', total)), ''[]''::jsonb)
         FROM (
           SELECT COALESCE(pc.name, ''Uncategorized'') AS cat_name, SUM(i.total)::numeric AS total
           FROM sales s
           INNER JOIN %I i ON i.sale_id = s.id
           LEFT JOIN products p ON p.id = i.product_id
           LEFT JOIN product_categories pc ON pc.id = p.category_id
           WHERE s.company_id = $1 AND s.status = ''final''
             AND (s.%I)::date >= $2 AND (s.%I)::date <= $3
           GROUP BY COALESCE(pc.name, ''Uncategorized'')
         ) t',
        items_table, sales_col, sales_col
      ) USING p_company_id, v_start, v_end INTO v_sales_by_cat;
      IF v_sales_by_cat IS NULL THEN v_sales_by_cat := '[]'::JSONB; END IF;

      -- 3) Low stock: from inventory_balance + products (if inventory_balance exists)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_balance') THEN
        EXECUTE '
          SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), ''[]''::jsonb)
          FROM (
            SELECT p.id, p.name, p.sku,
                   COALESCE(SUM(ib.qty), 0)::numeric AS current_stock,
                   p.min_stock
            FROM products p
            LEFT JOIN inventory_balance ib ON ib.product_id = p.id AND ib.company_id = p.company_id
            WHERE p.company_id = $1 AND p.is_active = true AND COALESCE(p.min_stock, 0) > 0
            GROUP BY p.id, p.name, p.sku, p.min_stock
            HAVING COALESCE(SUM(ib.qty), 0) < p.min_stock
            ORDER BY COALESCE(SUM(ib.qty), 0) ASC
            LIMIT 50
          ) t'
        INTO v_low_stock USING p_company_id;
      END IF;
      IF v_low_stock IS NULL THEN v_low_stock := '[]'::JSONB; END IF;

      RETURN jsonb_build_object(
        'metrics', v_metrics,
        'sales_by_category', v_sales_by_cat,
        'low_stock_items', v_low_stock
      );
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'metrics', COALESCE(v_metrics, '{}'::jsonb),
        'sales_by_category', COALESCE(v_sales_by_cat, '[]'::jsonb),
        'low_stock_items', COALESCE(v_low_stock, '[]'::jsonb),
        'error', SQLERRM
      );
    END;
    $body$;

    COMMENT ON FUNCTION get_dashboard_metrics(UUID, UUID, DATE, DATE) IS
      'ERP Final Stabilization: One RPC for dashboard (metrics + sales by category + low stock).';
  END IF;
END $mig$;
