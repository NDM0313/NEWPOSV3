-- DO NOT RUN until owner approves. Creates a dated backup of lines about to change.
-- Replace YYYYMMDDHHMM with wall-clock stamp.

CREATE SCHEMA IF NOT EXISTS backup_coa_limited_YYYYMMDDHHMM;

CREATE TABLE backup_coa_limited_YYYYMMDDHHMM.journal_entry_lines AS
SELECT jel.*
FROM journal_entry_lines jel
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
OR (
  -- Optional ID LACE wave: uncomment only with owner OK
  -- jel.account_id = 'e11d244a-b96e-4128-8ca3-2bae5a4f813c'
  false
);

CREATE TABLE backup_coa_limited_YYYYMMDDHHMM.manifest AS
SELECT * FROM (VALUES
  ('677c74de-b677-4a6f-877f-b13e0ac66aaa'::uuid, '2c56a1d1-e31d-433f-85af-ce3fd4729312'::uuid),
  ('343c2586-2d86-4c24-9e03-3af493dada9d'::uuid, '2c56a1d1-e31d-433f-85af-ce3fd4729312'::uuid)
) AS t(line_id, to_account_id);
