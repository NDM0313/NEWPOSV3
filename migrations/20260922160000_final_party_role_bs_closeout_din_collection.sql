-- Final party-role closeout mutations (clone first, then prod).
-- Company: DIN COLLECTION e08a04af-22a8-4869-9b4d-da31fce13158
-- Owner-authorized: DHL PK courier consolidation + Mukesh role corrections.
-- Does NOT rewrite ambiguous worker history lines. Does NOT create plug JEs.

BEGIN;

CREATE TABLE IF NOT EXISTS public._closeout_repair_backup_20260922 (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL,
  step text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_run uuid := gen_random_uuid();
  v_company uuid := 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid;
  v_dhl_pk_contact uuid := '4505905b-b3e0-4ec2-8fc7-bd79464b0506'::uuid;
  v_dhl_local_contact uuid := '6ce5bed0-bd0a-495d-8841-19f90be6188c'::uuid;
  v_2030162 uuid := '919a3a0a-f87d-4c1b-87d9-068810378b8c'::uuid;
  v_ap0162 uuid := '88c0603a-2f96-4ed8-9956-9ff9b1128288'::uuid;
  v_line uuid := '0565a4d3-3410-4bef-acdd-d3605febf96c'::uuid;
  v_je uuid;
  v_line_dr numeric;
  v_line_cr numeric;
  v_line_acct uuid;
  v_pre_203_lines int;
  v_pre_203_net numeric;
  v_pre_ap_lines int;
  v_pre_ap_net numeric;
  v_post_203_lines int;
  v_post_203_net numeric;
  v_post_ap_lines int;
  v_je_dr numeric;
  v_je_cr numeric;
  v_sheila uuid := 'b5eabb4d-efbc-440e-8e54-f0d23d73912a'::uuid;
  v_rashid uuid := '1d750780-997a-44ce-86b3-5876582e469a'::uuid;
  v_qasir uuid := '3b44922d-3de8-4a62-80bb-79b51e7ad5fa'::uuid;
  v_latif uuid := '800f1fd9-9237-4634-81da-6efbb688298e'::uuid;
  v_kiran uuid := '797ca8bb-5491-4827-8d6e-c7971d20a022'::uuid;
  v_210129 uuid := 'e914121f-aa31-45d4-8939-0fd5d1fb3310'::uuid;
  v_210135 uuid := '74e8d28b-0612-4333-8743-cfa17780a36c'::uuid;
  v_210155 uuid := 'e933a77d-090a-4383-81b4-c87adad95a4f'::uuid;
  v_210185 uuid := 'd1205781-df40-4825-868d-1732a4e05ef6'::uuid;
  v_sheila_ap uuid;
  v_rashid_wa uuid;
  v_rashid_wp uuid;
  v_qasir_wa uuid;
  v_qasir_wp uuid;
  v_latif_wa uuid;
  v_latif_wp uuid;
  v_tb_before_dr numeric;
  v_tb_before_cr numeric;
  v_tb_after_dr numeric;
  v_tb_after_cr numeric;
BEGIN
  -- Fingerprint global TB before any mutation
  SELECT ROUND(SUM(jel.debit),2), ROUND(SUM(jel.credit),2)
    INTO v_tb_before_dr, v_tb_before_cr
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company AND COALESCE(je.is_void,false)=false;

  INSERT INTO public._closeout_repair_backup_20260922(run_id, step, payload)
  VALUES (v_run, 'tb_before', jsonb_build_object('dr', v_tb_before_dr, 'cr', v_tb_before_cr));

  ------------------------------------------------------------------
  -- C) DHL PK exact line move AP-SUPZHD0162 → 2030162
  ------------------------------------------------------------------
  SELECT jel.journal_entry_id, jel.debit, jel.credit, jel.account_id
    INTO v_je, v_line_dr, v_line_cr, v_line_acct
  FROM journal_entry_lines jel
  WHERE jel.id = v_line
  FOR UPDATE;

  IF v_je IS NULL THEN
    RAISE EXCEPTION 'DHL_PK_LINE_MISSING: %', v_line;
  END IF;
  IF v_line_acct IS DISTINCT FROM v_ap0162 THEN
    RAISE EXCEPTION 'DHL_PK_LINE_ACCOUNT_MISMATCH: got % expected %', v_line_acct, v_ap0162;
  END IF;
  IF v_line_dr IS DISTINCT FROM 500000.00 OR v_line_cr IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'DHL_PK_LINE_AMOUNT_MISMATCH: dr=% cr=%', v_line_dr, v_line_cr;
  END IF;

  SELECT COUNT(*), ROUND(COALESCE(SUM(debit-credit),0),2)
    INTO v_pre_203_lines, v_pre_203_net
  FROM journal_entry_lines WHERE account_id = v_2030162;

  SELECT COUNT(*), ROUND(COALESCE(SUM(debit-credit),0),2)
    INTO v_pre_ap_lines, v_pre_ap_net
  FROM journal_entry_lines WHERE account_id = v_ap0162;

  IF v_pre_ap_lines <> 1 OR v_pre_ap_net IS DISTINCT FROM 500000.00 THEN
    RAISE EXCEPTION 'DHL_PK_AP_PRECONDITION_FAIL: lines=% net=%', v_pre_ap_lines, v_pre_ap_net;
  END IF;

  INSERT INTO public._closeout_repair_backup_20260922(run_id, step, payload)
  SELECT v_run, 'dhl_pk_line', to_jsonb(jel.*)
  FROM journal_entry_lines jel WHERE jel.id = v_line;

  INSERT INTO public._closeout_repair_backup_20260922(run_id, step, payload)
  SELECT v_run, 'dhl_pk_je', to_jsonb(je.*)
  FROM journal_entries je WHERE je.id = v_je;

  INSERT INTO public._closeout_repair_backup_20260922(run_id, step, payload)
  SELECT v_run, 'dhl_pk_src_acct', to_jsonb(a.*)
  FROM accounts a WHERE a.id = v_ap0162;

  INSERT INTO public._closeout_repair_backup_20260922(run_id, step, payload)
  SELECT v_run, 'dhl_pk_tgt_acct', to_jsonb(a.*)
  FROM accounts a WHERE a.id = v_2030162;

  INSERT INTO public._closeout_repair_backup_20260922(run_id, step, payload)
  SELECT v_run, 'dhl_pk_contact', to_jsonb(c.*)
  FROM contacts c WHERE c.id = v_dhl_pk_contact;

  INSERT INTO public._closeout_repair_backup_20260922(run_id, step, payload)
  VALUES (v_run, 'dhl_pk_pre_balances', jsonb_build_object(
    '2030162_lines', v_pre_203_lines, '2030162_net', v_pre_203_net,
    'ap0162_lines', v_pre_ap_lines, 'ap0162_net', v_pre_ap_net,
    'run_id', v_run
  ));

  -- Exact attribution move (no amount/date/description change)
  UPDATE journal_entry_lines
  SET account_id = v_2030162
  WHERE id = v_line
    AND account_id = v_ap0162
    AND debit = 500000.00
    AND credit = 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DHL_PK_UPDATE_FAILED';
  END IF;

  SELECT ROUND(SUM(debit),2), ROUND(SUM(credit),2)
    INTO v_je_dr, v_je_cr
  FROM journal_entry_lines WHERE journal_entry_id = v_je;

  IF v_je_dr IS DISTINCT FROM v_je_cr THEN
    RAISE EXCEPTION 'DHL_PK_JE_UNBALANCED_AFTER: dr=% cr=%', v_je_dr, v_je_cr;
  END IF;

  SELECT COUNT(*), ROUND(COALESCE(SUM(debit-credit),0),2)
    INTO v_post_203_lines, v_post_203_net
  FROM journal_entry_lines WHERE account_id = v_2030162;

  SELECT COUNT(*) INTO v_post_ap_lines
  FROM journal_entry_lines WHERE account_id = v_ap0162;

  IF v_post_ap_lines <> 0 THEN
    RAISE EXCEPTION 'DHL_PK_AP_STILL_HAS_LINES: %', v_post_ap_lines;
  END IF;
  IF v_post_203_net IS DISTINCT FROM (v_pre_203_net + 500000.00) THEN
    RAISE EXCEPTION 'DHL_PK_203_NET_MISMATCH: pre=% post=%', v_pre_203_net, v_post_203_net;
  END IF;
  IF v_post_203_lines <> v_pre_203_lines + 1 THEN
    RAISE EXCEPTION 'DHL_PK_203_LINECOUNT_MISMATCH';
  END IF;

  UPDATE contacts
  SET type = 'courier', updated_at = now()
  WHERE id = v_dhl_pk_contact
    AND company_id = v_company
    AND code = 'SUP-ZHD-0162';

  UPDATE accounts
  SET is_active = false, updated_at = now()
  WHERE id = v_ap0162
    AND company_id = v_company
    AND code = 'AP-SUPZHD0162';

  -- Optional posting remap (same contact). Ignore if unique conflict.
  INSERT INTO public.journal_account_verified_remaps (
    company_id, from_account_id, to_account_id, expected_contact_id,
    from_code, to_code, source, notes
  ) VALUES (
    v_company, v_ap0162, v_2030162, v_dhl_pk_contact,
    'AP-SUPZHD0162', '2030162', 'closeout_dhl_pk_20260922',
    'Retired misfiled supplier AP → canonical DHL PK courier 2030162'
  )
  ON CONFLICT (company_id, from_account_id) DO NOTHING;

  -- Local DHL must remain distinct
  IF NOT EXISTS (
    SELECT 1 FROM contacts
    WHERE id = v_dhl_local_contact AND type = 'courier' AND code = 'SUP-ZHD-0007'
  ) THEN
    RAISE EXCEPTION 'LOCAL_DHL_NOT_COURIER';
  END IF;

  INSERT INTO public._closeout_repair_backup_20260922(run_id, step, payload)
  VALUES (v_run, 'dhl_pk_post', jsonb_build_object(
    '2030162_lines', v_post_203_lines, '2030162_net', v_post_203_net,
    'ap0162_lines', v_post_ap_lines, 'je_dr', v_je_dr, 'je_cr', v_je_cr
  ));

  ------------------------------------------------------------------
  -- E) Mukesh roles
  ------------------------------------------------------------------
  -- Sheila stays supplier; ensure AP leaf
  UPDATE contacts SET type = 'supplier', updated_at = now()
  WHERE id = v_sheila AND company_id = v_company AND code = 'SUP-ZHD-0129';

  v_sheila_ap := public._ensure_ap_subaccount_for_contact(v_company, v_sheila);
  IF v_sheila_ap IS NULL THEN
    RAISE EXCEPTION 'SHEILA_AP_ENSURE_FAILED';
  END IF;

  INSERT INTO public.account_reporting_aliases (
    company_id, source_account_id, canonical_account_id, contact_id,
    alias_type, source, notes
  ) VALUES (
    v_company, v_210129, v_sheila_ap, v_sheila,
    'supplier_legacy', 'closeout_sheila_20260922',
    'SAFE historical 210129 → Sheila AP-SUP'
  )
  ON CONFLICT (company_id, source_account_id) DO NOTHING;

  -- Workers: flip type then ensure WA/WP; alias legacy 210 → WA (debit-net presentation)
  UPDATE contacts SET type = 'worker', updated_at = now()
  WHERE company_id = v_company AND id IN (v_rashid, v_qasir, v_latif);

  v_rashid_wa := public._ensure_worker_advance_subaccount(v_company, v_rashid);
  v_rashid_wp := public._ensure_worker_payable_subaccount(v_company, v_rashid);
  v_qasir_wa := public._ensure_worker_advance_subaccount(v_company, v_qasir);
  v_qasir_wp := public._ensure_worker_payable_subaccount(v_company, v_qasir);
  v_latif_wa := public._ensure_worker_advance_subaccount(v_company, v_latif);
  v_latif_wp := public._ensure_worker_payable_subaccount(v_company, v_latif);

  IF v_rashid_wa IS NULL OR v_rashid_wp IS NULL
     OR v_qasir_wa IS NULL OR v_qasir_wp IS NULL
     OR v_latif_wa IS NULL OR v_latif_wp IS NULL THEN
    RAISE EXCEPTION 'WORKER_WA_WP_ENSURE_FAILED';
  END IF;

  INSERT INTO public.account_reporting_aliases (
    company_id, source_account_id, canonical_account_id, contact_id,
    alias_type, source, notes
  ) VALUES
    (v_company, v_210135, v_rashid_wa, v_rashid, 'worker_legacy', 'closeout_rashid_20260922',
     'Historical 210135 → Rashid WA (net debit presentation; lines preserved)'),
    (v_company, v_210155, v_qasir_wa, v_qasir, 'worker_legacy', 'closeout_qasir_20260922',
     'Historical 210155 → Qasir WA (lines preserved; net zero)'),
    (v_company, v_210185, v_latif_wa, v_latif, 'worker_legacy', 'closeout_latif_20260922',
     'Historical 210185 → Latif WA (net debit presentation; lines preserved)')
  ON CONFLICT (company_id, source_account_id) DO NOTHING;

  -- Kiran regression: must remain worker with WA/WP
  IF NOT EXISTS (
    SELECT 1 FROM contacts WHERE id = v_kiran AND type = 'worker' AND code = 'SUP-ZHD-0036'
  ) THEN
    RAISE EXCEPTION 'KIRAN_REGRESSION_TYPE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM accounts WHERE company_id = v_company AND code = 'WA-SUPZHD0036' AND linked_contact_id = v_kiran AND is_active
  ) OR NOT EXISTS (
    SELECT 1 FROM accounts WHERE company_id = v_company AND code = 'WP-SUPZHD0036' AND linked_contact_id = v_kiran AND is_active
  ) THEN
    RAISE EXCEPTION 'KIRAN_REGRESSION_WA_WP';
  END IF;

  SELECT ROUND(SUM(jel.debit),2), ROUND(SUM(jel.credit),2)
    INTO v_tb_after_dr, v_tb_after_cr
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = v_company AND COALESCE(je.is_void,false)=false;

  IF v_tb_after_dr IS DISTINCT FROM v_tb_before_dr OR v_tb_after_cr IS DISTINCT FROM v_tb_before_cr THEN
    RAISE EXCEPTION 'GL_TOTALS_CHANGED: before dr=% cr=% after dr=% cr=%',
      v_tb_before_dr, v_tb_before_cr, v_tb_after_dr, v_tb_after_cr;
  END IF;

  INSERT INTO public._closeout_repair_backup_20260922(run_id, step, payload)
  VALUES (v_run, 'closeout_summary', jsonb_build_object(
    'run_id', v_run,
    'sheila_ap', v_sheila_ap,
    'rashid_wa', v_rashid_wa, 'rashid_wp', v_rashid_wp,
    'qasir_wa', v_qasir_wa, 'qasir_wp', v_qasir_wp,
    'latif_wa', v_latif_wa, 'latif_wp', v_latif_wp,
    'tb_dr', v_tb_after_dr, 'tb_cr', v_tb_after_cr,
    'markers', jsonb_build_array(
      'DHL_PK_COURIER_CONSOLIDATION_PASS',
      'SHEILA_SUPPLIER_ROLE_PASS',
      'RASHID_WORKER_ROLE_PASS',
      'QASIR_WORKER_ROLE_PASS',
      'LATIF_WORKER_ROLE_PASS',
      'KIRAN_WORKER_REGRESSION_PASS'
    )
  ));

  RAISE NOTICE 'CLOSEOUT_OK run_id=%', v_run;
END $$;

COMMIT;
