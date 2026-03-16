-- Backfill payments.contact_id from supplier ledger_master.entity_id for payments
-- that appear in supplier ledger_entries but have contact_id NULL. Idempotent.

UPDATE payments p
SET contact_id = lm.entity_id
FROM ledger_entries le
JOIN ledger_master lm ON lm.id = le.ledger_id AND lm.ledger_type = 'supplier' AND lm.entity_id IS NOT NULL
WHERE p.id = le.reference_id
  AND le.source = 'payment'
  AND p.contact_id IS NULL;
