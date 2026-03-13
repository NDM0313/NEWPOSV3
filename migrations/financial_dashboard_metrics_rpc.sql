-- ============================================================================
-- RPC: get_financial_dashboard_metrics
-- Phase-2 Intelligence: Lightweight executive dashboard metrics (<1s load).
-- Returns: today sales/profit, monthly revenue/expenses, cash/bank, receivables,
--          payables, profit margin, and 7-day trend arrays.
-- Safe: read-only, no table/column drops, no RLS changes.
-- Fix: Create only if not exists so migration does not require function ownership
--      (avoids "must be owner of function" when run as pooler/app user).
-- ============================================================================

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_financial_dashboard_metrics'
  ) THEN
    CREATE FUNCTION get_financial_dashboard_metrics(p_company_id UUID)
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
  r RECORD;
  d DATE;
  day_sales DECIMAL(15,2);
  day_exp DECIMAL(15,2);
  day_pur DECIMAL(15,2);
  acc_bal DECIMAL(15,2);
  sales_col TEXT;
  purch_date_col TEXT;
  exp_date_col TEXT;
  purch_due_col TEXT;
BEGIN
  -- Detect column names (sale_date vs invoice_date, po_date vs order_date, expense_date vs date)
  SELECT column_name INTO sales_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'sales' AND column_name IN ('sale_date','invoice_date') LIMIT 1;
  IF sales_col IS NULL THEN sales_col := 'sale_date'; END IF;

  SELECT column_name INTO purch_date_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name IN ('po_date','order_date','created_at') LIMIT 1;
  IF purch_date_col IS NULL THEN purch_date_col := 'po_date'; END IF;

  SELECT column_name INTO exp_date_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name IN ('expense_date','date','created_at') LIMIT 1;
  IF exp_date_col IS NULL THEN exp_date_col := 'expense_date'; END IF;

  SELECT column_name INTO purch_due_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name IN ('due_amount','due') LIMIT 1;
  IF purch_due_col IS NULL THEN purch_due_col := 'due_amount'; END IF;

  -- Today sales (final only)
  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM sales WHERE company_id = $1 AND status = %L AND (%I)::date = $2',
    'final', sales_col
  ) INTO v_today_sales USING p_company_id, v_today;

  -- Today purchases
  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM purchases WHERE company_id = $1 AND status IN (%L, %L) AND (%I)::date = $2',
    'final', 'received', purch_date_col
  ) INTO v_today_purchases USING p_company_id, v_today;

  -- Today expenses (paid)
  EXECUTE format(
    'SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE company_id = $1 AND status = %L AND (%I)::date = $2',
    'paid', exp_date_col
  ) INTO v_today_expenses USING p_company_id, v_today;

  -- Monthly revenue (sales total)
  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM sales WHERE company_id = $1 AND status = %L AND (%I)::date >= $2 AND (%I)::date <= $3',
    'final', sales_col, sales_col
  ) INTO v_monthly_revenue USING p_company_id, v_month_start, v_month_end;

  -- Monthly purchases
  EXECUTE format(
    'SELECT COALESCE(SUM(total), 0) FROM purchases WHERE company_id = $1 AND status IN (%L, %L) AND (%I)::date >= $2 AND (%I)::date <= $3',
    'final', 'received', purch_date_col, purch_date_col
  ) INTO v_monthly_purchases USING p_company_id, v_month_start, v_month_end;

  -- Monthly expenses
  EXECUTE format(
    'SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE company_id = $1 AND status = %L AND (%I)::date >= $2 AND (%I)::date <= $3',
    'paid', exp_date_col, exp_date_col
  ) INTO v_monthly_expenses USING p_company_id, v_month_start, v_month_end;

  -- Receivables (sales due_amount)
  EXECUTE format(
    'SELECT COALESCE(SUM(due_amount), 0) FROM sales WHERE company_id = $1 AND status = %L AND COALESCE(due_amount, 0) > 0',
    'final'
  ) INTO v_receivables USING p_company_id;

  -- Payables (purchases due)
  EXECUTE format(
    'SELECT COALESCE(SUM(%I), 0) FROM purchases WHERE company_id = $1 AND status IN (%L, %L) AND COALESCE(%I, 0) > 0',
    purch_due_col, 'final', 'received', purch_due_col
  ) INTO v_payables USING p_company_id;

  -- Cash balance: accounts with code 1000 or type cash (support balance or current_balance column)
  BEGIN
    SELECT COALESCE(SUM(COALESCE(a.balance, a.current_balance, 0)), 0) INTO v_cash_balance
    FROM accounts a
    WHERE a.company_id = p_company_id AND a.is_active = true
      AND (a.code = '1000' OR LOWER(COALESCE(a.type::TEXT, '')) IN ('cash'));
  EXCEPTION WHEN undefined_column THEN
    SELECT COALESCE(SUM(COALESCE(a.current_balance, 0)), 0) INTO v_cash_balance
    FROM accounts a
    WHERE a.company_id = p_company_id AND a.is_active = true
      AND (a.code = '1000' OR LOWER(COALESCE(a.type::TEXT, '')) IN ('cash'));
  END;

  BEGIN
    SELECT COALESCE(SUM(COALESCE(a.balance, a.current_balance, 0)), 0) INTO v_bank_balance
    FROM accounts a
    WHERE a.company_id = p_company_id AND a.is_active = true
      AND (a.code = '1010' OR LOWER(COALESCE(a.type::TEXT, '')) IN ('bank'));
  EXCEPTION WHEN undefined_column THEN
    SELECT COALESCE(SUM(COALESCE(a.current_balance, 0)), 0) INTO v_bank_balance
    FROM accounts a
    WHERE a.company_id = p_company_id AND a.is_active = true
      AND (a.code = '1010' OR LOWER(COALESCE(a.type::TEXT, '')) IN ('bank'));
  END;

  -- 7-day trend: daily sales, expenses, profit
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
    'sales_trend', v_sales_trend,
    'expense_trend', v_expense_trend,
    'profit_trend', v_profit_trend
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'today_sales', 0, 'today_profit', 0, 'monthly_revenue', 0, 'monthly_expenses', 0,
    'profit_margin_pct', 0, 'cash_balance', 0, 'bank_balance', 0,
    'receivables', 0, 'payables', 0,
    'sales_trend', '[]'::jsonb, 'expense_trend', '[]'::jsonb, 'profit_trend', '[]'::jsonb,
    'error', SQLERRM
  );
END;
$body$;
    COMMENT ON FUNCTION get_financial_dashboard_metrics(UUID) IS
      'Phase-2 ERP: Executive financial dashboard metrics. Single RPC for sub-1s load.';
  END IF;
END $mig$;
