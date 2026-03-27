-- Chart of accounts: header/group rows (non-posting targets for hierarchy UI).
-- App seeds codes 1050,1060,1070,1080,2090,3090,4050,6090 with is_group=true via defaultAccountsService.
-- Safe to run multiple times.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.accounts.is_group IS 'When true, account is a COA section/group header only; exclude from payment pickers and balance sheet line items (children carry GL).';

CREATE INDEX IF NOT EXISTS idx_accounts_company_is_group
  ON public.accounts (company_id)
  WHERE is_group = true;

-- Mark known header codes as groups when rows already exist (idempotent).
UPDATE public.accounts
SET is_group = true
WHERE TRIM(COALESCE(code, '')) IN (
  '1050', '1060', '1070', '1080',
  '2090', '3090', '4050', '6090'
);
