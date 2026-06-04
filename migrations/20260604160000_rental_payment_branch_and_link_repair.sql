-- Rental payment / branch repair (labels + links only — no amount changes).
-- 1) Canonical REN-*-PAY reference on legacy rows
-- 2) payment_account_id from linked JE liquidity debit line
-- 3) journal_entry_id from payments row when missing
-- 4) branch_id on rental JEs and rental payments from document branch

-- Reference backfill (idempotent)
UPDATE rental_payments rp
SET reference = r.booking_no || '-PAY'
FROM rentals r
WHERE rp.rental_id = r.id
  AND r.booking_no ~ '^REN-'
  AND (
    rp.reference IS NULL
    OR btrim(rp.reference) = ''
    OR rp.reference ~* '^advance'
  );

-- payment_account_id from JE cash/bank/wallet debit leg
UPDATE rental_payments rp
SET payment_account_id = liq.account_id
FROM (
  SELECT DISTINCT ON (rp2.id)
    rp2.id AS rental_payment_id,
    jel.account_id
  FROM rental_payments rp2
  JOIN journal_entry_lines jel ON jel.journal_entry_id = rp2.journal_entry_id
  JOIN accounts a ON a.id = jel.account_id
  WHERE rp2.payment_account_id IS NULL
    AND rp2.journal_entry_id IS NOT NULL
    AND COALESCE(jel.debit, 0) > 0
    AND (
      lower(COALESCE(a.type, '')) IN ('cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos')
      OR trim(COALESCE(a.code, '')) IN ('1000', '1010', '1020')
      OR trim(COALESCE(a.code, '')) ~ '^102[0-9]*$'
    )
  ORDER BY rp2.id, jel.debit DESC
) liq
WHERE rp.id = liq.rental_payment_id;

-- Link rental_payments.journal_entry_id from payments → journal_entries when missing
UPDATE rental_payments rp
SET journal_entry_id = je.id
FROM payments p
JOIN journal_entries je ON je.payment_id = p.id
WHERE lower(COALESCE(p.reference_type, '')) = 'rental'
  AND p.reference_id = rp.rental_id
  AND p.payment_date = rp.payment_date
  AND abs(COALESCE(p.amount, 0) - COALESCE(rp.amount, 0)) < 0.02
  AND rp.journal_entry_id IS NULL
  AND COALESCE(je.is_void, false) = false;

-- Rental document branch → journal_entries.branch_id
UPDATE journal_entries je
SET branch_id = r.branch_id
FROM rentals r
WHERE je.reference_type = 'rental'
  AND je.reference_id = r.id
  AND r.branch_id IS NOT NULL
  AND je.branch_id IS NULL;

-- Rental document branch → payments.branch_id
UPDATE payments p
SET branch_id = r.branch_id
FROM rentals r
WHERE lower(COALESCE(p.reference_type, '')) = 'rental'
  AND p.reference_id = r.id
  AND r.branch_id IS NOT NULL
  AND p.branch_id IS NULL;
