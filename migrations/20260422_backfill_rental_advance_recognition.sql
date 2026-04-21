-- =============================================================================
-- BACKFILL: Recognize unreleased Rental Advance as Rental Income
-- 6 returned rentals where advance was received but never converted to income
-- Dr Rental Advance (2020)  b97956a5-2982-455b-8a43-2b685a7726e8
-- Cr Rental Income  (4200)  6dbb9613-38d4-409e-80b9-5cc8c8e6261f
-- Company: 375fa03b-8e1e-46d3-9cfe-1cc20c02b473
-- Branch:  e868a96c-8016-48be-a67a-79673a6b5ec6
-- Total:   Rs 130,000
-- =============================================================================

DO $$
DECLARE
  v_company  UUID := '375fa03b-8e1e-46d3-9cfe-1cc20c02b473';
  v_branch   UUID := 'e868a96c-8016-48be-a67a-79673a6b5ec6';
  v_adv_acct UUID := 'b97956a5-2982-455b-8a43-2b685a7726e8';
  v_inc_acct UUID := '6dbb9613-38d4-409e-80b9-5cc8c8e6261f';
  v_today    DATE := CURRENT_DATE;
  v_je_id    UUID;

  v_rental_id     UUID;
  v_booking_no    TEXT;
  v_customer_name TEXT;
  v_amount        NUMERIC;
  v_entry_no      TEXT;
BEGIN
  -- Safety: skip if already backfilled
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE company_id = v_company
      AND reference_type = 'rental'
      AND entry_no IN ('JE-0186','JE-0187','JE-0188','JE-0189','JE-0190','JE-0191')
  ) THEN
    RAISE NOTICE 'Backfill already applied — skipping.';
    RETURN;
  END IF;

  FOR v_rental_id, v_booking_no, v_customer_name, v_amount, v_entry_no IN
    VALUES
      ('beadffc9-0032-43db-b89e-65bd74880555'::UUID, 'REN-0004', 'Nadeem', 25000.00::NUMERIC, 'JE-0186'),
      ('4f82733e-eaf4-4c5f-982d-6e5c82111ea1'::UUID, 'REN-0008', 'ABC',     5000.00::NUMERIC, 'JE-0187'),
      ('b7cf2bd8-649b-41df-97f0-541b7ffaa1bb'::UUID, 'REN-0011', 'Nadeem', 35000.00::NUMERIC, 'JE-0188'),
      ('b26ea51a-720a-46c0-84ec-723f2e0896bf'::UUID, 'REN-0017', 'Salar',  25000.00::NUMERIC, 'JE-0189'),
      ('f51cce30-2350-4f66-ad48-d888ac83387e'::UUID, 'REN-0018', 'Ali',    25000.00::NUMERIC, 'JE-0190'),
      ('1ba40c66-9182-414d-a989-20fec426444a'::UUID, 'REN-0019', 'ABC',    15000.00::NUMERIC, 'JE-0191')
  LOOP
    INSERT INTO journal_entries (
      id, company_id, branch_id, entry_no, entry_date,
      description, reference_type, reference_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_company, v_branch, v_entry_no, v_today,
      'Advance recognized as income - ' || v_customer_name,
      'rental', v_rental_id, NOW(), NOW()
    )
    RETURNING id INTO v_je_id;

    INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit, description, created_at)
    VALUES (gen_random_uuid(), v_je_id, v_adv_acct, v_amount, 0,
            'Advance recognized - ' || v_booking_no, NOW());

    INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit, description, created_at)
    VALUES (gen_random_uuid(), v_je_id, v_inc_acct, 0, v_amount,
            'Advance recognized - ' || v_booking_no, NOW());

    RAISE NOTICE 'Posted % — % — Rs %', v_entry_no, v_booking_no, v_amount;
  END LOOP;

  RAISE NOTICE 'Backfill complete. Total recognized: Rs 130,000';
END $$;
