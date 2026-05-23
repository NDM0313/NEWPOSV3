-- Drop broken create_business_transaction overload that INSERTs settings.created_at
-- (public.settings has updated_at only). Mobile/web should use the 22-arg bootstrap RPC
-- from migration 61 (company_id, key, value, category, description, updated_at).

DROP FUNCTION IF EXISTS public.create_business_transaction(
  text, text, text, text, uuid,
  text, date, text, text,
  text, text, text, text, text, jsonb,
  text, text, numeric, text, boolean, boolean,
  text, jsonb, text, text
);
