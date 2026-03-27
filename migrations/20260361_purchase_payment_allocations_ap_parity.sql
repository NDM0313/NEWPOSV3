-- AP parity: manual_payment (Add Entry / supplier payment) → FIFO allocation to open purchase bills,
-- mirroring manual_receipt → sales. Extends payment_allocations with optional purchase_id.

-- 1) Schema: one target per row — sale XOR purchase
ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE;

ALTER TABLE public.payment_allocations
  ALTER COLUMN sale_id DROP NOT NULL;

-- Existing rows: sale_id set, purchase_id null — satisfies check once added
ALTER TABLE public.payment_allocations
  DROP CONSTRAINT IF EXISTS payment_allocations_one_target_chk;

ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_one_target_chk CHECK (
    (sale_id IS NOT NULL AND purchase_id IS NULL)
    OR (sale_id IS NULL AND purchase_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_payment_allocations_purchase_id ON public.payment_allocations(purchase_id);

COMMENT ON TABLE public.payment_allocations IS 'Allocates manual_receipt to sales and/or manual_payment to purchases (FIFO). RLS via parent payment.';

-- 2) Recalculate purchase paid/due from direct purchase payments + manual_payment allocations
CREATE OR REPLACE FUNCTION public.recalc_purchase_payment_totals(p_purchase_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(15, 2);
  v_direct NUMERIC(15, 2);
  v_alloc NUMERIC(15, 2);
  v_paid NUMERIC(15, 2);
  v_due NUMERIC(15, 2);
  v_status public.payment_status;
BEGIN
  SELECT COALESCE(p.total, 0)
  INTO v_total
  FROM public.purchases p
  WHERE p.id = p_purchase_id;

  IF NOT FOUND THEN
    RETURN;
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
  v_due := GREATEST(0, COALESCE(v_total, 0) - v_paid);

  IF COALESCE(v_total, 0) > 0 AND v_paid >= v_total THEN
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

COMMENT ON FUNCTION public.recalc_purchase_payment_totals(UUID) IS 'Sets purchases.paid_amount from purchase-linked payments plus manual_payment payment_allocations.';

-- 3) Allocation triggers: recalc sale and/or purchase
CREATE OR REPLACE FUNCTION public.trg_payment_allocations_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid UUID;
  pid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    sid := OLD.sale_id;
    pid := OLD.purchase_id;
  ELSE
    sid := NEW.sale_id;
    pid := NEW.purchase_id;
  END IF;

  IF sid IS NOT NULL THEN
    PERFORM public.recalc_sale_payment_totals(sid);
  END IF;
  IF pid IS NOT NULL THEN
    PERFORM public.recalc_purchase_payment_totals(pid);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.sale_id IS DISTINCT FROM NEW.sale_id AND OLD.sale_id IS NOT NULL THEN
    PERFORM public.recalc_sale_payment_totals(OLD.sale_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.purchase_id IS DISTINCT FROM NEW.purchase_id AND OLD.purchase_id IS NOT NULL THEN
    PERFORM public.recalc_purchase_payment_totals(OLD.purchase_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Payments → purchase totals (direct purchase rows + voided_at changes)
CREATE OR REPLACE FUNCTION public.update_purchase_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_purchase_id := OLD.reference_id;
    IF OLD.reference_type = 'purchase' AND v_purchase_id IS NOT NULL THEN
      PERFORM public.recalc_purchase_payment_totals(v_purchase_id);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.reference_type = 'purchase' AND NEW.reference_id IS NOT NULL THEN
      PERFORM public.recalc_purchase_payment_totals(NEW.reference_id);
    END IF;
  ELSE
    -- UPDATE
    IF NEW.reference_type = 'purchase' AND NEW.reference_id IS NOT NULL THEN
      PERFORM public.recalc_purchase_payment_totals(NEW.reference_id);
    END IF;
    IF OLD.reference_type = 'purchase' AND OLD.reference_id IS NOT NULL
       AND (
         OLD.reference_id IS DISTINCT FROM NEW.reference_id
         OR OLD.reference_type IS DISTINCT FROM NEW.reference_type
         OR OLD.voided_at IS DISTINCT FROM NEW.voided_at
       ) THEN
      PERFORM public.recalc_purchase_payment_totals(OLD.reference_id);
    END IF;
    -- manual_payment voided: recompute any purchases still linked (allocations may already be deleted)
    IF NEW.reference_type = 'manual_payment'
       AND OLD.voided_at IS DISTINCT FROM NEW.voided_at THEN
      PERFORM public.recalc_purchases_for_manual_payment_payment_id(NEW.id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_purchases_for_manual_payment_payment_id(p_payment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT pa.purchase_id
    FROM public.payment_allocations pa
    WHERE pa.payment_id = p_payment_id
      AND pa.purchase_id IS NOT NULL
  LOOP
    PERFORM public.recalc_purchase_payment_totals(r.purchase_id);
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_purchase_totals_insert ON public.payments;
DROP TRIGGER IF EXISTS trigger_update_purchase_totals_update ON public.payments;
DROP TRIGGER IF EXISTS trigger_update_purchase_totals_update_manual_void ON public.payments;
DROP TRIGGER IF EXISTS trigger_update_purchase_totals_delete ON public.payments;

CREATE TRIGGER trigger_update_purchase_totals_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW
  WHEN (NEW.reference_type = 'purchase')
  EXECUTE FUNCTION public.update_purchase_payment_totals();

CREATE TRIGGER trigger_update_purchase_totals_update
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  WHEN (NEW.reference_type = 'purchase' OR OLD.reference_type = 'purchase')
  EXECUTE FUNCTION public.update_purchase_payment_totals();

CREATE TRIGGER trigger_update_purchase_totals_update_manual_void
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  WHEN (NEW.reference_type = 'manual_payment' AND OLD.voided_at IS DISTINCT FROM NEW.voided_at)
  EXECUTE FUNCTION public.update_purchase_payment_totals();

CREATE TRIGGER trigger_update_purchase_totals_delete
  AFTER DELETE ON public.payments
  FOR EACH ROW
  WHEN (OLD.reference_type = 'purchase')
  EXECUTE FUNCTION public.update_purchase_payment_totals();

-- 5) Backfill all purchases with canonical recalc (direct + manual allocations)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.purchases LOOP
    PERFORM public.recalc_purchase_payment_totals(r.id);
  END LOOP;
END $$;
