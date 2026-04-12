-- =============================================================================
-- SCRIPT 2: verify_contacts_and_party_linking.sql
-- Purpose:  Verify that every customer/supplier contact is properly linked to
--           its GL subledger account, subledger accounts are not orphaned,
--           and the contacts.current_balance field agrees with the GL (within
--           tolerance). contacts.current_balance is legacy and NOT authoritative
--           — the GL (journal_entry_lines) is the source of truth.
-- Tables:   contacts, accounts, journal_entries, journal_entry_lines, companies
-- Date:     2026-04-12
-- Safe:     SELECT only — no modifications made
-- =============================================================================

-- =============================================================================
-- CHECK 1: Customers with no linked AR subledger account
-- Expected: 0 rows — every contact typed 'customer' or 'both' must have a
--           corresponding account of type='party_subledger' where
--           linked_contact_id = contacts.id. Without this link, AR postings
--           cannot be attributed to the correct customer ledger.
-- =============================================================================
SELECT
    'CHECK 1: Customers with no AR subledger account' AS check_name,
    ct.id                                             AS contact_id,
    ct.company_id,
    ct.name                                           AS contact_name,
    ct.contact_type,
    c.name                                            AS company_name
FROM contacts ct
JOIN companies c ON c.id = ct.company_id
WHERE ct.contact_type IN ('customer', 'both')
  AND NOT EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.company_id    = ct.company_id
        AND a.type          = 'party_subledger'
        AND a.linked_contact_id = ct.id
  )
ORDER BY ct.company_id, ct.name;

-- =============================================================================
-- CHECK 2: Suppliers with no linked AP subledger account
-- Expected: 0 rows — every contact typed 'supplier' or 'both' must have a
--           party_subledger account linked to it for AP tracking.
-- =============================================================================
SELECT
    'CHECK 2: Suppliers with no AP subledger account' AS check_name,
    ct.id                                              AS contact_id,
    ct.company_id,
    ct.name                                            AS contact_name,
    ct.contact_type,
    c.name                                             AS company_name
FROM contacts ct
JOIN companies c ON c.id = ct.company_id
WHERE ct.contact_type IN ('supplier', 'both')
  AND NOT EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.company_id      = ct.company_id
        AND a.type            = 'party_subledger'
        AND a.linked_contact_id = ct.id
  )
ORDER BY ct.company_id, ct.name;

-- =============================================================================
-- CHECK 3: Party subledger accounts with no linked_contact_id (orphaned)
-- Expected: 0 rows — every account of type='party_subledger' must reference
--           a contact. An account with NULL linked_contact_id is an orphan
--           that cannot be attributed to any party. Investigate and delete
--           or re-link these accounts.
-- =============================================================================
SELECT
    'CHECK 3: Subledger accounts with no linked contact' AS check_name,
    a.id                                                  AS account_id,
    a.company_id,
    a.code                                                AS account_code,
    a.name                                                AS account_name,
    c.name                                                AS company_name
FROM accounts a
JOIN companies c ON c.id = a.company_id
WHERE a.type = 'party_subledger'
  AND a.linked_contact_id IS NULL
ORDER BY a.company_id, a.code;

-- =============================================================================
-- CHECK 4: Party subledger accounts pointing to non-existent contact
-- Expected: 0 rows — linked_contact_id must reference a real contacts row
--           in the same company. A dangling FK here will silently corrupt
--           ledger lookups. Re-link to the correct contact or remove the account.
-- =============================================================================
SELECT
    'CHECK 4: Subledger accounts with broken contact link' AS check_name,
    a.id                                                    AS account_id,
    a.company_id,
    a.code                                                  AS account_code,
    a.name                                                  AS account_name,
    a.linked_contact_id                                     AS broken_contact_id,
    c.name                                                  AS company_name
FROM accounts a
JOIN companies c ON c.id = a.company_id
WHERE a.type = 'party_subledger'
  AND a.linked_contact_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM contacts ct
      WHERE ct.id         = a.linked_contact_id
        AND ct.company_id = a.company_id
  )
ORDER BY a.company_id, a.code;

-- =============================================================================
-- CHECK 5: Contacts where legacy current_balance diverges from GL balance
-- Expected: 0 rows — contacts.current_balance is a legacy cached field and
--           MUST NOT be used as the source of truth. This check flags
--           divergences > 1.00 to help identify contacts that were incorrectly
--           read from the contacts table rather than computed from the GL.
--           Resolution: update the consuming code to query journal_entry_lines
--           instead of contacts.current_balance.
-- NOTE:     GL balance = SUM(debit) - SUM(credit) on the party subledger account
--           linked to the contact, across active (non-void) journal entries.
-- =============================================================================
WITH gl_balances AS (
    SELECT
        a.linked_contact_id AS contact_id,
        a.company_id,
        COALESCE(SUM(
            CASE WHEN je.is_void IS NULL OR je.is_void = FALSE
                 THEN jel.debit - jel.credit
                 ELSE 0
            END
        ), 0) AS gl_balance
    FROM accounts a
    JOIN journal_entry_lines jel ON jel.account_id = a.id
    JOIN journal_entries     je  ON je.id = jel.journal_entry_id
    WHERE a.type = 'party_subledger'
      AND a.linked_contact_id IS NOT NULL
    GROUP BY a.linked_contact_id, a.company_id
)
SELECT
    'CHECK 5: Legacy current_balance vs GL divergence > 1.00' AS check_name,
    ct.id                                                       AS contact_id,
    ct.company_id,
    ct.name                                                     AS contact_name,
    ct.contact_type,
    ct.current_balance                                          AS legacy_balance,
    gb.gl_balance,
    ABS(ct.current_balance - gb.gl_balance)                    AS divergence,
    c.name                                                      AS company_name
FROM contacts ct
JOIN gl_balances gb ON gb.contact_id = ct.id AND gb.company_id = ct.company_id
JOIN companies  c   ON c.id = ct.company_id
WHERE ABS(COALESCE(ct.current_balance, 0) - gb.gl_balance) > 1.00
ORDER BY divergence DESC;

-- =============================================================================
-- CHECK 6: Multiple party_subledger accounts linked to the same contact
-- Expected: 0 rows — each contact should have exactly one subledger account
--           per company. Multiple accounts cause split ledger balances and
--           incorrect AR/AP reporting. Merge the duplicate accounts and
--           re-point all journal lines to the canonical one.
-- =============================================================================
SELECT
    'CHECK 6: Contacts with multiple subledger accounts' AS check_name,
    a.linked_contact_id                                   AS contact_id,
    a.company_id,
    ct.name                                               AS contact_name,
    COUNT(a.id)                                           AS subledger_account_count,
    array_agg(a.code ORDER BY a.code)                    AS account_codes,
    array_agg(a.id   ORDER BY a.code)                    AS account_ids,
    c.name                                                AS company_name
FROM accounts a
JOIN contacts  ct ON ct.id = a.linked_contact_id AND ct.company_id = a.company_id
JOIN companies c  ON c.id  = a.company_id
WHERE a.type = 'party_subledger'
  AND a.linked_contact_id IS NOT NULL
GROUP BY a.linked_contact_id, a.company_id, ct.name, c.name
HAVING COUNT(a.id) > 1
ORDER BY a.company_id, ct.name;
