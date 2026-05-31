-- Parent–child link for injected fabric lines on bespoke custom orders

SET search_path = public;

DO $col$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_items' AND column_name = 'bespoke_parent_item_id'
  ) THEN
    ALTER TABLE public.sales_items
      ADD COLUMN bespoke_parent_item_id uuid NULL
        REFERENCES public.sales_items(id) ON DELETE CASCADE;
  END IF;
END $col$;

CREATE INDEX IF NOT EXISTS idx_sales_items_bespoke_parent
  ON public.sales_items(sale_id, bespoke_parent_item_id)
  WHERE bespoke_parent_item_id IS NOT NULL;

COMMENT ON COLUMN public.sales_items.bespoke_parent_item_id IS
  'Fabric child line points to parent generic custom-order sales_items row';
