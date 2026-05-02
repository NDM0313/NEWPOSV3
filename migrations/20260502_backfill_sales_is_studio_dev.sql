-- Backfill sales.is_studio (and sale_type) for rows that are clearly studio but flag was never set.
-- Run on dev (or prod) when Studio Sales list misses invoices created before is_studio was set.
-- Idempotent: only updates rows that do not already have is_studio = true.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'is_studio'
  ) THEN
    RAISE NOTICE 'sales.is_studio missing; run migrations/sales_is_studio_column.sql first.';
    RETURN;
  END IF;

  -- 1) Any sale linked to studio_productions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'studio_productions' AND column_name = 'sale_id'
  ) THEN
    UPDATE sales s
    SET
      is_studio = true,
      updated_at = NOW()
    FROM studio_productions p
    WHERE p.sale_id = s.id
      AND s.is_studio IS NOT TRUE;
  END IF;

  -- 2a) Invoice number prefixes (always safe)
  UPDATE public.sales
  SET
    is_studio = true,
    updated_at = NOW()
  WHERE is_studio IS NOT TRUE
    AND (
      invoice_no ILIKE 'STD-%'
      OR invoice_no ILIKE 'ST-%'
    );

  -- 2b) Order number prefixes (only if column exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'order_no'
  ) THEN
    UPDATE public.sales
    SET
      is_studio = true,
      updated_at = NOW()
    WHERE is_studio IS NOT TRUE
      AND order_no IS NOT NULL
      AND (order_no ILIKE 'STD-%' OR order_no ILIKE 'ST-%');
  END IF;

  -- 3) sale_type already studio but is_studio false (repair inconsistency)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'sale_type'
  ) THEN
    UPDATE public.sales
    SET
      is_studio = true,
      updated_at = NOW()
    WHERE is_studio IS NOT TRUE
      AND LOWER(TRIM(COALESCE(sale_type, ''))) = 'studio';
  END IF;
END $$;

-- Align sale_type for rows now flagged studio (do not override rental)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'sale_type'
  ) THEN
    UPDATE public.sales
    SET
      sale_type = 'studio',
      updated_at = NOW()
    WHERE is_studio = true
      AND LOWER(TRIM(COALESCE(sale_type, ''))) NOT IN ('studio', 'rental');
  END IF;
END $$;
