-- Bespoke tailor work orders (internal production cost; hidden from customer invoice)

SET search_path = public;

DO $$ BEGIN
  CREATE TYPE public.bespoke_work_order_status AS ENUM (
    'draft', 'in_progress', 'completed', 'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.bespoke_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  parent_sales_item_id uuid NOT NULL REFERENCES public.sales_items(id) ON DELETE RESTRICT,
  work_order_no text NOT NULL,
  tailor_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  production_cost numeric(15,2) NOT NULL DEFAULT 0 CHECK (production_cost >= 0),
  status public.bespoke_work_order_status NOT NULL DEFAULT 'draft',
  instructions_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  completed_at timestamptz,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, work_order_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bespoke_wo_sale_parent_active
  ON public.bespoke_work_orders(sale_id, parent_sales_item_id)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_bespoke_work_orders_company ON public.bespoke_work_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_bespoke_work_orders_sale ON public.bespoke_work_orders(sale_id);

COMMENT ON TABLE public.bespoke_work_orders IS
  'Tailor job card / work order for bespoke sales; posts Dr 5000 Cr tailor AP on complete';

ALTER TABLE public.bespoke_work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bespoke_work_orders_select ON public.bespoke_work_orders;
CREATE POLICY bespoke_work_orders_select
  ON public.bespoke_work_orders FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS bespoke_work_orders_insert ON public.bespoke_work_orders;
CREATE POLICY bespoke_work_orders_insert
  ON public.bespoke_work_orders FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS bespoke_work_orders_update ON public.bespoke_work_orders;
CREATE POLICY bespoke_work_orders_update
  ON public.bespoke_work_orders FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

GRANT SELECT, INSERT, UPDATE ON public.bespoke_work_orders TO authenticated;

CREATE OR REPLACE FUNCTION public.update_bespoke_work_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bespoke_work_orders_updated_at ON public.bespoke_work_orders;
CREATE TRIGGER trg_bespoke_work_orders_updated_at
  BEFORE UPDATE ON public.bespoke_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_bespoke_work_orders_updated_at();
