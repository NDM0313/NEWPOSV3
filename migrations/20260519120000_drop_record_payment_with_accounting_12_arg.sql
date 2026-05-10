-- ============================================================================
-- Single overload for record_payment_with_accounting (13 args + p_worker_stage_id)
-- ============================================================================
-- Adding p_worker_stage_id with CREATE OR REPLACE created a second overload;
-- Postgres then errors: could not choose the best candidate function between
-- the 12- and 13-argument versions. Drop the legacy 12-arg signature.

DROP FUNCTION IF EXISTS public.record_payment_with_accounting(
  uuid,
  uuid,
  public.payment_type,
  character varying,
  uuid,
  numeric,
  public.payment_method_enum,
  date,
  uuid,
  character varying,
  text,
  uuid
);

NOTIFY pgrst, 'reload schema';
