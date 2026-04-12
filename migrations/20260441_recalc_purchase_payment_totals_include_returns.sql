-- Purchase returns: net purchase due against original bill (total − finalized returns − paid).
-- Keeps purchases.paid_amount / due_amount / payment_status aligned with operational payables and party GL.

CREATE OR REPLACE FUNCTION public.recalc_purchase_payment_totals(p_purchase_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(15, 2);
  v_returns NUMERIC(15, 2);
  v_net_bill NUMERIC(15, 2);
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

  SELECT COALESCE(SUM(pr.total), 0)
  INTO v_returns
  FROM public.purchase_returns pr
  WHERE pr.original_purchase_id = p_purchase_id
    AND LOWER(TRIM(COALESCE(pr.status::text, ''))) = 'final';

  v_net_bill := GREATEST(0::numeric, COALESCE(v_total, 0) - COALESCE(v_returns, 0));

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
  'Sets purchases.paid_amount from purchase-linked + manual_payment allocations; due = max(0, (purchase.total − sum final purchase_returns) − paid).';

CREATE OR REPLACE FUNCTION public.trg_purchase_returns_recalc_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := OLD.original_purchase_id;
    IF pid IS NOT NULL THEN
      PERFORM public.recalc_purchase_payment_totals(pid);
    END IF;
    RETURN OLD;
  END IF;

  pid := NEW.original_purchase_id;
  IF pid IS NOT NULL THEN
    PERFORM public.recalc_purchase_payment_totals(pid);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.original_purchase_id IS NOT NULL
     AND OLD.original_purchase_id IS DISTINCT FROM NEW.original_purchase_id THEN
    PERFORM public.recalc_purchase_payment_totals(OLD.original_purchase_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_returns_recalc_purchase_ins ON public.purchase_returns;
CREATE TRIGGER trg_purchase_returns_recalc_purchase_ins
  AFTER INSERT ON public.purchase_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purchase_returns_recalc_purchase();

DROP TRIGGER IF EXISTS trg_purchase_returns_recalc_purchase_upd ON public.purchase_returns;
CREATE TRIGGER trg_purchase_returns_recalc_purchase_upd
  AFTER UPDATE OF status, original_purchase_id, total ON public.purchase_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purchase_returns_recalc_purchase();

DROP TRIGGER IF EXISTS trg_purchase_returns_recalc_purchase_del ON public.purchase_returns;
CREATE TRIGGER trg_purchase_returns_recalc_purchase_del
  AFTER DELETE ON public.purchase_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purchase_returns_recalc_purchase();
