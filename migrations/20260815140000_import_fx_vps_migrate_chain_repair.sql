-- Import FX — VPS migrate-chain repair (additive)
-- 1) Drop legacy 10-arg Path 21 credit overload (Wave 0 11-arg with DEFAULT client_op is canonical).
-- 2) Ledger-mark Import FX migration filenames already present as objects but missing from schema_migrations,
--    so deploy/run-migrations-vps.sh can proceed past the Aug-1 COMMENT ambiguity failure.
-- Does NOT post journals. Does NOT create money. Safe to re-run (IF EXISTS / ON CONFLICT).

BEGIN;

DROP FUNCTION IF EXISTS public.record_fx_currency_purchase_on_credit(
  uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid
);

DROP FUNCTION IF EXISTS public.apply_fx_currency_purchase_settlement(
  uuid, uuid, uuid, numeric
);

COMMENT ON FUNCTION public.record_fx_currency_purchase_on_credit(
  uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid, uuid
) IS
  'Path 21 Wave 0: Dr TT wallet / Cr Agent AP. Optional p_client_operation_id for idempotent retry. money_exchange-only agent.';

COMMENT ON FUNCTION public.apply_fx_currency_purchase_settlement(
  uuid, uuid, uuid, numeric, uuid
) IS
  'Wave 0: allocate agent PAY to FX credit; active settlements only; optional client_operation_id replay.';

INSERT INTO public.schema_migrations (name) VALUES
  ('20260801190100_fx_currency_purchase_rpcs.sql'),
  ('20260811160000_import_fx_wave_a_server_off_checks.sql'),
  ('20260811160100_import_fx_wave_a_purchase_payment_fx_guards.sql'),
  ('20260811170000_import_fx_path21_agent_role_guards.sql'),
  ('20260811171000_import_fx_tt_wallet_include_party_tt.sql'),
  ('20260811200000_import_fx_wave0_path21_idempotency_settlement_lifecycle.sql'),
  ('20260811230000_import_fx_case_stage_persistence_w1.sql'),
  ('20260812010000_import_fx_case_create_idempotency_w1.sql'),
  ('20260812013000_import_fx_case_history_read_when_disabled_w1.sql'),
  ('20260812020000_import_fx_case_read_security_hardening_w1.sql'),
  ('20260812030000_import_fx_case_mutation_security_parity_w1.sql'),
  ('20260812040000_import_fx_case_attachment_security_w1.sql'),
  ('20260812050000_import_fx_case_table_privilege_lockdown_w1.sql'),
  ('20260812120000_import_fx_wave0_claim_before_pay.sql'),
  ('20260813120000_import_fx_case_operator_assignment_and_validation_w2_1.sql')
ON CONFLICT (name) DO NOTHING;

COMMIT;
