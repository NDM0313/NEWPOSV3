-- Same-row lifecycle: draft_no / quotation_no / order_no hold stage numbers; invoice_no is final-only.
-- If a BEFORE INSERT trigger auto-fills invoice_no when it is NULL, it collides with global STD/SL numbering
-- and idx_sales_company_invoice_no_when_set. Skip auto-fill when any stage column is already set.

CREATE OR REPLACE FUNCTION public.set_sale_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_no IS NOT NULL AND TRIM(COALESCE(NEW.invoice_no, '')) <> '' THEN
    RETURN NEW;
  END IF;
  IF (NEW.draft_no IS NOT NULL AND TRIM(NEW.draft_no) <> '')
     OR (NEW.quotation_no IS NOT NULL AND TRIM(NEW.quotation_no) <> '')
     OR (NEW.order_no IS NOT NULL AND TRIM(NEW.order_no) <> '') THEN
    RETURN NEW;
  END IF;
  NEW.invoice_no := get_next_document_number(NEW.company_id, NEW.branch_id, 'sale');
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_sale_invoice_number() IS 'Auto-fill invoice_no only when no stage column is set; same-row lifecycle uses draft_no/quotation_no/order_no until final.';

DROP TRIGGER IF EXISTS trigger_set_sale_invoice_number ON public.sales;
CREATE TRIGGER trigger_set_sale_invoice_number
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sale_invoice_number();
