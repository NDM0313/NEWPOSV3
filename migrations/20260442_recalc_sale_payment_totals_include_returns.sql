-- Sale returns: net sale due = (sale total + studio) − finalized returns − paid (direct + allocated manual_receipt).

CREATE OR REPLACE FUNCTION public.recalc_sale_payment_totals(p_sale_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(15, 2);
  v_studio NUMERIC(15, 2);
  v_returns NUMERIC(15, 2);
  v_grand NUMERIC(15, 2);
  v_direct NUMERIC(15, 2);
  v_alloc NUMERIC(15, 2);
  v_paid NUMERIC(15, 2);
  v_due NUMERIC(15, 2);
  v_status public.payment_status;
BEGIN
  SELECT COALESCE(s.total, 0), COALESCE(s.studio_charges, 0)
  INTO v_total, v_studio
  FROM public.sales s
  WHERE s.id = p_sale_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(sr.total), 0)
  INTO v_returns
  FROM public.sale_returns sr
  WHERE sr.original_sale_id = p_sale_id
    AND LOWER(TRIM(COALESCE(sr.status::text, ''))) = 'final';

  v_grand := GREATEST(0::numeric, COALESCE(v_total, 0) + COALESCE(v_studio, 0) - COALESCE(v_returns, 0));

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_direct
  FROM public.payments p
  WHERE p.reference_type = 'sale'
    AND p.reference_id = p_sale_id
    AND p.voided_at IS NULL;

  SELECT COALESCE(SUM(pa.allocated_amount), 0)
  INTO v_alloc
  FROM public.payment_allocations pa
  INNER JOIN public.payments pr ON pr.id = pa.payment_id
  WHERE pa.sale_id = p_sale_id
    AND pr.reference_type = 'manual_receipt'
    AND pr.voided_at IS NULL;

  v_paid := COALESCE(v_direct, 0) + COALESCE(v_alloc, 0);
  v_due := GREATEST(0, COALESCE(v_grand, 0) - v_paid);

  IF v_grand > 0 AND v_paid >= v_grand THEN
    v_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'unpaid';
  END IF;

  UPDATE public.sales
  SET
    paid_amount = v_paid,
    due_amount = v_due,
    payment_status = v_status
  WHERE id = p_sale_id;
END;
$$;

COMMENT ON FUNCTION public.recalc_sale_payment_totals(UUID) IS
  'Sets sales.paid_amount; due = max(0, (sale.total + studio_charges − sum final sale_returns) − paid).';

CREATE OR REPLACE FUNCTION public.trg_sale_returns_recalc_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    sid := OLD.original_sale_id;
    IF sid IS NOT NULL THEN
      PERFORM public.recalc_sale_payment_totals(sid);
    END IF;
    RETURN OLD;
  END IF;

  sid := NEW.original_sale_id;
  IF sid IS NOT NULL THEN
    PERFORM public.recalc_sale_payment_totals(sid);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.original_sale_id IS NOT NULL
     AND OLD.original_sale_id IS DISTINCT FROM NEW.original_sale_id THEN
    PERFORM public.recalc_sale_payment_totals(OLD.original_sale_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_returns_recalc_sale_ins ON public.sale_returns;
CREATE TRIGGER trg_sale_returns_recalc_sale_ins
  AFTER INSERT ON public.sale_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sale_returns_recalc_sale();

DROP TRIGGER IF EXISTS trg_sale_returns_recalc_sale_upd ON public.sale_returns;
CREATE TRIGGER trg_sale_returns_recalc_sale_upd
  AFTER UPDATE OF status, original_sale_id, total ON public.sale_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sale_returns_recalc_sale();

DROP TRIGGER IF EXISTS trg_sale_returns_recalc_sale_del ON public.sale_returns;
CREATE TRIGGER trg_sale_returns_recalc_sale_del
  AFTER DELETE ON public.sale_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sale_returns_recalc_sale();
