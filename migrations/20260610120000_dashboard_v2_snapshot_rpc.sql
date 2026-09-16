-- Dashboard V2 snapshot RPC (read-only). Reuses get_dashboard_metrics; adds branch breakdown,
-- recent activity, payment method breakdown, rental alerts. low_stock left null for client fill.

SET search_path = public;

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
  v_branch_breakdown JSONB := '[]'::JSONB;
  v_recent_sales JSONB := '[]'::JSONB;
  v_recent_purchases JSONB := '[]'::JSONB;
  v_recent_expenses JSONB := '[]'::JSONB;
  v_recent_payments JSONB := '[]'::JSONB;
  v_payment_methods JSONB := '[]'::JSONB;
  v_rental_alerts JSONB := '[]'::JSONB;
  v_cash_bank_accounts JSONB := '[]'::JSONB;
  v_top_customers JSONB := '[]'::JSONB;
  sales_col TEXT;
  purch_date_col TEXT;
  exp_date_col TEXT;
BEGIN
  v_start := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::DATE);
  v_end := COALESCE(p_end_date, CURRENT_DATE);
  IF v_end < v_start THEN v_end := v_start; END IF;

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

  -- Branch breakdown when all branches
  IF p_branch_id IS NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'branches') THEN
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY branch_name), ''[]''::jsonb)
       FROM (
         SELECT b.id AS branch_id, b.name AS branch_name,
           COALESCE((
             SELECT SUM(s.total) FROM sales s
             WHERE s.company_id = $1 AND s.branch_id = b.id
               AND LOWER(TRIM(COALESCE(s.status::text, ''''))) = ''final''
               AND (s.%I)::date >= $2 AND (s.%I)::date <= $3
           ), 0)::numeric AS sales,
           COALESCE((
             SELECT SUM(p.total) FROM purchases p
             WHERE p.company_id = $1 AND p.branch_id = b.id
               AND LOWER(TRIM(COALESCE(p.status::text, ''''))) IN (''final'', ''received'')
               AND (p.%I)::date >= $2 AND (p.%I)::date <= $3
           ), 0)::numeric AS purchases,
           COALESCE((
             SELECT SUM(e.amount) FROM expenses e
             WHERE e.company_id = $1 AND e.branch_id = b.id
               AND LOWER(TRIM(COALESCE(e.status::text, ''''))) = ''paid''
               AND (e.%I)::date >= $2 AND (e.%I)::date <= $3
           ), 0)::numeric AS expenses
         FROM branches b
         WHERE b.company_id = $1 AND COALESCE(b.is_active, true) = true
       ) t',
      sales_col, sales_col, purch_date_col, purch_date_col, exp_date_col, exp_date_col
    ) INTO v_branch_breakdown USING p_company_id, v_start, v_end;
  END IF;

  -- Recent sales
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

  -- Recent purchases
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), ''[]''::jsonb)
     FROM (
       SELECT p.id, COALESCE(p.po_number, p.id::text) AS label, p.total AS amount, (p.%I)::date AS date
       FROM purchases p
       WHERE p.company_id = $1 AND LOWER(TRIM(COALESCE(p.status::text, ''''))) IN (''final'', ''received'')
         AND (p.%I)::date >= $2 AND (p.%I)::date <= $3
         AND ($4::uuid IS NULL OR p.branch_id = $4)
       ORDER BY (p.%I)::date DESC, p.created_at DESC NULLS LAST
       LIMIT 10
     ) t',
    purch_date_col, purch_date_col, purch_date_col, purch_date_col
  ) INTO v_recent_purchases USING p_company_id, v_start, v_end, p_branch_id;

  -- Recent expenses
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

  -- Recent payments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    INTO v_recent_payments
    FROM (
      SELECT p.id, COALESCE(p.reference_no, p.id::text) AS label, p.amount, p.payment_date::date AS date
      FROM payments p
      WHERE p.company_id = p_company_id
        AND p.payment_date::date >= v_start AND p.payment_date::date <= v_end
        AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        AND LOWER(TRIM(COALESCE(p.status::text, ''))) NOT IN ('void', 'cancelled')
      ORDER BY p.payment_date DESC, p.created_at DESC NULLS LAST
      LIMIT 10
    ) t;

    -- Payment method breakdown
    SELECT COALESCE(jsonb_agg(jsonb_build_object('method', method, 'amount', amount)), '[]'::jsonb)
    INTO v_payment_methods
    FROM (
      SELECT COALESCE(a.name, a.code, 'Other') AS method, SUM(p.amount)::numeric AS amount
      FROM payments p
      LEFT JOIN accounts a ON a.id = p.payment_account_id
      WHERE p.company_id = p_company_id
        AND p.payment_date::date >= v_start AND p.payment_date::date <= v_end
        AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        AND LOWER(TRIM(COALESCE(p.status::text, ''))) NOT IN ('void', 'cancelled')
      GROUP BY COALESCE(a.name, a.code, 'Other')
    ) pm;
  END IF;

  -- Top customers in period
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

  -- Rental alerts
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

  -- Cash/bank per account (company-wide GL codes)
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
    'low_stock', NULL,
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
    'low_stock', NULL,
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

GRANT EXECUTE ON FUNCTION public.get_dashboard_v2_snapshot(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_v2_snapshot(UUID, UUID, DATE, DATE) TO service_role;
