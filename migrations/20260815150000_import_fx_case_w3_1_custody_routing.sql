-- W3.1 Custody & Routing — additive schema (no rewrite of applied W3 migrations).
-- Operational custody positions + distribution instructions.
-- Journals for non-COMPANY_WALLET modes debit settings-mapped USD custody control (never hardcode 1230).
-- Distribution lines do NOT settle Supplier AP (W5) or convert USD→CNY (W4).

BEGIN;

-- ---------------------------------------------------------------------------
-- A) Extend acquisitions / lots for routing
-- ---------------------------------------------------------------------------
ALTER TABLE public.import_fx_case_usd_acquisitions
  ALTER COLUMN destination_wallet_account_id DROP NOT NULL;

ALTER TABLE public.import_fx_case_usd_acquisitions
  ADD COLUMN IF NOT EXISTS routing_mode text NOT NULL DEFAULT 'COMPANY_WALLET',
  ADD COLUMN IF NOT EXISTS holder_contact_id uuid NULL REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS gl_debit_account_id uuid NULL REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS retained_usd_qty numeric(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distributed_usd_qty numeric(18, 6) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'import_fx_case_usd_acq_routing_mode_check'
  ) THEN
    ALTER TABLE public.import_fx_case_usd_acquisitions
      ADD CONSTRAINT import_fx_case_usd_acq_routing_mode_check
      CHECK (routing_mode IN (
        'COMPANY_WALLET',
        'AGENT_CUSTODY',
        'THIRD_PARTY_CUSTODY',
        'DIRECT_DISTRIBUTION',
        'SPLIT_HOLD_AND_DISTRIBUTE'
      ));
  END IF;
END $$;

UPDATE public.import_fx_case_usd_acquisitions u
SET gl_debit_account_id = COALESCE(u.gl_debit_account_id, u.destination_wallet_account_id),
    retained_usd_qty = COALESCE(NULLIF(u.retained_usd_qty, 0), u.usd_quantity),
    distributed_usd_qty = COALESCE(u.distributed_usd_qty, 0)
WHERE u.gl_debit_account_id IS NULL OR u.retained_usd_qty = 0;

ALTER TABLE public.import_fx_case_usd_lots
  ALTER COLUMN wallet_account_id DROP NOT NULL;

ALTER TABLE public.import_fx_case_usd_lots
  ADD COLUMN IF NOT EXISTS routing_mode text NULL,
  ADD COLUMN IF NOT EXISTS holder_contact_id uuid NULL REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS gl_debit_account_id uuid NULL REFERENCES public.accounts(id);

UPDATE public.import_fx_case_usd_lots l
SET gl_debit_account_id = COALESCE(l.gl_debit_account_id, l.wallet_account_id),
    routing_mode = COALESCE(l.routing_mode, 'COMPANY_WALLET')
WHERE l.gl_debit_account_id IS NULL OR l.routing_mode IS NULL;

-- ---------------------------------------------------------------------------
-- B) Custody positions (operational holder sub-ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_fx_case_usd_custody_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  branch_id uuid NULL REFERENCES public.branches(id),
  import_fx_case_id uuid NOT NULL REFERENCES public.import_fx_cases(id) ON DELETE CASCADE,
  acquisition_id uuid NOT NULL REFERENCES public.import_fx_case_usd_acquisitions(id),
  lot_id uuid NULL REFERENCES public.import_fx_case_usd_lots(id),
  holder_type text NOT NULL,
  holder_contact_id uuid NULL REFERENCES public.contacts(id),
  wallet_account_id uuid NULL REFERENCES public.accounts(id),
  foreign_currency text NOT NULL DEFAULT 'USD',
  quantity numeric(18, 6) NOT NULL CHECK (quantity >= 0),
  available_quantity numeric(18, 6) NOT NULL CHECK (available_quantity >= 0),
  pkr_carrying_value numeric(18, 2) NOT NULL CHECK (pkr_carrying_value >= 0),
  available_pkr_carrying_value numeric(18, 2) NOT NULL CHECK (available_pkr_carrying_value >= 0),
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'FULLY_DISTRIBUTED', 'REVERSED', 'CLOSED')),
  external_reference text NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_fx_case_usd_custody_holder_type_check
    CHECK (holder_type IN ('COMPANY_WALLET', 'AGENT', 'THIRD_PARTY')),
  CONSTRAINT import_fx_case_usd_custody_qty_lte
    CHECK (available_quantity <= quantity AND available_pkr_carrying_value <= pkr_carrying_value)
);

CREATE INDEX IF NOT EXISTS idx_import_fx_usd_custody_case
  ON public.import_fx_case_usd_custody_positions (company_id, import_fx_case_id, status);

