-- Import FX W3 localhost harness extensions (NOT for production).
-- Additive columns/stubs so W3 Confirm & Post can run against newposv3-local-pg.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_group boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtype text;

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS entry_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS document_no text,
  ADD COLUMN IF NOT EXISTS total_debit numeric(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credit numeric(18,2) DEFAULT 0;

ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS description text;

CREATE OR REPLACE FUNCTION public._is_account_control_code(p_account_id uuid, p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false;
$$;

CREATE OR REPLACE FUNCTION public.erp_numbering_global_branch_sentinel()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '00000000-0000-0000-0000-000000000000'::uuid;
$$;

CREATE OR REPLACE FUNCTION public._is_tt_agent_wallet_account(p_code text, p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    lower(coalesce(p_code, '')) LIKE '%tt%'
    OR lower(coalesce(p_name, '')) LIKE '%tt wallet%'
    OR lower(coalesce(p_name, '')) LIKE '%agent wallet%';
$$;
