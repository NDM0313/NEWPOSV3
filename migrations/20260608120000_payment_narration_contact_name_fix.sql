-- Resolve customer contact name for payment narration when sales.customer_name is walk-in placeholder.
-- Safe: replaces trigger function only; no table/column drops.

CREATE OR REPLACE FUNCTION public.format_short_payment_narration_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_action TEXT;
  v_source_doc TEXT;
  v_contact_name TEXT;
  v_manual_note TEXT;
  v_clean_note TEXT;
  v_sale_customer_id UUID;
BEGIN
  v_action := CASE WHEN NEW.payment_type = 'received' THEN 'Receipt' ELSE 'Payment' END;
  v_source_doc := NULLIF(btrim(COALESCE(NEW.reference_number, '')), '');
  v_contact_name := NULL;
  v_manual_note := NULLIF(btrim(COALESCE(NEW.notes, '')), '');

  IF NEW.reference_type = 'sale' AND NEW.reference_id IS NOT NULL THEN
    SELECT NULLIF(btrim(COALESCE(s.invoice_no, s.order_no, s.draft_no, '')), ''),
           NULLIF(btrim(COALESCE(s.customer_name, '')), ''),
           s.customer_id
      INTO v_source_doc, v_contact_name, v_sale_customer_id
    FROM public.sales s
    WHERE s.id = NEW.reference_id;

    IF v_contact_name IS NOT NULL AND lower(v_contact_name) IN (
      'walk-in', 'walk in', 'walk-in customer', 'walk in customer', 'walkin', 'walkin customer'
    ) THEN
      v_contact_name := NULL;
    END IF;

    IF v_contact_name IS NULL AND v_sale_customer_id IS NOT NULL THEN
      SELECT NULLIF(btrim(COALESCE(c.name, '')), '')
        INTO v_contact_name
      FROM public.contacts c
      WHERE c.id = v_sale_customer_id;
    END IF;
  ELSIF NEW.reference_type = 'purchase' AND NEW.reference_id IS NOT NULL THEN
    SELECT NULLIF(btrim(COALESCE(p.po_no, p.order_no, p.draft_no, '')), ''),
           NULLIF(btrim(COALESCE(p.supplier_name, '')), '')
      INTO v_source_doc, v_contact_name
    FROM public.purchases p
    WHERE p.id = NEW.reference_id;
  ELSIF NEW.reference_type = 'worker_payment' AND NEW.reference_id IS NOT NULL THEN
    v_source_doc := NULLIF(btrim(COALESCE(NEW.reference_number, '')), '');
    SELECT NULLIF(btrim(COALESCE(c.name, '')), '')
      INTO v_contact_name
    FROM public.contacts c
    WHERE c.id = NEW.reference_id;
  END IF;

  IF v_contact_name IS NULL AND NEW.contact_id IS NOT NULL THEN
    SELECT NULLIF(btrim(COALESCE(c.name, '')), '')
      INTO v_contact_name
    FROM public.contacts c
    WHERE c.id = NEW.contact_id;
  END IF;

  v_source_doc := COALESCE(v_source_doc, NULLIF(btrim(COALESCE(NEW.reference_number, '')), ''), 'UNSPECIFIED');
  v_contact_name := COALESCE(v_contact_name, 'Walk-in Customer');

  v_clean_note := v_manual_note;
  IF v_clean_note IS NOT NULL THEN
    IF v_clean_note ~* '^(Receipt|Payment)\s+.+\([^)]+\)\s*-\s*' THEN
      v_clean_note := btrim(regexp_replace(v_clean_note, '^(Receipt|Payment)\s+.+\([^)]+\)\s*-\s*', '', 'i'));
    END IF;
    v_clean_note := btrim(regexp_replace(v_clean_note, '^(Payment received from customer|Customer receipt from|Payment paid to supplier)[^.]*\.\s*', '', 'i'));
    v_clean_note := btrim(regexp_replace(v_clean_note, '^Invoice/ref:\s*[^.]+\.\s*', '', 'i'));
    IF v_clean_note = '' THEN
      v_clean_note := NULL;
    END IF;
  END IF;

  NEW.notes := CASE
    WHEN v_clean_note IS NULL THEN format('%s %s (%s)', v_action, v_source_doc, v_contact_name)
    ELSE format('%s %s (%s) - %s', v_action, v_source_doc, v_contact_name, v_clean_note)
  END;

  RETURN NEW;
END;
$$;

-- Repair recent mis-labeled walk-in narrations when a real contact exists on the payment or sale.
-- (Subquery form: PostgreSQL forbids referencing UPDATE target alias "p" inside FROM JOIN ON clauses.)
UPDATE public.payments p
SET notes = repair.new_notes
FROM (
  SELECT
    p2.id,
    regexp_replace(
      p2.notes,
      '\(Walk-in Customer\)',
      '(' || COALESCE(
        NULLIF(btrim(c_pay.name), ''),
        NULLIF(btrim(c_sale.name), ''),
        'Walk-in Customer'
      ) || ')',
      'g'
    ) AS new_notes
  FROM public.payments p2
  INNER JOIN public.sales s ON p2.reference_type = 'sale' AND p2.reference_id = s.id
  LEFT JOIN public.contacts c_pay ON c_pay.id = p2.contact_id
  LEFT JOIN public.contacts c_sale ON c_sale.id = s.customer_id
  WHERE p2.notes LIKE '%(Walk-in Customer)%'
    AND COALESCE(NULLIF(btrim(c_pay.name), ''), NULLIF(btrim(c_sale.name), '')) IS NOT NULL
    AND p2.voided_at IS NULL
    AND p2.payment_date >= (CURRENT_DATE - INTERVAL '365 days')
) repair
WHERE p.id = repair.id;
