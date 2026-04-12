-- repair_bad_payment_edit_chains.sql
--
-- PURPOSE: Controlled repair playbook for bad PF-14 payment edit chains — **dry-run first only**.
-- This file does NOT delete or void rows by default. It only documents patterns and provides
-- commented templates. Operators must:
--   1) Run scripts/detect_duplicate_payment_posting.sql and Truth Lab / verify-payment-mutation-chain.sql.
--   2) Classify each bad JE (historical wrong-liquidity delta vs double-post vs orphan).
--   3) Prefer voiding with is_void + reversal_link, or posting explicit reversing JEs — never silent DELETE.
--
-- RULES (from product audit):
--   • Do not silently delete journal_entries / journal_entry_lines.
--   • Preserve auditability: document reason in journal description or activity log.
--   • After repair, re-run detect script and AR/AP Truth Lab expected-vs-actual for the payment_id.

-- ---------------------------------------------------------------------------
-- A) List candidate payments: multiple payment_adjustment JEs (review only)
-- ---------------------------------------------------------------------------
SELECT
  COALESCE(je.payment_id, je.reference_id) AS payment_id,
  COUNT(*)::int AS adjustment_je_count,
  array_agg(je.id ORDER BY je.created_at) AS je_ids
FROM journal_entries je
WHERE (je.is_void IS NULL OR je.is_void = false)
  AND je.reference_type = 'payment_adjustment'
  -- AND je.company_id = 'COMPANY_UUID_HERE'
GROUP BY COALESCE(je.payment_id, je.reference_id)
HAVING COUNT(*) > 3
ORDER BY COUNT(*) DESC
LIMIT 200;

-- ---------------------------------------------------------------------------
-- B) Per-payment listing (replace PAYMENT_UUID_HERE)
-- ---------------------------------------------------------------------------
-- SELECT id, entry_no, entry_date, reference_type, payment_id, reference_id, action_fingerprint, description, created_at
-- FROM journal_entries
-- WHERE company_id = (SELECT company_id FROM payments WHERE id = 'PAYMENT_UUID_HERE')
--   AND (payment_id = 'PAYMENT_UUID_HERE' OR reference_id = 'PAYMENT_UUID_HERE')
--   AND (is_void IS NULL OR is_void = false)
-- ORDER BY created_at;

-- ---------------------------------------------------------------------------
-- C) OPTIONAL repair patterns (keep commented — uncomment only after written approval)
-- ---------------------------------------------------------------------------
--
-- C1) Void a duplicate JE (if your schema supports is_void / voided_at — match production columns):
--
-- BEGIN;
-- UPDATE journal_entries
-- SET is_void = true, voided_at = NOW(), void_reason = 'Duplicate PF-14 post; voided per repair_bad_payment_edit_chains playbook'
-- WHERE id = 'JOURNAL_ENTRY_UUID' AND company_id = 'COMPANY_UUID';
-- COMMIT;
--
-- C2) Post a manual reversing entry (preferred when void flags are not used): use the in-app
--     journal entry screen or a one-off RPC with full approval — do not run anonymous UPDATEs on lines.
--
-- C3) Wrong-liquidity historical delta: often requires void of the bad delta + one correct delta
--     with fingerprint payment_adjustment_amount:...:OLD_LIQUIDITY_UUID — confirm with
--     docs/accounting/HOTFIX_PAYMENT_EDIT_ORDERING_AND_ACCOUNT_STATEMENT_PRESENTATION.md

-- ---------------------------------------------------------------------------
-- D) Verification after any repair
-- ---------------------------------------------------------------------------
-- See scripts/verify-payment-mutation-chain.sql for nets on liquidity + AR.
