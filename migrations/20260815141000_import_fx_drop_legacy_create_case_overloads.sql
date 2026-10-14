-- Follow-up: drop residual create_import_fx_case 15-arg overload left after W2.
-- Keeps canonical W2 long signature only. Idempotent. No journals.

DROP FUNCTION IF EXISTS public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid
);

DROP FUNCTION IF EXISTS public.create_import_fx_case(
  uuid, uuid, text, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, date, text, uuid, uuid
);
