-- Apply: rename canonical SL-0003 → SL-0017 for DIN BRIDAL (597a5292-...)
-- Run once on production after review. Idempotent guard: skips if old not found.

BEGIN;

DO $$
DECLARE
  v_sale_id UUID;
  v_company_id UUID := '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';
  v_old TEXT := 'SL-0003';
  v_new TEXT := 'SL-0017';
BEGIN
  SELECT id INTO v_sale_id
  FROM public.sales
  WHERE company_id = v_company_id
    AND invoice_no = v_old
    AND invoice_no ~ '^SL-[0-9]+$'
  FOR UPDATE;

  IF v_sale_id IS NULL THEN
    RAISE NOTICE 'Sale % not found — already renamed or missing', v_old;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sales
    WHERE company_id = v_company_id AND invoice_no = v_new AND id <> v_sale_id
  ) THEN
    RAISE EXCEPTION 'Target invoice % already exists for company', v_new;
  END IF;

  UPDATE public.sales
  SET invoice_no = v_new,
      updated_at = NOW()
  WHERE id = v_sale_id;

  UPDATE public.journal_entries je
  SET document_no = CASE WHEN je.document_no = v_old THEN v_new ELSE je.document_no END,
      description = REPLACE(je.description, v_old, v_new)
  WHERE je.reference_id = v_sale_id
    AND je.reference_type IN ('sale', 'sale_return', 'sale_adjustment', 'sale_extra_expense');

  UPDATE public.journal_entry_lines jel
  SET description = REPLACE(jel.description, v_old, v_new)
  FROM public.journal_entries je
  WHERE je.id = jel.journal_entry_id
    AND je.reference_id = v_sale_id
    AND je.reference_type IN ('sale', 'sale_return', 'sale_adjustment', 'sale_extra_expense')
    AND jel.description LIKE '%' || v_old || '%';

  UPDATE public.payments p
  SET reference_number = CASE WHEN p.reference_number = v_old THEN v_new ELSE p.reference_number END,
      notes = REPLACE(COALESCE(p.notes, ''), v_old, v_new)
  WHERE p.reference_id = v_sale_id
    AND p.reference_type = 'sale';

  UPDATE public.document_sequences_global dsg
  SET current_number = GREATEST(
        dsg.current_number,
        (REGEXP_REPLACE(v_new, '^SL-', ''))::INTEGER
      ),
      updated_at = NOW()
  WHERE dsg.company_id = v_company_id
    AND dsg.document_type = 'SL';

  RAISE NOTICE 'Renamed sale % from % to %', v_sale_id, v_old, v_new;
END $$;

COMMIT;
