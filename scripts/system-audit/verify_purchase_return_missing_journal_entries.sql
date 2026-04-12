-- verify_purchase_return_missing_journal_entries.sql
-- Purpose: Find all finalized purchase returns that have no corresponding
--          journal entry. Every finalized return should have a JE that reverses
--          the AP credit and restores inventory (or posts to an expense account).
-- Severity: P1 — finalizePurchaseReturn does not call createEntry(); AP and
--           Inventory balances on the GL are therefore misstated for every
--           finalized purchase return.
-- Run: read-only; no writes.
-- Expected output: zero rows once the JE posting gap is fixed and historical
--                  corrections have been posted.

SELECT
    pr.id                           AS purchase_return_id,
    pr.reference_number,
    pr.status,
    pr.created_at::DATE             AS return_date,
    pr.total_amount,
    -- Stock movement confirming the return was physically processed
    sm.id                           AS stock_movement_id,
    sm.quantity                     AS returned_qty,
    sm.movement_type,
    -- JE that SHOULD exist but does not
    je.id                           AS journal_entry_id,   -- will be NULL for affected rows
    je.reference_type               AS je_reference_type
FROM purchase_returns pr
-- Stock movement for this return (confirms physical processing occurred)
LEFT JOIN stock_movements sm
    ON sm.reference_id   = pr.id::TEXT
    AND sm.movement_type = 'purchase_return'
-- Journal entry that should have been created on finalization
LEFT JOIN journal_entries je
    ON je.reference_id   = pr.id::TEXT
    AND je.reference_type = 'purchase_return'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE
    pr.status = 'final'
    AND je.id IS NULL
ORDER BY pr.created_at DESC;
