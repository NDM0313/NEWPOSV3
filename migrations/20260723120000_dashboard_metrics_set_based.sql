-- Dashboard metrics: set-based trends (no per-day loop), single AR/AP call, inline cash/bank.
-- V2: GROUP BY branch breakdown; prior_period totals; pass through low_stock from metrics.
-- Additive indexes for company/branch/date filters.

SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
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
  v_metrics JSONB := '{}'::JSONB;
  v_sales_by_cat JSONB := '[]'::JSONB;
  v_low_stock JSONB := '[]'::JSONB;
  v_start DATE;
  v_end DATE;
  sales_col TEXT;
  purch_date_col TEXT;
  exp_date_col TEXT;
  items_table TEXT;
  v_period_revenue DECIMAL(15,2) := 0;
  v_period_purchases DECIMAL(15,2) := 0;
  v_period_expenses DECIMAL(15,2) := 0;
  v_receivables DECIMAL(15,2) := 0;
  v_payables DECIMAL(15,2) := 0;
  v_cash_balance DECIMAL(15,2) := 0;
  v_bank_balance DECIMAL(15,2) := 0;
  v_sales_trend JSONB := '[]'::JSONB;
  v_expense_trend JSONB := '[]'::JSONB;
  v_profit_trend JSONB := '[]'::JSONB;
  v_today DATE := CURRENT_DATE;
