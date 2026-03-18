-- PF-14.2 Business Edit UX + Audit Trail Separation
-- Verifies: single payment row per payment id, activity logs for payment_edited and sale_component_edited, no duplicate active payments.

-- 1) Payments per sale (edit updates same row in place; effective = current row amount)
SELECT reference_id AS sale_id, COUNT(*) AS payment_count, SUM(amount) AS total_paid
FROM payments
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type = 'sale'
  AND payment_type = 'received'
GROUP BY reference_id
ORDER BY total_paid DESC NULLS LAST
LIMIT 15;

-- 2) Activity logs: payment_edited and sale_component_edited actions exist (sample)
SELECT action, COUNT(*) AS cnt
FROM activity_logs
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND module = 'sale'
  AND action IN ('payment_edited', 'payment_added', 'sale_component_edited', 'update')
GROUP BY action
ORDER BY action;

-- 3) Recent sale activity (human-readable trail)
SELECT entity_reference, action, description, created_at
FROM activity_logs
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND module = 'sale'
ORDER BY created_at DESC
LIMIT 20;

-- 4) Journal: sale_adjustment and payment_adjustment descriptions (audit clarity)
SELECT reference_type, LEFT(description, 80) AS description_sample
FROM journal_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type IN ('sale_adjustment', 'payment_adjustment')
ORDER BY created_at DESC
LIMIT 10;
