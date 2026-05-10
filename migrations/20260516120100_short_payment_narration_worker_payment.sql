-- Short narration + JE description sync: worker_payment (WPY) uses worker name from contacts.
-- Apply after 20260516120000_worker_payment_wpy_record_payment.sql and 20260509150000_short_payment_narration.

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
BEGIN
  v_action := CASE WHEN NEW.payment_type = 'received' THEN 'Receipt' ELSE 'Payment' END;
  v_source_doc := NULLIF(btrim(COALESCE(NEW.reference_number, '')), '');
  v_contact_name := NULL;
  v_manual_note := NULLIF(btrim(COALESCE(NEW.notes, '')), '');

  IF NEW.reference_type = 'sale' AND NEW.reference_id IS NOT NULL THEN
    SELECT NULLIF(btrim(COALESCE(s.invoice_no, s.order_no, s.draft_no, '')), ''),
           NULLIF(btrim(COALESCE(s.customer_name, '')), '')
      INTO v_source_doc, v_contact_name
    FROM public.sales s
    WHERE s.id = NEW.reference_id;
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

CREATE OR REPLACE FUNCTION public.sync_payment_short_narration_to_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_notes TEXT;
BEGIN
  IF lower(COALESCE(NEW.reference_type, '')) NOT IN ('payment', 'worker_payment') THEN
    RETURN NEW;
  END IF;

  SELECT p.notes INTO v_payment_notes
  FROM public.payments p
  WHERE p.id = COALESCE(NEW.payment_id, NEW.reference_id);

  IF v_payment_notes IS NOT NULL AND btrim(v_payment_notes) <> '' THEN
    NEW.description := v_payment_notes;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