BEGIN
  v_start := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::DATE);
  v_end := COALESCE(p_end_date, CURRENT_DATE);
  IF v_end < v_start THEN v_end := v_start; END IF;

  SELECT column_name INTO sales_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'sales' AND column_name IN ('sale_date', 'invoice_date') LIMIT 1;
  IF sales_col IS NULL THEN sales_col := 'invoice_date'; END IF;

  SELECT column_name INTO purch_date_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name IN ('po_date', 'order_date', 'created_at') LIMIT 1;
  IF purch_date_col IS NULL THEN purch_date_col := 'po_date'; END IF;

  SELECT column_name INTO exp_date_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name IN ('expense_date', 'date', 'created_at') LIMIT 1;
  IF exp_date_col IS NULL THEN exp_date_col := 'expense_date'; END IF;

  -- Period totals (3 queries)
  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM sales WHERE company_id = $1
       AND LOWER(TRIM(COALESCE(status::text, %L))) = %L
       AND (%I)::date >= $2 AND (%I)::date <= $3
       AND ($4::uuid IS NULL OR branch_id = $4)',
    '', 'final', sales_col, sales_col
  ) INTO v_period_revenue USING p_company_id, v_start, v_end, p_branch_id;

  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM purchases WHERE company_id = $1
       AND LOWER(TRIM(COALESCE(status::text, %L))) IN (%L, %L)
       AND (%I)::date >= $2 AND (%I)::date <= $3
       AND ($4::uuid IS NULL OR branch_id = $4)',
    '', 'final', 'received', purch_date_col, purch_date_col
  ) INTO v_period_purchases USING p_company_id, v_start, v_end, p_branch_id;

  EXECUTE format(
    'SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE company_id = $1
       AND LOWER(TRIM(COALESCE(status::text, %L))) = %L
       AND (%I)::date >= $2 AND (%I)::date <= $3
       AND ($4::uuid IS NULL OR branch_id = $4)',
    '', 'paid', exp_date_col, exp_date_col
  ) INTO v_period_expenses USING p_company_id, v_start, v_end, p_branch_id;

  -- AR/AP once
  BEGIN
    SELECT COALESCE(SUM(cbs.receivables), 0), COALESCE(SUM(cbs.payables), 0)
    INTO v_receivables, v_payables
    FROM get_contact_balances_summary(p_company_id, p_branch_id) AS cbs;
  EXCEPTION WHEN OTHERS THEN
    v_receivables := 0;
    v_payables := 0;
  END;

  -- Cash / bank company-wide (no nested get_financial_dashboard_metrics)
  BEGIN
    SELECT COALESCE(SUM(jel.debit - jel.credit), 0) INTO v_cash_balance
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    INNER JOIN accounts a ON a.id = jel.account_id AND a.company_id = p_company_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, false) = false
      AND a.is_active = true
      AND (je.entry_date IS NULL OR je.entry_date::date <= v_today)
      AND (TRIM(COALESCE(a.code, '')) = '1000' OR LOWER(COALESCE(a.type::text, '')) = 'cash');

    SELECT COALESCE(SUM(jel.debit - jel.credit), 0) INTO v_bank_balance
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    INNER JOIN accounts a ON a.id = jel.account_id AND a.company_id = p_company_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, false) = false
      AND a.is_active = true
      AND (je.entry_date IS NULL OR je.entry_date::date <= v_today)
      AND (TRIM(COALESCE(a.code, '')) = '1010' OR LOWER(COALESCE(a.type::text, '')) = 'bank');
  EXCEPTION WHEN OTHERS THEN
    v_cash_balance := 0;
    v_bank_balance := 0;
  END;

  -- Set-based daily trends (3 aggregations + fill)
  EXECUTE format(
    $q$
    WITH days AS (
      SELECT generate_series($2::date, $3::date, '1 day'::interval)::date AS d
    ),
    sales_d AS (
      SELECT (%I)::date AS d, COALESCE(SUM(total), 0)::numeric AS v
      FROM sales
      WHERE company_id = $1
        AND LOWER(TRIM(COALESCE(status::text, ''))) = 'final'
        AND (%I)::date >= $2 AND (%I)::date <= $3
        AND ($4::uuid IS NULL OR branch_id = $4)
      GROUP BY 1
    ),
    purch_d AS (
      SELECT (%I)::date AS d, COALESCE(SUM(total), 0)::numeric AS v
      FROM purchases
      WHERE company_id = $1
        AND LOWER(TRIM(COALESCE(status::text, ''))) IN ('final', 'received')
        AND (%I)::date >= $2 AND (%I)::date <= $3
        AND ($4::uuid IS NULL OR branch_id = $4)
      GROUP BY 1
    ),
    exp_d AS (
      SELECT (%I)::date AS d, COALESCE(SUM(amount), 0)::numeric AS v
      FROM expenses
      WHERE company_id = $1
        AND LOWER(TRIM(COALESCE(status::text, ''))) = 'paid'
        AND (%I)::date >= $2 AND (%I)::date <= $3
        AND ($4::uuid IS NULL OR branch_id = $4)
      GROUP BY 1
    ),
    joined AS (
      SELECT days.d,
             COALESCE(s.v, 0) AS sales_v,
             COALESCE(p.v, 0) AS purch_v,
             COALESCE(e.v, 0) AS exp_v
      FROM days
      LEFT JOIN sales_d s ON s.d = days.d
      LEFT JOIN purch_d p ON p.d = days.d
      LEFT JOIN exp_d e ON e.d = days.d
      ORDER BY days.d
    )
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object('date', d, 'value', sales_v) ORDER BY d), '[]'::jsonb),
      COALESCE(jsonb_agg(jsonb_build_object('date', d, 'value', purch_v + exp_v) ORDER BY d), '[]'::jsonb),
      COALESCE(jsonb_agg(jsonb_build_object('date', d, 'value', sales_v - purch_v - exp_v) ORDER BY d), '[]'::jsonb)
    FROM joined
    $q$,
    sales_col, sales_col, sales_col,
    purch_date_col, purch_date_col, purch_date_col,
    exp_date_col, exp_date_col, exp_date_col
  ) INTO v_sales_trend, v_expense_trend, v_profit_trend
  USING p_company_id, v_start, v_end, p_branch_id;

  IF v_sales_trend IS NULL THEN v_sales_trend := '[]'::JSONB; END IF;
  IF v_expense_trend IS NULL THEN v_expense_trend := '[]'::JSONB; END IF;
  IF v_profit_trend IS NULL THEN v_profit_trend := '[]'::JSONB; END IF;

  v_metrics := jsonb_build_object(
    'today_sales', COALESCE(v_period_revenue, 0),
    'today_profit', COALESCE(v_period_revenue, 0) - COALESCE(v_period_purchases, 0) - COALESCE(v_period_expenses, 0),
    'monthly_revenue', COALESCE(v_period_revenue, 0),
    'monthly_expenses', COALESCE(v_period_purchases, 0) + COALESCE(v_period_expenses, 0),
    'monthly_profit', COALESCE(v_period_revenue, 0) - COALESCE(v_period_purchases, 0) - COALESCE(v_period_expenses, 0),
    'profit_margin_pct', CASE
      WHEN COALESCE(v_period_revenue, 0) = 0 THEN 0
      ELSE ROUND(((v_period_revenue - COALESCE(v_period_purchases, 0) - COALESCE(v_period_expenses, 0)) / v_period_revenue * 100)::numeric, 2)
    END,
    'cash_balance', COALESCE(v_cash_balance, 0),
    'bank_balance', COALESCE(v_bank_balance, 0),
    'receivables', COALESCE(v_receivables, 0),
    'payables', COALESCE(v_payables, 0),
    'period_purchases', COALESCE(v_period_purchases, 0),
    'period_operating_expenses', COALESCE(v_period_expenses, 0),
    'ar_ap_basis', 'get_contact_balances_summary',
    'ar_ap_scope', CASE WHEN p_branch_id IS NULL THEN 'company' ELSE 'branch' END,
    'period_scope', CASE WHEN p_branch_id IS NULL THEN 'all_branches' ELSE 'branch' END,
    'cash_bank_scope', 'company',
    'sales_trend', v_sales_trend,
    'expense_trend', v_expense_trend,
    'profit_trend', v_profit_trend
  );

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items') THEN
    items_table := 'sales_items';
  ELSE
    items_table := 'sale_items';
  END IF;
  BEGIN
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(jsonb_build_object(''categoryName'', cat_name, ''total'', total)), ''[]''::jsonb)
       FROM (
         SELECT COALESCE(pc.name, ''Uncategorized'') AS cat_name, SUM(i.total)::numeric AS total
         FROM sales s
         INNER JOIN %I i ON i.sale_id = s.id
         LEFT JOIN products p ON p.id = i.product_id
         LEFT JOIN product_categories pc ON pc.id = p.category_id
         WHERE s.company_id = $1 AND LOWER(TRIM(COALESCE(s.status::text, ''''))) = ''final''
           AND (s.%I)::date >= $2 AND (s.%I)::date <= $3
           AND ($4::uuid IS NULL OR s.branch_id = $4)
         GROUP BY COALESCE(pc.name, ''Uncategorized'')
       ) t',
      items_table, sales_col, sales_col
    ) USING p_company_id, v_start, v_end, p_branch_id INTO v_sales_by_cat;
  EXCEPTION WHEN OTHERS THEN
    v_sales_by_cat := '[]'::JSONB;
  END;
  IF v_sales_by_cat IS NULL THEN v_sales_by_cat := '[]'::JSONB; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_balance') THEN
    BEGIN
      EXECUTE '
        SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), ''[]''::jsonb)
        FROM (
          SELECT p.id, p.name, p.sku,
                 COALESCE(SUM(ib.qty), 0)::numeric AS current_stock,
                 p.min_stock
          FROM products p
          LEFT JOIN inventory_balance ib ON ib.product_id = p.id AND ib.company_id = p.company_id
            AND ($2::uuid IS NULL OR ib.branch_id = $2)
          WHERE p.company_id = $1 AND p.is_active = true AND COALESCE(p.min_stock, 0) > 0
          GROUP BY p.id, p.name, p.sku, p.min_stock
          HAVING COALESCE(SUM(ib.qty), 0) < p.min_stock
          ORDER BY COALESCE(SUM(ib.qty), 0) ASC
          LIMIT 50
        ) t'
      INTO v_low_stock USING p_company_id, p_branch_id;
    EXCEPTION WHEN OTHERS THEN
      v_low_stock := '[]'::JSONB;
    END;
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

COMMENT ON FUNCTION public.get_dashboard_metrics(UUID, UUID, DATE, DATE) IS
  'Dashboard pack (set-based trends): period KPIs/trends/category/low-stock respect p_branch_id; AR/AP once; cash/bank company-wide.';

CREATE OR REPLACE FUNCTION public.get_dashboard_v2_snapshot(
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
  v_base JSONB;
  v_metrics JSONB;
  v_start DATE;
  v_end DATE;
  v_prior_start DATE;
  v_prior_end DATE;
  v_span INT;
  v_branch_breakdown JSONB := '[]'::JSONB;
  v_recent_sales JSONB := '[]'::JSONB;
  v_recent_purchases JSONB := '[]'::JSONB;
  v_recent_expenses JSONB := '[]'::JSONB;
  v_recent_payments JSONB := '[]'::JSONB;
  v_payment_methods JSONB := '[]'::JSONB;
  v_rental_alerts JSONB := '[]'::JSONB;
  v_cash_bank_accounts JSONB := '[]'::JSONB;
  v_top_customers JSONB := '[]'::JSONB;
  v_prior JSONB := NULL;
  v_prior_rev DECIMAL(15,2) := 0;
  v_prior_pur DECIMAL(15,2) := 0;
  v_prior_exp DECIMAL(15,2) := 0;
  sales_col TEXT;
  purch_date_col TEXT;
  exp_date_col TEXT;
BEGIN
  v_start := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::DATE);
  v_end := COALESCE(p_end_date, CURRENT_DATE);
  IF v_end < v_start THEN v_end := v_start; END IF;

  v_span := GREATEST(1, (v_end - v_start) + 1);
  v_prior_end := v_start - 1;
  v_prior_start := v_prior_end - (v_span - 1);

  v_base := get_dashboard_metrics(p_company_id, p_branch_id, v_start, v_end);
  v_metrics := COALESCE(v_base->'metrics', '{}'::jsonb);

  SELECT column_name INTO sales_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'sales' AND column_name IN ('sale_date', 'invoice_date') LIMIT 1;
  IF sales_col IS NULL THEN sales_col := 'invoice_date'; END IF;

  SELECT column_name INTO purch_date_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name IN ('po_date', 'order_date', 'created_at') LIMIT 1;
  IF purch_date_col IS NULL THEN purch_date_col := 'po_date'; END IF;

  SELECT column_name INTO exp_date_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name IN ('expense_date', 'date', 'created_at') LIMIT 1;
  IF exp_date_col IS NULL THEN exp_date_col := 'expense_date'; END IF;

  -- Prior period totals only (no second full metrics/trends pack)
  BEGIN
    EXECUTE format(
      'SELECT COALESCE(SUM(total), 0) FROM sales WHERE company_id = $1
         AND LOWER(TRIM(COALESCE(status::text, %L))) = %L
         AND (%I)::date >= $2 AND (%I)::date <= $3
         AND ($4::uuid IS NULL OR branch_id = $4)',
      '', 'final', sales_col, sales_col
    ) INTO v_prior_rev USING p_company_id, v_prior_start, v_prior_end, p_branch_id;
    EXECUTE format(
      'SELECT COALESCE(SUM(total), 0) FROM purchases WHERE company_id = $1
         AND LOWER(TRIM(COALESCE(status::text, %L))) IN (%L, %L)
         AND (%I)::date >= $2 AND (%I)::date <= $3
         AND ($4::uuid IS NULL OR branch_id = $4)',
      '', 'final', 'received', purch_date_col, purch_date_col
    ) INTO v_prior_pur USING p_company_id, v_prior_start, v_prior_end, p_branch_id;
    EXECUTE format(
      'SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE company_id = $1
         AND LOWER(TRIM(COALESCE(status::text, %L))) = %L
         AND (%I)::date >= $2 AND (%I)::date <= $3
         AND ($4::uuid IS NULL OR branch_id = $4)',
      '', 'paid', exp_date_col, exp_date_col
    ) INTO v_prior_exp USING p_company_id, v_prior_start, v_prior_end, p_branch_id;
    v_prior := jsonb_build_object(
      'today_sales', COALESCE(v_prior_rev, 0),
      'monthly_revenue', COALESCE(v_prior_rev, 0),
      'period_purchases', COALESCE(v_prior_pur, 0),
      'period_operating_expenses', COALESCE(v_prior_exp, 0),
      'date_from', v_prior_start,
      'date_to', v_prior_end
    );
  EXCEPTION WHEN OTHERS THEN
    v_prior := NULL;
  END;

  -- Branch breakdown: set-based GROUP BY (all branches only)
  IF p_branch_id IS NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'branches') THEN
    BEGIN
      EXECUTE format(
        $q$
        SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY branch_name), '[]'::jsonb)
        FROM (
          SELECT b.id AS branch_id, b.name AS branch_name,
            COALESCE(s.sales, 0)::numeric AS sales,
            COALESCE(p.purchases, 0)::numeric AS purchases,
            COALESCE(e.expenses, 0)::numeric AS expenses
          FROM branches b
          LEFT JOIN (
            SELECT branch_id, SUM(total)::numeric AS sales
            FROM sales
            WHERE company_id = $1
              AND LOWER(TRIM(COALESCE(status::text, ''))) = 'final'
              AND (%I)::date >= $2 AND (%I)::date <= $3
            GROUP BY branch_id
          ) s ON s.branch_id = b.id
          LEFT JOIN (
            SELECT branch_id, SUM(total)::numeric AS purchases
            FROM purchases
            WHERE company_id = $1
              AND LOWER(TRIM(COALESCE(status::text, ''))) IN ('final', 'received')
              AND (%I)::date >= $2 AND (%I)::date <= $3
            GROUP BY branch_id
          ) p ON p.branch_id = b.id
          LEFT JOIN (
            SELECT branch_id, SUM(amount)::numeric AS expenses
            FROM expenses
            WHERE company_id = $1
              AND LOWER(TRIM(COALESCE(status::text, ''))) = 'paid'
              AND (%I)::date >= $2 AND (%I)::date <= $3
            GROUP BY branch_id
          ) e ON e.branch_id = b.id
          WHERE b.company_id = $1 AND COALESCE(b.is_active, true) = true
        ) t
        $q$,
        sales_col, sales_col, purch_date_col, purch_date_col, exp_date_col, exp_date_col
      ) INTO v_branch_breakdown USING p_company_id, v_start, v_end;
    EXCEPTION WHEN OTHERS THEN
      v_branch_breakdown := '[]'::JSONB;
    END;
  END IF;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), ''[]''::jsonb)
     FROM (
       SELECT s.id, COALESCE(s.invoice_no, s.id::text) AS label, s.total AS amount, (s.%I)::date AS date
       FROM sales s
       WHERE s.company_id = $1 AND LOWER(TRIM(COALESCE(s.status::text, ''''))) = ''final''
         AND (s.%I)::date >= $2 AND (s.%I)::date <= $3
         AND ($4::uuid IS NULL OR s.branch_id = $4)
       ORDER BY (s.%I)::date DESC, s.created_at DESC NULLS LAST
       LIMIT 10
     ) t',
    sales_col, sales_col, sales_col, sales_col
  ) INTO v_recent_sales USING p_company_id, v_start, v_end, p_branch_id;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), ''[]''::jsonb)
     FROM (
       SELECT p.id, COALESCE(p.po_no, p.id::text) AS label, p.total AS amount, (p.%I)::date AS date
       FROM purchases p
       WHERE p.company_id = $1 AND LOWER(TRIM(COALESCE(p.status::text, ''''))) IN (''final'', ''received'')
         AND (p.%I)::date >= $2 AND (p.%I)::date <= $3
         AND ($4::uuid IS NULL OR p.branch_id = $4)
       ORDER BY (p.%I)::date DESC, p.created_at DESC NULLS LAST
       LIMIT 10
     ) t',
    purch_date_col, purch_date_col, purch_date_col, purch_date_col
  ) INTO v_recent_purchases USING p_company_id, v_start, v_end, p_branch_id;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), ''[]''::jsonb)
       FROM (
         SELECT e.id, COALESCE(e.description, e.id::text) AS label, e.amount, (e.%I)::date AS date
         FROM expenses e
         WHERE e.company_id = $1 AND LOWER(TRIM(COALESCE(e.status::text, ''''))) = ''paid''
           AND (e.%I)::date >= $2 AND (e.%I)::date <= $3
           AND ($4::uuid IS NULL OR e.branch_id = $4)
         ORDER BY (e.%I)::date DESC, e.created_at DESC NULLS LAST
         LIMIT 10
       ) t',
      exp_date_col, exp_date_col, exp_date_col, exp_date_col
    ) INTO v_recent_expenses USING p_company_id, v_start, v_end, p_branch_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    INTO v_recent_payments
    FROM (
      SELECT p.id, COALESCE(p.reference_number, p.id::text) AS label, p.amount, p.payment_date::date AS date
      FROM payments p
      WHERE p.company_id = p_company_id
        AND p.payment_date::date >= v_start AND p.payment_date::date <= v_end
        AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        AND p.voided_at IS NULL
      ORDER BY p.payment_date DESC, p.created_at DESC NULLS LAST
      LIMIT 10
    ) t;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('method', method, 'amount', amount)), '[]'::jsonb)
    INTO v_payment_methods
    FROM (
      SELECT COALESCE(a.name, a.code, 'Other') AS method, SUM(p.amount)::numeric AS amount
      FROM payments p
      LEFT JOIN accounts a ON a.id = p.payment_account_id
      WHERE p.company_id = p_company_id
        AND p.payment_date::date >= v_start AND p.payment_date::date <= v_end
        AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        AND p.voided_at IS NULL
      GROUP BY COALESCE(a.name, a.code, 'Other')
    ) pm;
  END IF;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(jsonb_build_object(''name'', name, ''total'', total)), ''[]''::jsonb)
     FROM (
       SELECT COALESCE(c.name, ''Walk-in'') AS name, SUM(s.total)::numeric AS total
       FROM sales s
       LEFT JOIN contacts c ON c.id = s.customer_id
       WHERE s.company_id = $1 AND LOWER(TRIM(COALESCE(s.status::text, ''''))) = ''final''
         AND (s.%I)::date >= $2 AND (s.%I)::date <= $3
         AND ($4::uuid IS NULL OR s.branch_id = $4)
       GROUP BY COALESCE(c.name, ''Walk-in'')
       ORDER BY total DESC
       LIMIT 5
     ) t',
    sales_col, sales_col
  ) INTO v_top_customers USING p_company_id, v_start, v_end, p_branch_id;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rentals') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    INTO v_rental_alerts
    FROM (
      SELECT r.id, r.booking_no, r.status, COALESCE(r.due_amount, 0)::numeric AS due_amount,
             r.return_date::text AS return_date
      FROM rentals r
      WHERE r.company_id = p_company_id
        AND (p_branch_id IS NULL OR r.branch_id = p_branch_id)
        AND LOWER(TRIM(COALESCE(r.status::text, ''))) IN ('booked', 'rented', 'overdue', 'picked_up')
        AND (
          (r.return_date IS NOT NULL AND r.return_date::date <= CURRENT_DATE + 3)
          OR COALESCE(r.due_amount, 0) > 0
        )
      ORDER BY r.return_date ASC NULLS LAST
      LIMIT 20
    ) t;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts') THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'balance', 0)), '[]'::jsonb)
    INTO v_cash_bank_accounts
    FROM (
      SELECT a.code, a.name
      FROM accounts a
      WHERE a.company_id = p_company_id AND a.is_active = true
        AND (LOWER(TRIM(COALESCE(a.type::text, ''))) IN ('cash', 'bank')
             OR a.code IN ('1000', '1010'))
      ORDER BY a.code
    ) ca;
  END IF;

  RETURN jsonb_build_object(
    'metrics', v_metrics,
    'sales_by_category', COALESCE(v_base->'sales_by_category', '[]'::jsonb),
    'low_stock', COALESCE(v_base->'low_stock_items', '[]'::jsonb),
    'prior_period', v_prior,
    'branch_breakdown', COALESCE(v_branch_breakdown, '[]'::jsonb),
    'recent_sales', COALESCE(v_recent_sales, '[]'::jsonb),
    'recent_purchases', COALESCE(v_recent_purchases, '[]'::jsonb),
    'recent_expenses', COALESCE(v_recent_expenses, '[]'::jsonb),
    'recent_payments', COALESCE(v_recent_payments, '[]'::jsonb),
    'payment_method_breakdown', COALESCE(v_payment_methods, '[]'::jsonb),
    'top_customers', COALESCE(v_top_customers, '[]'::jsonb),
    'rental_alerts', COALESCE(v_rental_alerts, '[]'::jsonb),
    'cash_bank_by_account', COALESCE(v_cash_bank_accounts, '[]'::jsonb),
    'date_from', v_start,
    'date_to', v_end,
    'error', v_base->'error'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'metrics', COALESCE(v_metrics, '{}'::jsonb),
    'sales_by_category', '[]'::jsonb,
    'low_stock', '[]'::jsonb,
    'prior_period', NULL,
    'branch_breakdown', '[]'::jsonb,
    'recent_sales', '[]'::jsonb,
    'recent_purchases', '[]'::jsonb,
    'recent_expenses', '[]'::jsonb,
    'recent_payments', '[]'::jsonb,
    'payment_method_breakdown', '[]'::jsonb,
    'top_customers', '[]'::jsonb,
    'rental_alerts', '[]'::jsonb,
    'cash_bank_by_account', '[]'::jsonb,
    'error', SQLERRM
  );
END;
$body$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(UUID, UUID, DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_v2_snapshot(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_v2_snapshot(UUID, UUID, DATE, DATE) TO service_role;

-- Supporting indexes (additive)
CREATE INDEX IF NOT EXISTS idx_sales_company_branch_invoice_date
  ON public.sales (company_id, branch_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_company_branch_po_date
  ON public.purchases (company_id, branch_id, po_date DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'expense_date'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_expenses_company_branch_expense_date
      ON public.expenses (company_id, branch_id, expense_date DESC)';
  END IF;
END $$;
