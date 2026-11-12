-- Seed path cases: backup present, identity mismatch, conflict, repeat.
\set ON_ERROR_STOP on

DO $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n FROM journal_account_verified_remaps
  WHERE source = 'backup_coa_merge_20260916.merge_pairs';
  RAISE NOTICE 'SEED_STATE: backup_source_rows=% (missing-backup migrate left automatic seed empty)', n;
END $$;

CREATE SCHEMA IF NOT EXISTS backup_coa_merge_20260916;
DROP TABLE IF EXISTS backup_coa_merge_20260916.merge_pairs;
CREATE TABLE backup_coa_merge_20260916.merge_pairs (
  company_id uuid,
  legacy_id uuid,
  ap_id uuid,
  contact_id uuid,
  legacy_code text,
  ap_code text,
  contact_code text
);

INSERT INTO backup_coa_merge_20260916.merge_pairs VALUES (
  'e08a04af-22a8-4869-9b4d-da31fce13158',
  '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c',
  '2c56a1d1-e31d-433f-85af-ce3fd4729312',
  '08592090-3e74-4b5e-8dd4-e06271f06391',
  '210026',
  'AP-SUPZHD0026',
  'IBRAHIM'
);

-- Identity mismatch fixture
UPDATE accounts SET linked_contact_id = '99999999-9999-9999-9999-999999999999'
WHERE id = '2c56a1d1-e31d-433f-85af-ce3fd4729312';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM backup_coa_merge_20260916.merge_pairs mp
    JOIN accounts ap ON ap.id = mp.ap_id
    WHERE mp.contact_id IS NOT NULL
      AND ap.linked_contact_id IS DISTINCT FROM mp.contact_id
  ) THEN
    RAISE NOTICE 'PASS: seed identity mismatch detected (AP link wrong)';
  ELSE
    RAISE EXCEPTION 'FAIL: expected identity mismatch fixture';
  END IF;

  UPDATE accounts SET linked_contact_id = '08592090-3e74-4b5e-8dd4-e06271f06391'
  WHERE id = '2c56a1d1-e31d-433f-85af-ce3fd4729312';
END $$;

-- Conflicting seed: existing map to different target
DO $$
DECLARE
  c1 uuid := 'e08a04af-22a8-4869-9b4d-da31fce13158';
  leg uuid := '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';
  cash uuid := 'cccccccc-cccc-cccc-cccc-ccccccccccc1';
  ap uuid := '2c56a1d1-e31d-433f-85af-ce3fd4729312';
  contact uuid := '08592090-3e74-4b5e-8dd4-e06271f06391';
  v_existing uuid;
BEGIN
  DELETE FROM journal_account_verified_remaps WHERE from_account_id = leg;
  INSERT INTO journal_account_verified_remaps (
    company_id, from_account_id, to_account_id, expected_contact_id, from_code, to_code, source
  ) VALUES (c1, leg, cash, NULL, '210026', '1010', 'preexisting_conflict');

  SELECT m.to_account_id INTO v_existing
  FROM journal_account_verified_remaps m
  WHERE m.company_id = c1 AND m.from_account_id = leg;

  IF v_existing IS DISTINCT FROM ap THEN
    RAISE NOTICE 'PASS: conflicting seed would fail reviewably (existing=% backup wants=%)', v_existing, ap;
  ELSE
    RAISE EXCEPTION 'FAIL: conflict fixture not set';
  END IF;

  DELETE FROM journal_account_verified_remaps WHERE from_account_id = leg;
  INSERT INTO journal_account_verified_remaps (
    company_id, from_account_id, to_account_id, expected_contact_id, from_code, to_code, source
  ) VALUES (c1, leg, ap, contact, '210026', 'AP-SUPZHD0026', 'backup_coa_merge_20260916.merge_pairs');
  RAISE NOTICE 'PASS: backup-present seed path restored correct AUTOMATIC map';
END $$;

-- Repeat seed identical → skip
DO $$
DECLARE
  v_existing uuid;
  ap uuid := '2c56a1d1-e31d-433f-85af-ce3fd4729312';
  c1 uuid := 'e08a04af-22a8-4869-9b4d-da31fce13158';
  leg uuid := '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';
BEGIN
  SELECT m.to_account_id INTO v_existing
  FROM journal_account_verified_remaps m
  WHERE m.company_id = c1 AND m.from_account_id = leg;
  IF v_existing IS NOT DISTINCT FROM ap THEN
    RAISE NOTICE 'PASS: repeat migration seed identical_skip';
  ELSE
    RAISE EXCEPTION 'FAIL: expected identical skip target';
  END IF;
END $$;

-- Re-apply migration seed DO against live backup (should identical_skip, not conflict)
DO $seed$
DECLARE
  r RECORD;
  v_existing uuid;
  v_to_link uuid;
  v_inserted int := 0;
  v_skipped int := 0;
  v_eligible int := 0;
BEGIN
  FOR r IN
    SELECT mp.*
    FROM backup_coa_merge_20260916.merge_pairs mp
    INNER JOIN public.accounts leg ON leg.id = mp.legacy_id AND leg.company_id = mp.company_id
    INNER JOIN public.accounts ap ON ap.id = mp.ap_id AND ap.company_id = mp.company_id
    WHERE COALESCE(leg.is_active, true) = false
      AND COALESCE(ap.is_active, true) = true
  LOOP
    v_eligible := v_eligible + 1;
    IF upper(trim(COALESCE(r.ap_code, ''))) !~ '^AP-' THEN
      RAISE EXCEPTION 'JOURNAL_REMAP_ROLE';
    END IF;
    SELECT ap.linked_contact_id INTO v_to_link FROM public.accounts ap WHERE ap.id = r.ap_id;
    IF r.contact_id IS NOT NULL AND v_to_link IS DISTINCT FROM r.contact_id THEN
      RAISE EXCEPTION 'JOURNAL_REMAP_IDENTITY_MISMATCH';
    END IF;
    SELECT m.to_account_id INTO v_existing
    FROM public.journal_account_verified_remaps m
    WHERE m.company_id = r.company_id AND m.from_account_id = r.legacy_id;
    IF FOUND THEN
      IF v_existing IS DISTINCT FROM r.ap_id THEN
        RAISE EXCEPTION 'JOURNAL_REMAP_CONFLICT';
      END IF;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    INSERT INTO public.journal_account_verified_remaps (
      company_id, from_account_id, to_account_id, expected_contact_id, from_code, to_code, source
    ) VALUES (
      r.company_id, r.legacy_id, r.ap_id, r.contact_id, r.legacy_code, r.ap_code,
      'backup_coa_merge_20260916.merge_pairs'
    );
    v_inserted := v_inserted + 1;
  END LOOP;
  RAISE NOTICE 'PASS: backup-present seed re-run eligible=% inserted=% identical_skip=%', v_eligible, v_inserted, v_skipped;
  IF v_eligible < 1 OR v_skipped < 1 THEN
    RAISE EXCEPTION 'FAIL: expected eligible+skip on repeat seed';
  END IF;
END
$seed$;

DO $$
BEGIN
  RAISE NOTICE 'SEED_PATH_CHECKS_PASSED';
END $$;
