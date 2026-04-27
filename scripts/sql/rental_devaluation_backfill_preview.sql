-- Rental dress devaluation — read-only preview for DBA / QA
-- Legacy pattern: journal_entries linked to rentals with Dr 5300/6100 and Cr 1000/1010/1020 (cash-like).
-- Preferred fix: use ERP **Accounting Integrity Lab → tab G · Rental GL repair** (reversal + correct JE),
-- not blind UPDATE of journal_entry_lines.
--
-- Replace YOUR_COMPANY_UUID below (twice) before running.

-- ─── Preview: candidate headers ─────────────────────────────────────────────
SELECT
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id AS rental_id,
  je.description,
  je.action_fingerprint,
  r.booking_no,
  r.customer_id,
  r.customer_name
FROM journal_entries je
JOIN rentals r ON r.id = je.reference_id AND r.company_id = je.company_id
WHERE je.company_id = 'YOUR_COMPANY_UUID'
  AND COALESCE(je.is_void, false) = false
  AND (
    (je.reference_type = 'expense' AND je.reference_id = r.id)
    OR je.action_fingerprint LIKE 'rental_booking_expense:%'
    OR je.description ILIKE '%rental expense%'
  )
ORDER BY je.entry_date DESC
LIMIT 500;

-- ─── Preview: line detail with account codes (join in app or second query) ─
-- Example for one journal_entry_id:
-- SELECT jel.id, jel.debit, jel.credit, a.code, a.name
-- FROM journal_entry_lines jel
-- JOIN accounts a ON a.id = jel.account_id
-- WHERE jel.journal_entry_id = '...' AND a.company_id = 'YOUR_COMPANY_UUID';

-- ─── Apply template (DO NOT run blindly): BEGIN … ROLLBACK dry-run ──────────
-- 1) Post correction_reversal via app (accountingService.createReversalEntry) OR controlled RPC.
-- 2) Post new JE: Dr Rental Income (4200), Cr party AR (1100 child for rentals.customer_id),
--    reference_type = 'rental', reference_id = rental.id,
--    action_fingerprint = 'rental_party_devaluation_repair:' || company_id || ':' || original_journal_entry_id
--
-- BEGIN;
--   -- DBA-owned statements here (reversal + insert), validated against preview above.
-- ROLLBACK;  -- change to COMMIT only after independent verification
