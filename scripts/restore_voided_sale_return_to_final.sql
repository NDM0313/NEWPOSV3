-- restore_voided_sale_return_to_final.sql
-- Undoes a **void** on one sale return (same intent as saleReturnService.restoreVoidedSaleReturnToFinal).
-- Replace :return_id and :company_id (or literals) before running in a transaction.
--
-- Steps:
--   1) Soft-void active correction_reversal JEs that reference each active sale_return JE for this document.
--   2) DELETE sale_return_void stock rows for this return.
--   3) SET sale_returns.status = 'final' WHERE status = 'void'.
--   4) CALL recalc_sale_payment_totals(original_sale_id) when linked.
--
-- BEGIN;
-- ... statements ...
-- COMMIT;

-- Example (edit UUIDs):
/*
WITH doc_je AS (
  SELECT id
  FROM public.journal_entries
  WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND reference_type = 'sale_return'
    AND reference_id = '00000000-0000-0000-0000-000000000002'::uuid
    AND coalesce(is_void, false) = false
)
UPDATE public.journal_entries r
SET is_void = true
FROM doc_je d
WHERE r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND r.reference_type = 'correction_reversal'
  AND r.reference_id = d.id::text
  AND coalesce(r.is_void, false) = false;

DELETE FROM public.stock_movements
WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND reference_type = 'sale_return'
  AND reference_id = '00000000-0000-0000-0000-000000000002'::uuid
  AND movement_type = 'sale_return_void';

UPDATE public.sale_returns
SET status = 'final', updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000002'::uuid
  AND company_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND lower(trim(status)) = 'void';

SELECT public.recalc_sale_payment_totals('original-sale-uuid-here'::uuid);
*/

SELECT 'Edit literals in the commented block above; do not run blind.' AS note;
