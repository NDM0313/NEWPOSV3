-- Snapshot backup fingerprints into a durable verify table (cross-psql-session).
\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS public._je_guard_verify_backup_fp (
  run_id text NOT NULL,
  post_cnt int NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

TRUNCATE public._je_guard_verify_backup_fp;

INSERT INTO public._je_guard_verify_backup_fp (run_id, post_cnt)
SELECT m.run_id, (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.post_apply_lines)
FROM backup_coa_limited_ibrahim_v1.meta m
LIMIT 1;

DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r FROM public._je_guard_verify_backup_fp LIMIT 1;
  IF r.run_id IS NULL OR r.post_cnt <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected existing backup+post_apply before rerun (run_id=% post=%)', r.run_id, r.post_cnt;
  END IF;
  RAISE NOTICE 'PRE_RERUN_BACKUP: run_id=% post_apply=%', r.run_id, r.post_cnt;
END $$;
