-- analyze_journal_duplicates_by_company.sql
-- Read-only: duplicate active journal_entries for one company (primary payment JEs, entry_no, fingerprints).
--
-- Usage: set :company_id in your SQL client, or replace the UUID literal below.

-- \set company_id '595c08c2-1e47-4581-89c9-1f78de51c613'

-- ---------------------------------------------------------------------------
-- A) Duplicate entry_no (case-insensitive) among non-void journals
--     Symptom: JE-0039 / JE-0040 open wrong row, PostgREST errors, doubled GL.
-- ---------------------------------------------------------------------------
SELECT
  'DUPLICATE_ENTRY_NO' AS flag,
  company_id,
  lower(trim(entry_no)) AS entry_no_norm,
  COUNT(*)::int AS je_count,
  array_agg(id ORDER BY created_at, id) AS journal_entry_ids,
  array_agg(entry_no ORDER BY created_at, id) AS entry_nos
FROM journal_entries
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND (is_void IS NULL OR is_void = false)
  AND entry_no IS NOT NULL
  AND trim(entry_no) <> ''
GROUP BY company_id, lower(trim(entry_no))
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ---------------------------------------------------------------------------
-- B) Duplicate action_fingerprint among non-void journals (PF-14 idempotency)
-- ---------------------------------------------------------------------------
SELECT
  'DUPLICATE_FINGERPRINT' AS flag,
  company_id,
  action_fingerprint,
  COUNT(*)::int AS je_count,
  array_agg(id ORDER BY created_at, id) AS journal_entry_ids
FROM journal_entries
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND (is_void IS NULL OR is_void = false)
  AND action_fingerprint IS NOT NULL
  AND trim(action_fingerprint) <> ''
GROUP BY company_id, action_fingerprint
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ---------------------------------------------------------------------------
-- C) Multiple primary JEs per payment_id (excludes payment_adjustment)
-- ---------------------------------------------------------------------------
SELECT
  'DUPLICATE_PRIMARY_PER_PAYMENT' AS flag,
  company_id,
  payment_id,
  COUNT(*)::int AS je_count,
  array_agg(id ORDER BY created_at, id) AS journal_entry_ids,
  array_agg(reference_type ORDER BY created_at, id) AS reference_types
FROM journal_entries
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND (is_void IS NULL OR is_void = false)
  AND payment_id IS NOT NULL
  AND reference_type IS DISTINCT FROM 'payment_adjustment'
GROUP BY company_id, payment_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ---------------------------------------------------------------------------
-- D) Detail for specific entry numbers (edit literals)
-- ---------------------------------------------------------------------------
-- SELECT id, entry_no, entry_date, reference_type, payment_id, reference_id, action_fingerprint, description, created_at, is_void
-- FROM journal_entries
-- WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
--   AND lower(trim(entry_no)) IN ('je-0039', 'je-0040')
-- ORDER BY entry_no, created_at;
