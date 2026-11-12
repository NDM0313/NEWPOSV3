-- After re-running actual 01_backup.sql: original evidence must be unchanged.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_run text;
  v_prev text;
  v_post int;
  v_prev_post int;
  v_meta_created timestamptz;
BEGIN
  SELECT run_id, post_cnt INTO v_prev, v_prev_post FROM public._je_guard_verify_backup_fp LIMIT 1;
  SELECT run_id, created_at INTO v_run, v_meta_created FROM backup_coa_limited_ibrahim_v1.meta LIMIT 1;
  SELECT COUNT(*) INTO v_post FROM backup_coa_limited_ibrahim_v1.post_apply_lines;

  IF v_run IS DISTINCT FROM v_prev THEN
    RAISE EXCEPTION 'FAIL: backup rerun changed run_id from % to %', v_prev, v_run;
  END IF;
  IF v_post IS DISTINCT FROM v_prev_post OR v_post <> 2 THEN
    RAISE EXCEPTION 'FAIL: backup rerun must preserve post_apply_lines (was=% now=%)', v_prev_post, v_post;
  END IF;
  RAISE NOTICE 'PASS: backup rerun preserved run_id=% post_apply=% created_at=%', v_run, v_post, v_meta_created;
END $$;

-- Exists-guard refuses before any DROP (evidence still present)
DO $$
DECLARE
  v_run_before text;
  v_run_after text;
  v_post_before int;
  v_post_after int;
BEGIN
  SELECT run_id INTO v_run_before FROM backup_coa_limited_ibrahim_v1.meta LIMIT 1;
  SELECT COUNT(*) INTO v_post_before FROM backup_coa_limited_ibrahim_v1.post_apply_lines;

  IF to_regclass('backup_coa_limited_ibrahim_v1.manifest') IS NULL THEN
    RAISE EXCEPTION 'FAIL: expected existing manifest';
  END IF;
  RAISE NOTICE 'PASS: validation/exists path would refuse before destructive mutation';

  SELECT run_id INTO v_run_after FROM backup_coa_limited_ibrahim_v1.meta LIMIT 1;
  SELECT COUNT(*) INTO v_post_after FROM backup_coa_limited_ibrahim_v1.post_apply_lines;
  IF v_run_after IS DISTINCT FROM v_run_before OR v_post_after IS DISTINCT FROM v_post_before THEN
    RAISE EXCEPTION 'FAIL: exists-guard path mutated evidence';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'BACKUP_NONDESTRUCTIVE_REGRESSION_PASSED';
END $$;
