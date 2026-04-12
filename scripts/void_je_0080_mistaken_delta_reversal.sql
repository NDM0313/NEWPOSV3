-- Void mistaken JE-0080: delta-only reversal (Rs 5,000) on PF-14 tail — restore before re-reversing with composite logic.
-- Company: Nadeem / SL-0004 test tenant
-- Run in Supabase SQL Editor (adjust entry_no if your DB used a different number).

BEGIN;

SELECT id, entry_no, description, reference_type, reference_id, is_void, payment_id
FROM journal_entries
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
  AND entry_no = 'JE-0080';

UPDATE journal_entries
SET
  is_void = true,
  void_reason = 'Mistaken correction_reversal: mirrored tail PF-14 delta (Rs 5,000) instead of full effective payment. Voided to restore GL before re-reversing with composite effective-total logic.',
  voided_at = now()
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
  AND entry_no = 'JE-0080'
  AND COALESCE(is_void, false) = false
  AND lower(COALESCE(reference_type, '')) = 'correction_reversal';

COMMIT;
