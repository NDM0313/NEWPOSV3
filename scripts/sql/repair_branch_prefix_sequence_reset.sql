-- ============================================================================
-- MANUAL ONLY: Repair branch-prefix sequence reset victims.
-- Run AFTER backup: bash deploy/backup-supabase-db.sh
-- Usage:
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     -v company_id=597a5292-14c8-4cd8-96bd-c61b5a0d8c92 \
--     < scripts/sql/repair_branch_prefix_sequence_reset.sql
-- ============================================================================

\echo '=== BEFORE: erp_document_sequences (RCV/PAY/EXP) ==='
SELECT branch_id, document_type, prefix, year, last_number, include_branch_code
FROM public.erp_document_sequences
WHERE company_id = :'company_id'::uuid
  AND document_type IN ('CUSTOMER_RECEIPT', 'PAYMENT', 'EXPENSE')
ORDER BY document_type, branch_id;

\echo '=== BEFORE: recent RCV refs (payments + rental_payments) ==='
SELECT 'payments' AS src, reference_number AS ref, payment_date, amount
FROM public.payments
WHERE company_id = :'company_id'::uuid
  AND payment_type = 'received'
  AND reference_number ~* '(^|-)RCV-'
ORDER BY payment_date DESC, created_at DESC
LIMIT 20;

SELECT 'rental_payments' AS src, rp.reference AS ref, rp.payment_date, rp.amount, r.booking_no
FROM public.rental_payments rp
JOIN public.rentals r ON r.id = rp.rental_id
WHERE r.company_id = :'company_id'::uuid
  AND rp.voided_at IS NULL
  AND rp.reference ~* '(^|-)RCV-'
ORDER BY rp.payment_date DESC
LIMIT 20;

\echo '=== BEFORE: duplicate refs ==='
SELECT ref, COUNT(*) AS cnt
FROM (
  SELECT reference_number AS ref FROM public.payments
  WHERE company_id = :'company_id'::uuid AND reference_number IS NOT NULL
  UNION ALL
  SELECT rp.reference AS ref FROM public.rental_payments rp
  JOIN public.rentals r ON r.id = rp.rental_id
  WHERE r.company_id = :'company_id'::uuid AND rp.voided_at IS NULL AND rp.reference IS NOT NULL
) u
GROUP BY ref
HAVING COUNT(*) > 1;

\echo '=== SYNC sequences to effective max ==='
SELECT public.sync_erp_document_sequences_to_effective_max(:'company_id'::uuid, 'CUSTOMER_RECEIPT');
SELECT public.sync_erp_document_sequences_to_effective_max(:'company_id'::uuid, 'PAYMENT');
SELECT public.sync_erp_document_sequences_to_effective_max(:'company_id'::uuid, 'EXPENSE');

\echo '=== REPAIR: reset-victim rental_payments (duplicate ref only) ==='
CREATE TEMP TABLE _rcv_repair_map (
  rental_payment_id UUID,
  old_reference TEXT,
  new_reference TEXT,
  amount NUMERIC,
  booking_no TEXT
) ON COMMIT DROP;

DO $repair$
DECLARE
  rec RECORD;
  v_company UUID := :'company_id'::uuid;
  v_new_ref TEXT;
  v_dup_count INTEGER;
  v_branch_id UUID;
BEGIN
  FOR rec IN
    SELECT
      rp.id,
      rp.reference,
      rp.amount,
      r.booking_no,
      r.branch_id
    FROM public.rental_payments rp
    JOIN public.rentals r ON r.id = rp.rental_id
    WHERE r.company_id = v_company
      AND rp.voided_at IS NULL
      AND rp.reference IS NOT NULL
      AND btrim(rp.reference) <> ''
      AND rp.reference ~* '(^|-)RCV-'
  LOOP
    SELECT COUNT(*) INTO v_dup_count
    FROM (
      SELECT reference_number AS ref FROM public.payments
      WHERE company_id = v_company AND reference_number = rec.reference
      UNION ALL
      SELECT rp2.reference FROM public.rental_payments rp2
      JOIN public.rentals r2 ON r2.id = rp2.rental_id
      WHERE r2.company_id = v_company AND rp2.voided_at IS NULL AND rp2.reference = rec.reference
    ) d;

    IF v_dup_count > 1 THEN
      v_branch_id := rec.branch_id;
      v_new_ref := public.generate_document_number(v_company, v_branch_id, 'customer_receipt', false);

      INSERT INTO _rcv_repair_map (rental_payment_id, old_reference, new_reference, amount, booking_no)
      VALUES (rec.id, rec.reference, v_new_ref, rec.amount, rec.booking_no);

      UPDATE public.rental_payments SET reference = v_new_ref WHERE id = rec.id;

      UPDATE public.payments p
      SET reference_number = v_new_ref
      WHERE p.company_id = v_company
        AND p.reference_type = 'rental'
        AND p.reference_number = rec.reference
        AND p.amount = rec.amount;
    END IF;
  END LOOP;
END $repair$;

\echo '=== REPAIR MAP (old_reference -> new_reference) ==='
SELECT * FROM _rcv_repair_map ORDER BY booking_no, amount;

\echo '=== AFTER: erp_document_sequences ==='
SELECT branch_id, document_type, prefix, year, last_number
FROM public.erp_document_sequences
WHERE company_id = :'company_id'::uuid
  AND document_type IN ('CUSTOMER_RECEIPT', 'PAYMENT', 'EXPENSE')
ORDER BY document_type, branch_id;