CREATE INDEX IF NOT EXISTS idx_import_fx_usd_custody_holder
  ON public.import_fx_case_usd_custody_positions (company_id, holder_type, holder_contact_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_fx_usd_custody_acq_active
  ON public.import_fx_case_usd_custody_positions (acquisition_id)
  WHERE status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- C) Distribution batches + lines (operational instructions; W4/W5 may block execution)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_fx_case_distribution_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  branch_id uuid NULL REFERENCES public.branches(id),
  import_fx_case_id uuid NOT NULL REFERENCES public.import_fx_cases(id) ON DELETE CASCADE,
  acquisition_id uuid NOT NULL REFERENCES public.import_fx_case_usd_acquisitions(id),
  custody_position_id uuid NULL REFERENCES public.import_fx_case_usd_custody_positions(id),
  instruction_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'READY', 'EXECUTION_BLOCKED', 'EXECUTED', 'CANCELLED', 'REVERSED')),
  client_operation_id text NULL,
  external_reference text NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_fx_dist_batch_client_op
  ON public.import_fx_case_distribution_batches (company_id, client_operation_id)
  WHERE client_operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_fx_dist_batch_case
  ON public.import_fx_case_distribution_batches (company_id, import_fx_case_id, status);

CREATE TABLE IF NOT EXISTS public.import_fx_case_distribution_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  batch_id uuid NOT NULL REFERENCES public.import_fx_case_distribution_batches(id) ON DELETE CASCADE,
  import_fx_case_id uuid NOT NULL REFERENCES public.import_fx_cases(id) ON DELETE CASCADE,
  recipient_contact_id uuid NOT NULL REFERENCES public.contacts(id),
  recipient_role text NULL,
  purpose text NOT NULL,
  linked_purchase_id uuid NULL REFERENCES public.purchases(id),
  currency text NOT NULL DEFAULT 'USD',
  instructed_qty numeric(18, 6) NOT NULL CHECK (instructed_qty > 0),
  executed_qty numeric(18, 6) NOT NULL DEFAULT 0 CHECK (executed_qty >= 0),
  allocated_pkr_carrying numeric(18, 2) NOT NULL DEFAULT 0 CHECK (allocated_pkr_carrying >= 0),
  status text NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED', 'EXECUTION_BLOCKED', 'EXECUTED', 'CANCELLED', 'REVERSED')),
  requires_wave text NULL,
  review_code text NULL,
  blocks_supplier_ap boolean NOT NULL DEFAULT true,
  external_reference text NULL,
  notes text NULL,
  line_order int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_fx_case_dist_purpose_check
    CHECK (purpose IN (
      'SUPPLIER_INVOICE_SETTLEMENT',
      'SUPPLIER_ADVANCE',
      'THIRD_PARTY_CUSTODY',
      'CONVERSION_COUNTERPARTY',
      'CUSTOMER_REFUND',
      'EXPENSE_PAYMENT_ON_BEHALF',
      'BRANCH_OR_INTERCOMPANY_TRANSFER',
      'OTHER_REVIEW_REQUIRED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_import_fx_dist_lines_batch
  ON public.import_fx_case_distribution_lines (batch_id, line_order);

CREATE INDEX IF NOT EXISTS idx_import_fx_dist_lines_recipient
  ON public.import_fx_case_distribution_lines (company_id, recipient_contact_id, purpose, status);

-- ---------------------------------------------------------------------------
-- D) RLS — SELECT company-scoped; writes RPC-only
-- ---------------------------------------------------------------------------
ALTER TABLE public.import_fx_case_usd_custody_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fx_case_distribution_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fx_case_distribution_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_fx_usd_custody_select_company ON public.import_fx_case_usd_custody_positions;
CREATE POLICY import_fx_usd_custody_select_company
  ON public.import_fx_case_usd_custody_positions FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS import_fx_dist_batch_select_company ON public.import_fx_case_distribution_batches;
CREATE POLICY import_fx_dist_batch_select_company
  ON public.import_fx_case_distribution_batches FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS import_fx_dist_lines_select_company ON public.import_fx_case_distribution_lines;
CREATE POLICY import_fx_dist_lines_select_company
  ON public.import_fx_case_distribution_lines FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

REVOKE INSERT, UPDATE, DELETE ON public.import_fx_case_usd_custody_positions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.import_fx_case_distribution_batches FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.import_fx_case_distribution_lines FROM authenticated, anon;
GRANT SELECT ON public.import_fx_case_usd_custody_positions TO authenticated;
GRANT SELECT ON public.import_fx_case_distribution_batches TO authenticated;
GRANT SELECT ON public.import_fx_case_distribution_lines TO authenticated;
GRANT ALL ON public.import_fx_case_usd_custody_positions TO service_role;
GRANT ALL ON public.import_fx_case_distribution_batches TO service_role;
GRANT ALL ON public.import_fx_case_distribution_lines TO service_role;

COMMENT ON TABLE public.import_fx_case_usd_custody_positions IS
  'W3.1 operational custody: who holds USD qty + PKR carrying. Not a per-party CoA account.';
COMMENT ON TABLE public.import_fx_case_distribution_batches IS
  'W3.1 distribution instruction batches. Financial execution may be blocked until W4/W5.';
COMMENT ON TABLE public.import_fx_case_distribution_lines IS
  'W3.1 distribution rows. Supplier purpose does not reduce AP until W5.';

-- ---------------------------------------------------------------------------
-- E) Client operation event types
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- widen check if present as constraint on event_type column values via app convention only
  NULL;
END $$;

COMMIT;
