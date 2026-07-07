-- Fix recalc_purchase_payment_totals owner + courier mode (idempotent)
ALTER FUNCTION public.recalc_purchase_payment_totals(UUID) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.recalc_purchase_payment_totals(p_purchase_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(15, 2);
  v_subtotal NUMERIC(15, 2);
  v_discount NUMERIC(15, 2);
  v_tax NUMERIC(15, 2);
  v_freight_settlement TEXT;
  v_returns NUMERIC(15, 2);
  v_net_bill NUMERIC(15, 2);
  v_direct NUMERIC(15, 2);
  v_alloc NUMERIC(15, 2);
  v_paid NUMERIC(15, 2);
  v_due NUMERIC(15, 2);
  v_status public.payment_status;
BEGIN
  SELECT
    COALESCE(p.total, 0),
    COALESCE(p.subtotal, 0),
    COALESCE(p.discount_amount, 0),
    COALESCE(p.tax_amount, 0),
    COALESCE(NULLIF(TRIM(p.freight_settlement), ''), 'supplier')
  INTO v_total, v_subtotal, v_discount, v_tax, v_freight_settlement
  FROM public.purchases p
  WHERE p.id = p_purchase_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(pr.total), 0)
  INTO v_returns
  FROM public.purchase_returns pr
  WHERE pr.original_purchase_id = p_purchase_id
    AND LOWER(TRIM(COALESCE(pr.status::text, ''))) = 'final';

  IF v_freight_settlement = 'courier' THEN
    v_net_bill := GREATEST(
      0::numeric,
      COALESCE(v_subtotal, 0) - COALESCE(v_discount, 0) + COALESCE(v_tax, 0) - COALESCE(v_returns, 0)
    );
  ELSE
    v_net_bill := GREATEST(0::numeric, COALESCE(v_total, 0) - COALESCE(v_returns, 0));
  END IF;

  SELECT COALESCE(SUM(pay.amount), 0)
  INTO v_direct
  FROM public.payments pay
  WHERE pay.reference_type = 'purchase'
    AND pay.reference_id = p_purchase_id
    AND pay.voided_at IS NULL;

  SELECT COALESCE(SUM(pa.allocated_amount), 0)
  INTO v_alloc
  FROM public.payment_allocations pa
  INNER JOIN public.payments pr ON pr.id = pa.payment_id
  WHERE pa.purchase_id = p_purchase_id
    AND pr.reference_type = 'manual_payment'
    AND pr.voided_at IS NULL;

  v_paid := COALESCE(v_direct, 0) + COALESCE(v_alloc, 0);
  v_due := GREATEST(0, COALESCE(v_net_bill, 0) - v_paid);

  IF COALESCE(v_net_bill, 0) > 0 AND v_paid >= v_net_bill THEN
    v_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'unpaid';
  END IF;

  UPDATE public.purchases
  SET
    paid_amount = v_paid,
    due_amount = v_due,
    payment_status = v_status
  WHERE id = p_purchase_id;
END;
$$;

ALTER FUNCTION public.recalc_purchase_payment_totals(UUID) OWNER TO postgres;
