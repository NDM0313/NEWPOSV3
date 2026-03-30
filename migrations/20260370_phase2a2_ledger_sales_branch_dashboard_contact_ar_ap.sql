-- Phase 2A.2: branch-aware customer ledger sales + executive dashboard AR/AP aligned with
-- get_contact_balances_summary (operational party roll-up), not raw SUM(sales.due_amount).
-- Safe: replaces function bodies only; no table drops.

-- ---------------------------------------------------------------------------
-- 1) get_customer_ledger_sales: optional p_branch_id (NULL = company-wide, unchanged behavior)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_customer_ledger_sales(UUID, UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_customer_ledger_sales(
  p_company_id UUID,
  p_customer_id UUID,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  invoice_no VARCHAR(100),
  invoice_date DATE,
  total DECIMAL(15,2),
  shipment_charges DECIMAL(15,2),
  paid_amount DECIMAL(15,2),
  due_amount DECIMAL(15,2),
  payment_status VARCHAR(50),
  discount_amount DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  expenses DECIMAL(15,2),
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    s.id,
    s.invoice_no,
    COALESCE(s.invoice_date, (s.created_at AT TIME ZONE 'UTC')::date) AS invoice_date,
    s.total,
    COALESCE(s.shipment_charges, 0)::decimal(15,2),
    s.paid_amount,
    s.due_amount,
    s.payment_status,
    COALESCE(s.discount_amount, 0)::decimal(15,2),
    COALESCE(s.tax_amount, 0)::decimal(15,2),
    COALESCE(s.expenses, 0)::decimal(15,2),
    s.created_at
  FROM sales s
  WHERE s.company_id = p_company_id
    AND s.customer_id = p_customer_id
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    AND LOWER(TRIM(COALESCE(s.status::text, ''))) = 'final'
    AND (
      p_from_date IS NULL
      OR COALESCE(s.invoice_date, (s.created_at AT TIME ZONE 'UTC')::date) >= p_from_date
    )
    AND (
      p_to_date IS NULL
      OR COALESCE(s.invoice_date, (s.created_at AT TIME ZONE 'UTC')::date) <= p_to_date
    )
  ORDER BY COALESCE(s.invoice_date, (s.created_at AT TIME ZONE 'UTC')::date) ASC, s.id ASC;
$$;

COMMENT ON FUNCTION public.get_customer_ledger_sales(UUID, UUID, DATE, DATE, UUID) IS
  'Customer ledger sales: final only; effective invoice date; optional branch filter (NULL = all branches).';

GRANT EXECUTE ON FUNCTION public.get_customer_ledger_sales(UUID, UUID, DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_ledger_sales(UUID, UUID, DATE, DATE, UUID) TO anon;

-- ---------------------------------------------------------------------------
-- 2) get_financial_dashboard_metrics: optional branch + operational AR/AP from contact summary
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_financial_dashboard_metrics(UUID);

CREATE OR REPLACE FUNCTION public.get_financial_dashboard_metrics(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_month_start DATE := date_trunc('month', v_today)::DATE;
  v_month_end DATE := v_month_start + interval '1 month' - interval '1 day';
  v_week_start DATE := v_today - interval '6 days';
  v_today_sales DECIMAL(15,2) := 0;
  v_today_purchases DECIMAL(15,2) := 0;
  v_today_expenses DECIMAL(15,2) := 0;
  v_monthly_revenue DECIMAL(15,2) := 0;
  v_monthly_expenses DECIMAL(15,2) := 0;
  v_monthly_purchases DECIMAL(15,2) := 0;
  v_receivables DECIMAL(15,2) := 0;
  v_payables DECIMAL(15,2) := 0;
  v_cash_balance DECIMAL(15,2) := 0;
  v_bank_balance DECIMAL(15,2) := 0;
  v_sales_trend JSONB := '[]'::JSONB;
  v_expense_trend JSONB := '[]'::JSONB;
  v_profit_trend JSONB := '[]'::JSONB;
  d DATE;
  day_sales DECIMAL(15,2);
  day_exp DECIMAL(15,2);
  day_pur DECIMAL(15,2);
  sales_col TEXT;
  purch_date_col TEXT;
  exp_date_col TEXT;
BEGIN
  SELECT column_name INTO sales_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'sales' AND column_name IN ('sale_date','invoice_date') LIMIT 1;
  IF sales_col IS NULL THEN sales_col := 'sale_date'; END IF;

  SELECT column_name INTO purch_date_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name IN ('po_date','order_date','created_at') LIMIT 1;
  IF purch_date_col IS NULL THEN purch_date_col := 'po_date'; END IF;

  SELECT column_name INTO exp_date_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name IN ('expense_date','date','created_at') LIMIT 1;
  IF exp_date_col IS NULL THEN exp_date_col := 'expense_date'; END IF;

  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM sales WHERE company_id = $1 AND status = %L AND (%I)::date = $2',
    'final', sales_col
  ) INTO v_today_sales USING p_company_id, v_today;

  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM purchases WHERE company_id = $1 AND status IN (%L, %L) AND (%I)::date = $2',
    'final', 'received', purch_date_col
  ) INTO v_today_purchases USING p_company_id, v_today;

  EXECUTE format(
    'SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE company_id = $1 AND status = %L AND (%I)::date = $2',
    'paid', exp_date_col
  ) INTO v_today_expenses USING p_company_id, v_today;

  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM sales WHERE company_id = $1 AND status = %L AND (%I)::date >= $2 AND (%I)::date <= $3',
    'final', sales_col, sales_col
  ) INTO v_monthly_revenue USING p_company_id, v_month_start, v_month_end;

  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM purchases WHERE company_id = $1 AND status IN (%L, %L) AND (%I)::date >= $2 AND (%I)::date <= $3',
    'final', 'received', purch_date_col, purch_date_col
  ) INTO v_monthly_purchases USING p_company_id, v_month_start, v_month_end;

  EXECUTE format(
    'SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE company_id = $1 AND status = %L AND (%I)::date >= $2 AND (%I)::date <= $3',
    'paid', exp_date_col, exp_date_col
  ) INTO v_monthly_expenses USING p_company_id, v_month_start, v_month_end;

  SELECT COALESCE(SUM(cbs.receivables), 0), COALESCE(SUM(cbs.payables), 0)
  INTO v_receivables, v_payables
  FROM get_contact_balances_summary(p_company_id, p_branch_id) AS cbs;

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

  FOR d IN SELECT generate_series(v_week_start, v_today, '1 day'::interval)::date
  LOOP
    EXECUTE format(
      'SELECT COALESCE(SUM(total), 0) FROM sales WHERE company_id = $1 AND status = %L AND (%I)::date = $2',
      'final', sales_col
    ) INTO day_sales USING p_company_id, d;

    EXECUTE format(
      'SELECT COALESCE(SUM(total), 0) FROM purchases WHERE company_id = $1 AND status IN (%L, %L) AND (%I)::date = $2',
      'final', 'received', purch_date_col
    ) INTO day_pur USING p_company_id, d;

    EXECUTE format(
      'SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE company_id = $1 AND status = %L AND (%I)::date = $2',
      'paid', exp_date_col
    ) INTO day_exp USING p_company_id, d;

    v_sales_trend := v_sales_trend || jsonb_build_object('date', d, 'value', COALESCE(day_sales, 0));
    v_expense_trend := v_expense_trend || jsonb_build_object('date', d, 'value', COALESCE(day_exp, 0) + COALESCE(day_pur, 0));
    v_profit_trend := v_profit_trend || jsonb_build_object('date', d, 'value', COALESCE(day_sales, 0) - COALESCE(day_pur, 0) - COALESCE(day_exp, 0));
  END LOOP;

  RETURN jsonb_build_object(
    'today_sales', COALESCE(v_today_sales, 0),
    'today_profit', COALESCE(v_today_sales, 0) - COALESCE(v_today_purchases, 0) - COALESCE(v_today_expenses, 0),
    'monthly_revenue', COALESCE(v_monthly_revenue, 0),
    'monthly_expenses', COALESCE(v_monthly_purchases, 0) + COALESCE(v_monthly_expenses, 0),
    'monthly_profit', COALESCE(v_monthly_revenue, 0) - COALESCE(v_monthly_purchases, 0) - COALESCE(v_monthly_expenses, 0),
    'profit_margin_pct', CASE WHEN (v_monthly_revenue IS NULL OR v_monthly_revenue = 0) THEN 0
      ELSE ROUND(((v_monthly_revenue - COALESCE(v_monthly_purchases, 0) - COALESCE(v_monthly_expenses, 0)) / v_monthly_revenue * 100)::numeric, 2) END,
    'cash_balance', COALESCE(v_cash_balance, 0),
    'bank_balance', COALESCE(v_bank_balance, 0),
    'receivables', COALESCE(v_receivables, 0),
    'payables', COALESCE(v_payables, 0),
    'ar_ap_basis', 'get_contact_balances_summary',
    'ar_ap_scope', CASE WHEN p_branch_id IS NULL THEN 'company' ELSE 'branch' END,
    'sales_trend', v_sales_trend,
    'expense_trend', v_expense_trend,
    'profit_trend', v_profit_trend
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'today_sales', 0, 'today_profit', 0, 'monthly_revenue', 0, 'monthly_expenses', 0,
    'profit_margin_pct', 0, 'cash_balance', 0, 'bank_balance', 0,
    'receivables', 0, 'payables', 0,
    'ar_ap_basis', 'get_contact_balances_summary',
    'ar_ap_scope', CASE WHEN p_branch_id IS NULL THEN 'company' ELSE 'branch' END,
    'sales_trend', '[]'::jsonb, 'expense_trend', '[]'::jsonb, 'profit_trend', '[]'::jsonb,
    'error', SQLERRM
  );
