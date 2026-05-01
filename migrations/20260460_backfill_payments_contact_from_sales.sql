-- ============================================================================
-- Backfill payments.contact_id from linked sale when missing (Account Statements party column)
-- ============================================================================
-- Safe: only updates rows where reference_type = sale, contact_id IS NULL,
--       and sales.customer_id is non-null.
-- ============================================================================

UPDATE public.payments p
SET contact_id = s.customer_id
FROM public.sales s
WHERE p.reference_type = 'sale'
  AND p.reference_id = s.id
  AND p.contact_id IS NULL
  AND s.customer_id IS NOT NULL;
