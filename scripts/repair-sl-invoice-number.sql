-- Repair canonical SL-0003 → SL-0017 (or custom target) for one sale row.
-- Run SELECT preview first; then uncomment BEGIN/COMMIT block after review.
-- Does NOT touch HQ-SL-* (separate historical format).

-- ─── Configure ───
\set old_invoice 'SL-0003'
\set new_invoice 'SL-0017'

-- ─── Preview: sale to repair ───
SELECT id, company_id, invoice_no, invoice_date, status, total, created_at, branch_id, salesman_id
FROM public.sales
WHERE invoice_no = :'old_invoice'
  AND invoice_no ~ '^SL-[0-9]+$';

-- ─── Preview: target must be free ───
SELECT EXISTS (
  SELECT 1 FROM public.sales WHERE invoice_no = :'new_invoice'
) AS new_invoice_taken;

-- ─── Preview: linked journal entries ───
SELECT je.id, je.entry_no, je.document_no, je.reference_type, je.reference_id, je.description
FROM public.journal_entries je
JOIN public.sales s ON s.id = je.reference_id
WHERE s.invoice_no = :'old_invoice'
  AND s.invoice_no ~ '^SL-[0-9]+$'
  AND je.reference_type IN ('sale', 'sale_return', 'sale_adjustment', 'sale_extra_expense');

-- ─── Preview: linked payments ───
SELECT p.id, p.reference_number, p.reference_type, p.reference_id, p.amount
FROM public.payments p
JOIN public.sales s ON s.id = p.reference_id
WHERE s.invoice_no = :'old_invoice'
  AND s.invoice_no ~ '^SL-[0-9]+$'
  AND p.reference_type = 'sale';

-- ─── Apply (uncomment after preview) ───
/*
BEGIN;

DO $$
DECLARE
  v_sale_id UUID;
  v_company_id UUID;
  v_old TEXT := 'SL-0003';
  v_new TEXT := 'SL-0017';
BEGIN
  SELECT id, company_id INTO v_sale_id, v_company_id
  FROM public.sales
  WHERE invoice_no = v_old
    AND invoice_no ~ '^SL-[0-9]+$'
  FOR UPDATE;

  IF v_sale_id IS NULL THEN
    RAISE EXCEPTION 'Sale % not found (canonical SL pattern only)', v_old;
  END IF;

  IF EXISTS (SELECT 1 FROM public.sales WHERE company_id = v_company_id AND invoice_no = v_new) THEN
    RAISE EXCEPTION 'Target invoice % already exists for company', v_new;
  END IF;

  UPDATE public.sales
  SET invoice_no = v_new,
      updated_at = NOW()
  WHERE id = v_sale_id;

  UPDATE public.journal_entries je
  SET document_no = CASE
        WHEN je.document_no = v_old THEN v_new
        ELSE je.document_no
      END,
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
  SET reference_number = CASE
        WHEN p.reference_number = v_old THEN v_new
        ELSE p.reference_number
      END,
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
*/

-- Rollback: swap old/new in the DO block and re-run.