END;
$body$;

COMMENT ON FUNCTION public.get_financial_dashboard_metrics(UUID, UUID) IS
  'Executive metrics: cash/bank from journal; receivables/payables = SUM(get_contact_balances_summary) (operational party roll-up, includes worker/studio payables in payables column). Optional branch filters AR/AP only.';

GRANT EXECUTE ON FUNCTION public.get_financial_dashboard_metrics(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_dashboard_metrics(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) get_dashboard_metrics: forward branch into financial RPC + same AR/AP basis on overrides
-- ---------------------------------------------------------------------------
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
  v_metrics JSONB;
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
  v_sales_trend JSONB := '[]'::JSONB;
  v_expense_trend JSONB := '[]'::JSONB;
  v_profit_trend JSONB := '[]'::JSONB;
  d DATE;
  day_sales DECIMAL(15,2);
  day_pur DECIMAL(15,2);
  day_exp DECIMAL(15,2);
BEGIN
  v_start := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::DATE);
  v_end := COALESCE(p_end_date, CURRENT_DATE);
  IF v_end < v_start THEN v_end := v_start; END IF;

  BEGIN
    v_metrics := get_financial_dashboard_metrics(p_company_id, p_branch_id);
  EXCEPTION WHEN OTHERS THEN
    v_metrics := jsonb_build_object(
      'today_sales', 0, 'today_profit', 0, 'monthly_revenue', 0, 'monthly_expenses', 0,
      'monthly_profit', 0, 'profit_margin_pct', 0, 'cash_balance', 0, 'bank_balance', 0,
      'receivables', 0, 'payables', 0,
      'period_purchases', 0, 'period_operating_expenses', 0,
      'ar_ap_basis', 'get_contact_balances_summary',
      'ar_ap_scope', CASE WHEN p_branch_id IS NULL THEN 'company' ELSE 'branch' END,
      'sales_trend', '[]'::jsonb, 'expense_trend', '[]'::jsonb, 'profit_trend', '[]'::jsonb,
      'error', SQLERRM
    );
  END;

  SELECT column_name INTO sales_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'sales' AND column_name IN ('sale_date', 'invoice_date') LIMIT 1;
  IF sales_col IS NULL THEN sales_col := 'invoice_date'; END IF;

  SELECT column_name INTO purch_date_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name IN ('po_date', 'order_date', 'created_at') LIMIT 1;
  IF purch_date_col IS NULL THEN purch_date_col := 'po_date'; END IF;

  SELECT column_name INTO exp_date_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name IN ('expense_date', 'date', 'created_at') LIMIT 1;
  IF exp_date_col IS NULL THEN exp_date_col := 'expense_date'; END IF;

  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM sales WHERE company_id = $1 AND LOWER(TRIM(COALESCE(status::text, %L))) = %L AND (%I)::date >= $2 AND (%I)::date <= $3',
    '', 'final', sales_col, sales_col
  ) INTO v_period_revenue USING p_company_id, v_start, v_end;

  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM purchases WHERE company_id = $1 AND LOWER(TRIM(COALESCE(status::text, %L))) IN (%L, %L) AND (%I)::date >= $2 AND (%I)::date <= $3',
    '', 'final', 'received', purch_date_col, purch_date_col
  ) INTO v_period_purchases USING p_company_id, v_start, v_end;

  EXECUTE format(
    'SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE company_id = $1 AND LOWER(TRIM(COALESCE(status::text, %L))) = %L AND (%I)::date >= $2 AND (%I)::date <= $3',
    '', 'paid', exp_date_col, exp_date_col
  ) INTO v_period_expenses USING p_company_id, v_start, v_end;

  SELECT COALESCE(SUM(cbs.receivables), 0), COALESCE(SUM(cbs.payables), 0)
  INTO v_receivables, v_payables
  FROM get_contact_balances_summary(p_company_id, p_branch_id) AS cbs;

  v_metrics := jsonb_set(v_metrics, '{monthly_revenue}', to_jsonb(COALESCE(v_period_revenue, 0)::numeric));
  v_metrics := jsonb_set(v_metrics, '{monthly_expenses}', to_jsonb((COALESCE(v_period_purchases, 0) + COALESCE(v_period_expenses, 0))::numeric));
  v_metrics := jsonb_set(v_metrics, '{monthly_profit}', to_jsonb((COALESCE(v_period_revenue, 0) - COALESCE(v_period_purchases, 0) - COALESCE(v_period_expenses, 0))::numeric));
  v_metrics := jsonb_set(v_metrics, '{profit_margin_pct}', to_jsonb(
    CASE WHEN (v_period_revenue IS NULL OR v_period_revenue = 0) THEN 0
    ELSE ROUND(((v_period_revenue - COALESCE(v_period_purchases, 0) - COALESCE(v_period_expenses, 0)) / v_period_revenue * 100)::numeric, 2) END
  ));
  v_metrics := jsonb_set(v_metrics, '{today_sales}', to_jsonb(COALESCE(v_period_revenue, 0)::numeric));
  v_metrics := jsonb_set(v_metrics, '{today_profit}', to_jsonb((COALESCE(v_period_revenue, 0) - COALESCE(v_period_purchases, 0) - COALESCE(v_period_expenses, 0))::numeric));
  v_metrics := jsonb_set(v_metrics, '{period_purchases}', to_jsonb(COALESCE(v_period_purchases, 0)::numeric));
  v_metrics := jsonb_set(v_metrics, '{period_operating_expenses}', to_jsonb(COALESCE(v_period_expenses, 0)::numeric));
  v_metrics := jsonb_set(v_metrics, '{receivables}', to_jsonb(COALESCE(v_receivables, 0)::numeric));
  v_metrics := jsonb_set(v_metrics, '{payables}', to_jsonb(COALESCE(v_payables, 0)::numeric));
  v_metrics := jsonb_set(v_metrics, '{ar_ap_basis}', to_jsonb('get_contact_balances_summary'::text));
  v_metrics := jsonb_set(v_metrics, '{ar_ap_scope}', to_jsonb((CASE WHEN p_branch_id IS NULL THEN 'company' ELSE 'branch' END)::text));

  FOR d IN SELECT generate_series(v_start, v_end, '1 day'::interval)::date
  LOOP
    EXECUTE format(
      'SELECT COALESCE(SUM(total), 0) FROM sales WHERE company_id = $1 AND LOWER(TRIM(COALESCE(status::text, %L))) = %L AND (%I)::date = $2',
      '', 'final', sales_col
    ) INTO day_sales USING p_company_id, d;
    EXECUTE format(
      'SELECT COALESCE(SUM(total), 0) FROM purchases WHERE company_id = $1 AND LOWER(TRIM(COALESCE(status::text, %L))) IN (%L, %L) AND (%I)::date = $2',
      '', 'final', 'received', purch_date_col
    ) INTO day_pur USING p_company_id, d;
    EXECUTE format(
      'SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE company_id = $1 AND LOWER(TRIM(COALESCE(status::text, %L))) = %L AND (%I)::date = $2',
      '', 'paid', exp_date_col
    ) INTO day_exp USING p_company_id, d;
    v_sales_trend := v_sales_trend || jsonb_build_object('date', d, 'value', COALESCE(day_sales, 0));
    v_expense_trend := v_expense_trend || jsonb_build_object('date', d, 'value', COALESCE(day_exp, 0) + COALESCE(day_pur, 0));
    v_profit_trend := v_profit_trend || jsonb_build_object('date', d, 'value', COALESCE(day_sales, 0) - COALESCE(day_pur, 0) - COALESCE(day_exp, 0));
  END LOOP;
  v_metrics := jsonb_set(v_metrics, '{sales_trend}', v_sales_trend);
  v_metrics := jsonb_set(v_metrics, '{expense_trend}', v_expense_trend);
  v_metrics := jsonb_set(v_metrics, '{profit_trend}', v_profit_trend);

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
       WHERE s.company_id = $1 AND LOWER(TRIM(COALESCE(s.status::text, ''''))) = ''final''
         AND (s.%I)::date >= $2 AND (s.%I)::date <= $3
       GROUP BY COALESCE(pc.name, ''Uncategorized'')
     ) t',
    items_table, sales_col, sales_col
  ) USING p_company_id, v_start, v_end INTO v_sales_by_cat;
  IF v_sales_by_cat IS NULL THEN v_sales_by_cat := '[]'::JSONB; END IF;

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

COMMENT ON FUNCTION public.get_dashboard_metrics(UUID, UUID, DATE, DATE) IS
  'Dashboard pack: financial metrics (AR/AP from get_contact_balances_summary for selected branch scope), trends, categories, low stock.';
