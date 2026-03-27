-- Manual customer receipt allocations: link a single manual_receipt payment to one or more final sales
-- so sales.paid_amount / due_amount and payment history stay consistent with AR.

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS studio_charges NUMERIC(15, 2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(15, 2) NOT NULL CHECK (allocated_amount > 0),
  allocation_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_sale_id ON public.payment_allocations(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_company_id ON public.payment_allocations(company_id);

COMMENT ON TABLE public.payment_allocations IS 'Allocates manual_receipt (or similar) payment amounts to specific sales for invoice due and payment history.';

-- Recalculate one sale: direct sale-payments + manual_receipt allocations
CREATE OR REPLACE FUNCTION public.recalc_sale_payment_totals(p_sale_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(15, 2);
  v_studio NUMERIC(15, 2);
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

  v_grand := COALESCE(v_total, 0) + COALESCE(v_studio, 0);

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
  v_due := GREATEST(0, v_grand - v_paid);

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

COMMENT ON FUNCTION public.recalc_sale_payment_totals(UUID) IS 'Sets sales.paid_amount from sale-linked payments plus manual_receipt payment_allocations.';

CREATE OR REPLACE FUNCTION public.trg_payment_allocations_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    sid := OLD.sale_id;
  ELSE
    sid := NEW.sale_id;
  END IF;
  IF sid IS NOT NULL THEN
    PERFORM public.recalc_sale_payment_totals(sid);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.sale_id IS DISTINCT FROM NEW.sale_id AND OLD.sale_id IS NOT NULL THEN
    PERFORM public.recalc_sale_payment_totals(OLD.sale_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_allocations_recalc_ai ON public.payment_allocations;
DROP TRIGGER IF EXISTS trg_payment_allocations_recalc_au ON public.payment_allocations;
DROP TRIGGER IF EXISTS trg_payment_allocations_recalc_ad ON public.payment_allocations;

CREATE TRIGGER trg_payment_allocations_recalc_ai
  AFTER INSERT ON public.payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_payment_allocations_recalc();

CREATE TRIGGER trg_payment_allocations_recalc_au
  AFTER UPDATE ON public.payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_payment_allocations_recalc();

CREATE TRIGGER trg_payment_allocations_recalc_ad
  AFTER DELETE ON public.payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_payment_allocations_recalc();

-- Extend sale totals when sale-linked payments change (replace legacy behavior if present)
CREATE OR REPLACE FUNCTION public.update_sale_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_sale_id := OLD.reference_id;
  ELSE
    v_sale_id := NEW.reference_id;
  END IF;

  IF v_sale_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF (TG_OP = 'DELETE' AND OLD.reference_type = 'sale')
     OR (TG_OP <> 'DELETE' AND NEW.reference_type = 'sale') THEN
    PERFORM public.recalc_sale_payment_totals(v_sale_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_sale_totals_insert ON public.payments;
DROP TRIGGER IF EXISTS trigger_update_sale_totals_update ON public.payments;
DROP TRIGGER IF EXISTS trigger_update_sale_totals_delete ON public.payments;

CREATE TRIGGER trigger_update_sale_totals_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW
  WHEN (NEW.reference_type = 'sale')
  EXECUTE FUNCTION public.update_sale_payment_totals();

CREATE TRIGGER trigger_update_sale_totals_update
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  WHEN (NEW.reference_type = 'sale' OR OLD.reference_type = 'sale')
  EXECUTE FUNCTION public.update_sale_payment_totals();

CREATE TRIGGER trigger_update_sale_totals_delete
  AFTER DELETE ON public.payments
  FOR EACH ROW
  WHEN (OLD.reference_type = 'sale')
  EXECUTE FUNCTION public.update_sale_payment_totals();
