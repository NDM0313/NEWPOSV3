-- Wholesale import: freight may be settled to courier (2031) instead of supplier AP.
-- Default 'supplier' preserves retail / legacy purchase due semantics.

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS freight_settlement text NOT NULL DEFAULT 'supplier',
  ADD COLUMN IF NOT EXISTS clearance_courier_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_freight_settlement_check'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_freight_settlement_check
      CHECK (freight_settlement IN ('supplier', 'courier'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_clearance_courier_id_fkey'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_clearance_courier_id_fkey
      FOREIGN KEY (clearance_courier_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.purchases.freight_settlement IS
  'Who owes freight/clearance: supplier (default, retail) or courier (wholesale import landed-cost split).';
COMMENT ON COLUMN public.purchases.clearance_courier_id IS
  'Courier contact when freight_settlement=courier; clearance posts to courier payable 2031.';

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
    -- Supplier payable base: goods bill only (exclude shipping_cost / clearance).
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

COMMENT ON FUNCTION public.recalc_purchase_payment_totals(UUID) IS
  'Sets purchases.paid_amount from purchase-linked + manual_payment allocations. '
  'Due = max(0, net supplier bill − paid). When freight_settlement=courier, net bill excludes shipping_cost.';
