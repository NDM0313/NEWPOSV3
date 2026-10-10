-- Customers & Suppliers operational summary report (period-scoped document totals + period-end due).
-- Deploy: docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < this_file.sql

CREATE OR REPLACE FUNCTION public.get_customers_suppliers_report(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_branch_id UUID DEFAULT NULL,
  p_contact_type TEXT DEFAULT 'both',
  p_balance_status TEXT DEFAULT 'all'
)
RETURNS TABLE (
  contact_id UUID,
  contact_name TEXT,
  contact_type TEXT,
  total_purchase NUMERIC,
  total_purchase_return NUMERIC,
  total_sale NUMERIC,
  total_sell_return NUMERIC,
  payment NUMERIC,
  total_discount NUMERIC,
  opening_balance_due NUMERIC,
  due NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_type TEXT := LOWER(TRIM(COALESCE(p_contact_type, 'both')));
  v_balance_status TEXT := LOWER(TRIM(COALESCE(p_balance_status, 'all')));
BEGIN
  IF p_company_id IS NULL OR p_start_date IS NULL OR p_end_date IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH purchase_agg AS (
    SELECT
      pur.supplier_id AS cid,
      COALESCE(SUM(pur.total), 0)::numeric AS total_purchase,
      COALESCE(SUM(COALESCE(pur.discount_amount, 0)), 0)::numeric AS purchase_discount
    FROM purchases pur
    WHERE pur.company_id = p_company_id
      AND pur.supplier_id IS NOT NULL
      AND pur.po_date BETWEEN p_start_date AND p_end_date
      AND LOWER(TRIM(COALESCE(pur.status::text, ''))) IN ('final', 'received')
      AND (
        p_branch_id IS NULL
        OR pur.branch_id IS NULL
        OR pur.branch_id = p_branch_id
      )
    GROUP BY pur.supplier_id
  ),
  purchase_return_agg AS (
    SELECT
      pr.supplier_id AS cid,
      COALESCE(SUM(pr.total), 0)::numeric AS total_purchase_return
    FROM purchase_returns pr
    WHERE pr.company_id = p_company_id
      AND pr.supplier_id IS NOT NULL
      AND pr.return_date BETWEEN p_start_date AND p_end_date
      AND LOWER(TRIM(COALESCE(pr.status::text, ''))) = 'final'
      AND (
        p_branch_id IS NULL
        OR pr.branch_id IS NULL
        OR pr.branch_id = p_branch_id
      )
    GROUP BY pr.supplier_id
  ),
  sale_agg AS (
    SELECT
      s.customer_id AS cid,
      COALESCE(SUM(s.total), 0)::numeric AS total_sale,
      COALESCE(SUM(COALESCE(s.discount_amount, 0)), 0)::numeric AS sale_discount
    FROM sales s
    WHERE s.company_id = p_company_id
      AND s.customer_id IS NOT NULL
      AND s.invoice_date BETWEEN p_start_date AND p_end_date
      AND LOWER(TRIM(COALESCE(s.status::text, ''))) = 'final'
      AND (
        p_branch_id IS NULL
        OR s.branch_id IS NULL
        OR s.branch_id = p_branch_id
      )
    GROUP BY s.customer_id
  ),
  sale_return_agg AS (
    SELECT
      sr.customer_id AS cid,
      COALESCE(SUM(sr.total), 0)::numeric AS total_sell_return
    FROM sale_returns sr
    WHERE sr.company_id = p_company_id
      AND sr.customer_id IS NOT NULL
      AND sr.return_date BETWEEN p_start_date AND p_end_date
      AND LOWER(TRIM(COALESCE(sr.status::text, ''))) = 'final'
      AND (
        p_branch_id IS NULL
        OR sr.branch_id IS NULL
        OR sr.branch_id = p_branch_id
      )
    GROUP BY sr.customer_id
  ),
  payment_received_agg AS (
    SELECT
      p.contact_id AS cid,
      COALESCE(SUM(p.amount), 0)::numeric AS payments_received
    FROM payments p
    WHERE p.company_id = p_company_id
      AND p.contact_id IS NOT NULL
      AND p.voided_at IS NULL
      AND p.payment_date BETWEEN p_start_date AND p_end_date
      AND LOWER(TRIM(COALESCE(p.payment_type::text, ''))) = 'received'
      AND (
        p_branch_id IS NULL
        OR p.branch_id IS NULL
        OR p.branch_id = p_branch_id
      )
    GROUP BY p.contact_id
  ),
  payment_paid_agg AS (
    SELECT
      p.contact_id AS cid,
      COALESCE(SUM(p.amount), 0)::numeric AS payments_paid
    FROM payments p
    WHERE p.company_id = p_company_id
      AND p.contact_id IS NOT NULL
      AND p.voided_at IS NULL
      AND p.payment_date BETWEEN p_start_date AND p_end_date
      AND LOWER(TRIM(COALESCE(p.payment_type::text, ''))) = 'paid'
      AND (
        p_branch_id IS NULL
        OR p.branch_id IS NULL
        OR p.branch_id = p_branch_id
      )
    GROUP BY p.contact_id
  ),
  base AS (
    SELECT
      c.id AS contact_id,
      c.name::text AS contact_name,
      c.type::text AS contact_type,
      COALESCE(pa.total_purchase, 0)::numeric AS total_purchase,
      COALESCE(pra.total_purchase_return, 0)::numeric AS total_purchase_return,
      COALESCE(sa.total_sale, 0)::numeric AS total_sale,
      COALESCE(sra.total_sell_return, 0)::numeric AS total_sell_return,
      (COALESCE(pre.payments_received, 0) + COALESCE(ppa.payments_paid, 0))::numeric AS payment,
      (COALESCE(sa.sale_discount, 0) + COALESCE(pa.purchase_discount, 0))::numeric AS total_discount,
      (
        CASE
          WHEN c.type IN ('customer', 'both')
            THEN GREATEST(0, COALESCE(c.opening_balance, 0)::numeric)
          ELSE 0::numeric
        END
        + CASE
          WHEN c.type IN ('supplier', 'both', 'worker')
            THEN GREATEST(0, COALESCE(c.supplier_opening_balance, c.opening_balance, 0)::numeric)
          ELSE 0::numeric
        END
      )::numeric AS opening_balance_due,
      (
        GREATEST(
          0::numeric,
          CASE
            WHEN c.type IN ('customer', 'both') THEN
              GREATEST(0, COALESCE(c.opening_balance, 0)::numeric)
              + COALESCE(sa.total_sale, 0)
              - COALESCE(sra.total_sell_return, 0)
              - COALESCE(pre.payments_received, 0)
            ELSE 0::numeric
          END
        )
        + GREATEST(
          0::numeric,
          CASE
            WHEN c.type IN ('supplier', 'both', 'worker') THEN
              GREATEST(0, COALESCE(c.supplier_opening_balance, c.opening_balance, 0)::numeric)
              + COALESCE(pa.total_purchase, 0)
              - COALESCE(pra.total_purchase_return, 0)
              - COALESCE(ppa.payments_paid, 0)
            ELSE 0::numeric
          END
        )
      )::numeric AS due
    FROM contacts c
    LEFT JOIN purchase_agg pa ON pa.cid = c.id
    LEFT JOIN purchase_return_agg pra ON pra.cid = c.id
    LEFT JOIN sale_agg sa ON sa.cid = c.id
    LEFT JOIN sale_return_agg sra ON sra.cid = c.id
    LEFT JOIN payment_received_agg pre ON pre.cid = c.id
    LEFT JOIN payment_paid_agg ppa ON ppa.cid = c.id
    WHERE c.company_id = p_company_id
      AND COALESCE(c.is_active, true) = true
  )
  SELECT
    b.contact_id,
    b.contact_name,
    b.contact_type,
    b.total_purchase,
    b.total_purchase_return,
    b.total_sale,
    b.total_sell_return,
    b.payment,
    b.total_discount,
    b.opening_balance_due,
    b.due
  FROM base b
  WHERE
    (
      v_contact_type = 'both'
      OR (v_contact_type = 'customer' AND b.contact_type IN ('customer', 'both'))
      OR (v_contact_type = 'supplier' AND b.contact_type IN ('supplier', 'both', 'worker'))
    )
    AND (
      v_contact_type <> 'both'
      OR b.total_purchase <> 0
      OR b.total_purchase_return <> 0
      OR b.total_sale <> 0
      OR b.total_sell_return <> 0
      OR b.payment <> 0
      OR b.total_discount <> 0
      OR b.opening_balance_due <> 0
      OR b.due <> 0
    )
    AND (
      v_balance_status = 'all'
      OR (v_balance_status = 'has_due' AND ABS(b.due) > 0.009)
      OR (v_balance_status = 'cleared' AND ABS(b.due) <= 0.009)
    )
  ORDER BY b.contact_name;
END;
$$;

COMMENT ON FUNCTION public.get_customers_suppliers_report(UUID, DATE, DATE, UUID, TEXT, TEXT) IS
  'Operational Customers & Suppliers report: period totals from final sales/purchases/returns/payments; opening from contact fields; due = period-end customer recv + supplier pay components (non-negative each).';

GRANT EXECUTE ON FUNCTION public.get_customers_suppliers_report(UUID, DATE, DATE, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customers_suppliers_report(UUID, DATE, DATE, UUID, TEXT, TEXT) TO service_role;
