-- detect_duplicate_payment_posting.sql
-- Read-only detector for PF-14 duplicate / suspect payment_adjustment journal chains.
--
-- Usage:
--   1) Optional: set company filter (replace UUID) in the CTE below, or remove the company predicate for full DB scan (heavy).
--   2) Run in SQL editor / psql against the same database as the app.
--
-- Flags:
--   • DUPLICATE_FINGERPRINT — two+ active JEs share the same action_fingerprint (idempotency bypass or manual duplicate insert).
--   • DUPLICATE_AMOUNT_DELTA — same payment_id + old_amount + new_amount on two+ amount-adjustment JEs.
--   • DUPLICATE_ACCOUNT_TRANSFER — same payment + old + new liquidity + amount on two+ transfer JEs.
--   • AMOUNT_ADJUSTMENT_MISSING_FINGERPRINT — legacy / manual rows; duplicate detection unreliable.

-- ---------------------------------------------------------------------------
-- 0) Optional scope (recommended for one company)
-- ---------------------------------------------------------------------------
-- Uncomment and set:
-- \set company_id 'YOUR_COMPANY_UUID'

-- ---------------------------------------------------------------------------
-- 1) Duplicate identical fingerprints (any reference_type)
-- ---------------------------------------------------------------------------
SELECT
  'DUPLICATE_FINGERPRINT' AS flag,
  company_id,
  action_fingerprint,
  COUNT(*)::int AS je_count,
  array_agg(id ORDER BY created_at) AS journal_entry_ids
FROM journal_entries
WHERE (is_void IS NULL OR is_void = false)
  AND action_fingerprint IS NOT NULL
  AND TRIM(action_fingerprint) <> ''
  -- AND company_id = :'company_id'
GROUP BY company_id, action_fingerprint
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ---------------------------------------------------------------------------
-- 2) Duplicate amount deltas: same payment + old + new (parsed from fingerprint)
--    Format: payment_adjustment_amount:companyId:paymentId:oldAmt:newAmt:liquidityId
-- ---------------------------------------------------------------------------
WITH adj AS (
  SELECT
    id,
    company_id,
    payment_id,
    reference_id,
    action_fingerprint,
    created_at,
    split_part(action_fingerprint, ':', 3) AS fp_payment_id,
    split_part(action_fingerprint, ':', 4) AS fp_old_amt,
    split_part(action_fingerprint, ':', 5) AS fp_new_amt
  FROM journal_entries
  WHERE (is_void IS NULL OR is_void = false)
    AND reference_type = 'payment_adjustment'
    AND action_fingerprint LIKE 'payment_adjustment_amount:%'
    -- AND company_id = :'company_id'
)
SELECT
  'DUPLICATE_AMOUNT_DELTA' AS flag,
  company_id,
  fp_payment_id AS payment_id,
  fp_old_amt,
  fp_new_amt,
  COUNT(*)::int AS je_count,
  array_agg(id ORDER BY created_at) AS journal_entry_ids
FROM adj
WHERE fp_payment_id <> ''
GROUP BY company_id, fp_payment_id, fp_old_amt, fp_new_amt
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ---------------------------------------------------------------------------
-- 3) Duplicate account transfers: same payment + accounts + amount
--    Format: payment_adjustment_account:companyId:paymentId:oldAid:newAid:amount
-- ---------------------------------------------------------------------------
WITH tr AS (
  SELECT
    id,
    company_id,
    created_at,
    split_part(action_fingerprint, ':', 3) AS fp_payment_id,
    split_part(action_fingerprint, ':', 4) AS fp_old_aid,
    split_part(action_fingerprint, ':', 5) AS fp_new_aid,
    split_part(action_fingerprint, ':', 6) AS fp_amount
  FROM journal_entries
  WHERE (is_void IS NULL OR is_void = false)
    AND reference_type = 'payment_adjustment'
    AND action_fingerprint LIKE 'payment_adjustment_account:%'
    -- AND company_id = :'company_id'
)
SELECT
  'DUPLICATE_ACCOUNT_TRANSFER' AS flag,
  company_id,
  fp_payment_id AS payment_id,
  fp_old_aid,
  fp_new_aid,
  fp_amount,
  COUNT(*)::int AS je_count,
  array_agg(id ORDER BY created_at) AS journal_entry_ids
FROM tr
WHERE fp_payment_id <> ''
GROUP BY company_id, fp_payment_id, fp_old_aid, fp_new_aid, fp_amount
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ---------------------------------------------------------------------------
-- 4) Amount adjustments with empty fingerprint (warn)
-- ---------------------------------------------------------------------------
SELECT
  'AMOUNT_ADJUSTMENT_MISSING_FINGERPRINT' AS flag,
  id,
  company_id,
  payment_id,
  reference_id,
  entry_no,
  created_at,
  description
FROM journal_entries
WHERE (is_void IS NULL OR is_void = false)
  AND reference_type = 'payment_adjustment'
  AND (action_fingerprint IS NULL OR TRIM(COALESCE(action_fingerprint, '')) = '')
  AND description ILIKE '%payment edited%'
  -- AND company_id = :'company_id'
ORDER BY created_at DESC
LIMIT 500;
