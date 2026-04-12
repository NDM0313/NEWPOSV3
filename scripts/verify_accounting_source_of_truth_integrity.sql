-- =============================================================================
-- SCRIPT 10: verify_accounting_source_of_truth_integrity.sql
-- Purpose:  Verify the GL as source of truth — balanced journal entries,
--           valid account references, fingerprint integrity, active JEs on
--           voided documents, orphan subledger accounts, AR control vs
--           subledger reconciliation, and trial balance check.
-- Tables:   journal_entries, journal_entry_lines, accounts, sales, purchases,
--           contacts, companies
-- Date:     2026-04-12
-- Safe:     SELECT only — no modifications made
-- =============================================================================

-- =============================================================================
-- CHECK 1: Unbalanced journal entries (SUM debit != SUM credit)
-- Expected: 0 rows — every journal entry must balance: total debits must
--           equal total credits. An unbalanced JE violates double-entry
--           accounting and will corrupt every report derived from the GL.
--           This is the most fundamental accounting integrity check.
--           Fix: void the unbalanced JE and re-post it correctly.
-- =============================================================================
SELECT
    'CHECK 1: Unbalanced journal entries (debit != credit)' AS check_name,
    je.id                                                    AS je_id,
    je.company_id,
    je.entry_no,
    je.entry_date,
    je.reference_type,
    je.reference_id,
    SUM(jel.debit)                                          AS total_debit,
    SUM(jel.credit)                                         AS total_credit,
    ABS(SUM(jel.debit) - SUM(jel.credit))                  AS imbalance,
    c.name                                                   AS company_name
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN companies           c   ON c.id = je.company_id
WHERE (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY je.id, je.company_id, je.entry_no, je.entry_date,
         je.reference_type, je.reference_id, c.name
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.001
ORDER BY imbalance DESC;

-- =============================================================================
-- CHECK 2: Journal entry lines with account_id referencing non-existent account
-- Expected: 0 rows — every journal_entry_lines.account_id must reference a
--           real accounts row in the same company. A dangling FK means the
--           amount cannot be attributed to any account and will be missing from
--           all financial reports. Fix: identify the correct account and update
--           the line, or void the JE if recovery is not possible.
-- =============================================================================
SELECT
    'CHECK 2: JE lines with non-existent account_id' AS check_name,
    jel.id                                             AS line_id,
    jel.journal_entry_id,
    jel.account_id,
    jel.debit,
    jel.credit,
    jel.description,
    je.company_id,
    je.entry_no,
    je.reference_type,
    c.name                                             AS company_name
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN companies       c  ON c.id  = je.company_id
WHERE NOT EXISTS (
    SELECT 1
    FROM accounts a
    WHERE a.id         = jel.account_id
      AND a.company_id = je.company_id
)
ORDER BY je.company_id, je.entry_no;

-- =============================================================================
-- CHECK 3: action_fingerprint integrity — fingerprint appearing in both
--          active and voided state
-- Expected: 0 rows — the UNIQUE partial index on action_fingerprint
--           (WHERE action_fingerprint IS NOT NULL AND (is_void IS NULL OR is_void = FALSE))
--           ensures that an active fingerprint is unique. However, if a
--           fingerprint was used on a JE that was later set to void, and then
--           used again on a new active JE, both would exist in the table.
--           This check detects that scenario, which would mean the index did
--           not fire correctly or was bypassed.
-- =============================================================================
SELECT
    'CHECK 3: Fingerprint in both active and voided JE' AS check_name,
    je_active.company_id,
    je_active.action_fingerprint,
    je_active.id                                         AS active_je_id,
    je_active.entry_no                                   AS active_entry_no,
    je_void.id                                           AS voided_je_id,
    je_void.entry_no                                     AS voided_entry_no,
    c.name                                               AS company_name
FROM journal_entries je_active
JOIN journal_entries je_void
    ON  je_void.action_fingerprint = je_active.action_fingerprint
    AND je_void.company_id         = je_active.company_id
    AND je_void.id                <> je_active.id
    AND je_void.is_void            = TRUE
JOIN companies c ON c.id = je_active.company_id
WHERE je_active.action_fingerprint IS NOT NULL
  AND (je_active.is_void IS NULL OR je_active.is_void = FALSE)
ORDER BY je_active.company_id, je_active.action_fingerprint;

-- =============================================================================
-- CHECK 4: Active JEs for voided/cancelled documents
-- Expected: 0 rows — when a sale or purchase is voided or cancelled, all its
--           GL journal entries must also be voided. An active JE on a void
--           document continues to affect account balances, causing the P&L
--           and balance sheet to be wrong.
--           Fix: void the JE via the document void workflow.
-- =============================================================================
-- 4a: Active sale JEs where the sale is voided/cancelled
SELECT
    'CHECK 4a: Active JEs for voided/cancelled sales' AS check_name,
    je.id                                              AS je_id,
    je.company_id,
    je.entry_no,
    je.reference_id                                    AS sale_id,
    je.entry_date,
    s.status                                           AS document_status,
    s.invoice_no,
    c.name                                             AS company_name
FROM journal_entries je
JOIN sales     s  ON s.id::TEXT = je.reference_id AND je.reference_type = 'sale'
JOIN companies c  ON c.id = je.company_id
WHERE (je.is_void IS NULL OR je.is_void = FALSE)
  AND s.status IN ('void', 'cancelled')
ORDER BY je.company_id, je.entry_date DESC;

-- 4b: Active purchase JEs where the purchase is voided/cancelled
SELECT
    'CHECK 4b: Active JEs for voided/cancelled purchases' AS check_name,
    je.id                                                  AS je_id,
    je.company_id,
    je.entry_no,
    je.reference_id                                        AS purchase_id,
    je.entry_date,
    p.status                                               AS document_status,
    c.name                                                 AS company_name
FROM journal_entries je
JOIN purchases p  ON p.id::TEXT = je.reference_id AND je.reference_type = 'purchase'
JOIN companies c  ON c.id = je.company_id
WHERE (je.is_void IS NULL OR je.is_void = FALSE)
  AND p.status IN ('void', 'cancelled')
ORDER BY je.company_id, je.entry_date DESC;

-- =============================================================================
-- CHECK 5: Accounts with type='party_subledger' but no linked_contact_id
-- Expected: 0 rows — every party subledger account must be linked to a contact.
--           Orphan subledger accounts accumulate balances that cannot be
--           attributed to any party and silently corrupt AR/AP aging reports.
--           (Duplicates check 3 in script 2, but included here for GL
--           completeness — run once and cross-reference both scripts.)
-- =============================================================================
SELECT
    'CHECK 5: Orphan party_subledger accounts (no contact)' AS check_name,
    a.id                                                      AS account_id,
    a.company_id,
    a.code,
    a.name,
    -- Show GL balance to indicate urgency
    COALESCE((
        SELECT SUM(jel.debit) - SUM(jel.credit)
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id = a.id
          AND (je.is_void IS NULL OR je.is_void = FALSE)
    ), 0)                                                     AS gl_balance,
    c.name                                                    AS company_name
FROM accounts  a
JOIN companies c ON c.id = a.company_id
WHERE a.type            = 'party_subledger'
  AND a.linked_contact_id IS NULL
ORDER BY ABS(COALESCE((
    SELECT SUM(jel.debit) - SUM(jel.credit)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = a.id
      AND (je.is_void IS NULL OR je.is_void = FALSE)
), 0)) DESC;

-- =============================================================================
-- CHECK 6: AR control account (1100) net balance vs sum of all AR subledger nets
-- Expected: variance should be < 1.00 for each company — the AR control
--           account balance must equal the sum of all individual customer
--           subledger balances. A variance (other than rounding) means a JE
--           posted directly to the control account without a matching subledger
--           entry, or vice versa. This breaks the AR reconciliation.
-- =============================================================================
WITH ar_control AS (
    SELECT
        je.company_id,
        SUM(jel.debit - jel.credit) AS control_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts        a  ON a.id  = jel.account_id
    WHERE a.code = '1100'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
    GROUP BY je.company_id
),
ar_subledgers AS (
    SELECT
        je.company_id,
        SUM(jel.debit - jel.credit) AS subledger_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts        a  ON a.id  = jel.account_id
    WHERE a.type = 'party_subledger'
      AND (je.is_void IS NULL OR je.is_void = FALSE)
    GROUP BY je.company_id
)
SELECT
    'CHECK 6: AR control vs subledger variance' AS check_name,
    ac.company_id,
    ac.control_balance,
    COALESCE(ars.subledger_balance, 0)          AS subledger_balance,
    ABS(ac.control_balance - COALESCE(ars.subledger_balance, 0)) AS variance,
    c.name                                      AS company_name
FROM ar_control ac
LEFT JOIN ar_subledgers ars ON ars.company_id = ac.company_id
JOIN companies          c   ON c.id = ac.company_id
WHERE ABS(ac.control_balance - COALESCE(ars.subledger_balance, 0)) > 1.00
ORDER BY variance DESC;

-- =============================================================================
-- CHECK 7: Trial balance check — SUM of all (Dr - Cr) for all accounts = 0
-- Expected: 0 rows (or the single row returned should show total_net = 0
--           for every company) — in a balanced double-entry system the sum
--           of all debit postings minus all credit postings across all accounts
--           must be exactly zero. Any non-zero result is a fundamental GL error
--           indicating one or more unbalanced journal entries. Cross-reference
--           with CHECK 1 to find the culprit JEs.
-- =============================================================================
SELECT
    'CHECK 7: Trial balance (should be 0 per company)' AS check_name,
    je.company_id,
    SUM(jel.debit)                                      AS total_all_debits,
    SUM(jel.credit)                                     AS total_all_credits,
    SUM(jel.debit) - SUM(jel.credit)                   AS total_net,
    c.name                                              AS company_name
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN companies       c  ON c.id  = je.company_id
WHERE (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY je.company_id, c.name
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01
ORDER BY ABS(SUM(jel.debit) - SUM(jel.credit)) DESC;
