-- Repair rental return penalties posted as Dr Cash / Cr Income only (no party AR charge).
-- Adds Dr AR / Cr 4200 charge + Dr Cash / Cr AR receipt; voids legacy single-leg income JEs.

DO $$
DECLARE
  rec RECORD;
  v_ar_id uuid;
  v_inc_id uuid;
  v_pay_id uuid;
  v_charge_fp text;
  v_receipt_fp text;
  v_charge_je uuid;
  v_receipt_je uuid;
  v_entry_no text;
  v_desc text;
  v_company uuid;
  v_branch uuid;
  v_customer uuid;
  v_customer_name text;
BEGIN
  FOR rec IN
    SELECT
      rp.id AS rental_payment_id,
      rp.rental_id,
      rp.amount,
      rp.payment_date,
      rp.journal_entry_id AS old_je_id,
      rp.payment_account_id,
      r.company_id,
      r.branch_id,
      r.customer_id,
      r.booking_no,
      COALESCE(NULLIF(TRIM(c.name), ''), 'Customer') AS customer_name
    FROM public.rental_payments rp
    JOIN public.rentals r ON r.id = rp.rental_id
    LEFT JOIN public.contacts c ON c.id = r.customer_id
    WHERE COALESCE(rp.voided_at, NULL) IS NULL
      AND r.customer_id IS NOT NULL
      AND (
        lower(COALESCE(rp.payment_type, '')) = 'penalty'
        OR COALESCE(rp.reference, '') ~* 'penalty|damage|planty|plant'
      )
  LOOP
    v_company := rec.company_id;
    v_branch := rec.branch_id;
    v_customer := rec.customer_id;
    v_customer_name := rec.customer_name;
    v_charge_fp := 'rental_party_penalty_charge:' || v_company::text || ':' || rec.rental_id::text;
    v_receipt_fp := 'rental_party_penalty_payment:' || v_company::text || ':' || rec.rental_payment_id::text;

    SELECT a.id INTO v_ar_id
    FROM public.accounts a
    WHERE a.company_id = v_company
      AND a.is_active = true
      AND a.linked_contact_id = v_customer
    ORDER BY a.code NULLS LAST
    LIMIT 1;

    SELECT a.id INTO v_inc_id
    FROM public.accounts a
    WHERE a.company_id = v_company
      AND a.is_active = true
      AND a.code = '4200'
    ORDER BY
      CASE WHEN lower(COALESCE(a.name, '')) LIKE '%rental%' THEN 0 ELSE 1 END,
      a.code
    LIMIT 1;

    v_pay_id := rec.payment_account_id;
    IF v_pay_id IS NULL THEN
      SELECT a.id INTO v_pay_id
      FROM public.accounts a
      WHERE a.company_id = v_company
        AND a.is_active = true
        AND (
          lower(COALESCE(a.name, '')) LIKE '%cash%'
          OR lower(COALESCE(a.type, '')) IN ('cash', 'bank', 'asset')
        )
      ORDER BY CASE WHEN lower(COALESCE(a.name, '')) LIKE '%cash%' THEN 0 ELSE 1 END
      LIMIT 1;
    END IF;

    IF v_ar_id IS NULL OR v_inc_id IS NULL OR v_pay_id IS NULL OR rec.amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Void legacy Dr Cash / Cr Income penalty JE (no AR credit line)
    IF rec.old_je_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.journal_entry_lines jel
        JOIN public.accounts a ON a.id = jel.account_id
        WHERE jel.journal_entry_id = rec.old_je_id
          AND a.linked_contact_id = v_customer
          AND COALESCE(jel.credit, 0) > 0
      ) THEN
        UPDATE public.journal_entries
        SET is_void = true,
            void_reason = 'penalty_ar_repair',
            voided_at = COALESCE(voided_at, now())
        WHERE id = rec.old_je_id
          AND COALESCE(is_void, false) = false;
      END IF;
    END IF;

    -- Charge: Dr AR / Cr Rental Income
    SELECT je.id INTO v_charge_je
    FROM public.journal_entries je
    WHERE je.company_id = v_company
      AND je.action_fingerprint = v_charge_fp
    LIMIT 1;

    IF v_charge_je IS NULL THEN
      v_entry_no := 'JE-PEN-CHG-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
      v_desc := 'Rental penalty / damage — ' || v_customer_name;
      INSERT INTO public.journal_entries (
        company_id, branch_id, entry_no, entry_date, description,
        reference_type, reference_id, action_fingerprint, created_at
      ) VALUES (
        v_company, v_branch, v_entry_no, rec.payment_date::date, v_desc,
        'rental', rec.rental_id, v_charge_fp, now()
      )
      RETURNING id INTO v_charge_je;

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_charge_je, v_ar_id, rec.amount, 0, v_desc),
        (v_charge_je, v_inc_id, 0, rec.amount, v_desc);
    END IF;

    -- Receipt: Dr Cash/Bank / Cr AR
    SELECT je.id INTO v_receipt_je
    FROM public.journal_entries je
    WHERE je.company_id = v_company
      AND je.action_fingerprint = v_receipt_fp
    LIMIT 1;

    IF v_receipt_je IS NULL THEN
      v_entry_no := 'JE-PEN-RCV-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
      v_desc := 'Rental penalty receipt — ' || v_customer_name;
      INSERT INTO public.journal_entries (
        company_id, branch_id, entry_no, entry_date, description,
        reference_type, reference_id, action_fingerprint, created_at
      ) VALUES (
        v_company, v_branch, v_entry_no, rec.payment_date::date, v_desc,
        'rental', rec.rental_id, v_receipt_fp, now()
      )
      RETURNING id INTO v_receipt_je;

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES
        (v_receipt_je, v_pay_id, rec.amount, 0, v_desc),
        (v_receipt_je, v_ar_id, 0, rec.amount, v_desc);
    END IF;

    UPDATE public.rental_payments
    SET journal_entry_id = v_receipt_je
    WHERE id = rec.rental_payment_id;

    UPDATE public.rentals
    SET damage_charges = GREATEST(COALESCE(damage_charges, 0), rec.amount)
    WHERE id = rec.rental_id
      AND COALESCE(damage_charges, 0) < rec.amount;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
