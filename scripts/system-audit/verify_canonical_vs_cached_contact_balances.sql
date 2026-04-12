-- verify_canonical_vs_cached_contact_balances.sql
-- Purpose: Identify contacts whose cached current_balance diverges from the
--          canonical GL balance derived from journal_entry_lines.
-- Severity: P1 — contacts.current_balance is written by triggers AND manual
--           service calls; divergence causes incorrect balance displays in
--           ContactsPage.tsx and AddEntryV2.tsx.
-- Run: read-only; no writes.
-- Expected output: zero rows if caches are fully in sync.

WITH gl_balances AS (
    -- Canonical balance per contact: sum of debits minus credits across all
    -- journal entry lines posted to that contact's linked subledger account.
    SELECT
        a.linked_contact_id          AS contact_id,
        SUM(
            CASE
                WHEN jel.entry_type = 'debit'  THEN  jel.amount
                WHEN jel.entry_type = 'credit' THEN -jel.amount
                ELSE 0
            END
        )                            AS gl_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je
        ON je.id = jel.journal_entry_id
    JOIN accounts a
        ON a.id = jel.account_id
    WHERE
        a.linked_contact_id IS NOT NULL
        AND (je.is_void IS NULL OR je.is_void = FALSE)
    GROUP BY a.linked_contact_id
),
cached_balances AS (
    -- Cached balance stored directly on the contacts row.
    SELECT
        id                               AS contact_id,
        name                             AS contact_name,
        COALESCE(current_balance, 0)     AS cached_balance
    FROM contacts
)
SELECT
    cb.contact_id,
    cb.contact_name,
    cb.cached_balance,
    COALESCE(gl.gl_balance, 0)                                  AS gl_balance,
    cb.cached_balance - COALESCE(gl.gl_balance, 0)              AS divergence,
    ABS(cb.cached_balance - COALESCE(gl.gl_balance, 0))         AS abs_divergence
FROM cached_balances cb
LEFT JOIN gl_balances gl
    ON gl.contact_id = cb.contact_id
WHERE
    ABS(cb.cached_balance - COALESCE(gl.gl_balance, 0)) > 0.005
ORDER BY abs_divergence DESC;
