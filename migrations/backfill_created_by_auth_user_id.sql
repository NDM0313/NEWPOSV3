-- ============================================================================
-- BACKFILL: created_by from public.users.id to auth.users.id (auth_user_id)
-- Rule: created_by must store auth.uid(); display joins on users.auth_user_id.
-- Run once to fix old rows where created_by was set to public.users.id.
-- ============================================================================

-- Sales
UPDATE sales s
SET created_by = u.auth_user_id
FROM public.users u
WHERE s.created_by = u.id
  AND u.auth_user_id IS NOT NULL
  AND s.created_by IS DISTINCT FROM u.auth_user_id;

-- Purchases
UPDATE purchases p
SET created_by = u.auth_user_id
FROM public.users u
WHERE p.created_by = u.id
  AND u.auth_user_id IS NOT NULL
  AND p.created_by IS DISTINCT FROM u.auth_user_id;

-- Rentals (if table has created_by)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'created_by') THEN
    UPDATE rentals r
    SET created_by = u.auth_user_id
    FROM public.users u
    WHERE r.created_by = u.id
      AND u.auth_user_id IS NOT NULL
      AND r.created_by IS DISTINCT FROM u.auth_user_id;
  END IF;
END $$;

-- Stock movements (if created_by exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'created_by') THEN
    UPDATE stock_movements sm
    SET created_by = u.auth_user_id
    FROM public.users u
    WHERE sm.created_by = u.id
      AND u.auth_user_id IS NOT NULL
      AND sm.created_by IS DISTINCT FROM u.auth_user_id;
  END IF;
END $$;

-- Journal entries (if created_by exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'created_by') THEN
    UPDATE journal_entries je
    SET created_by = u.auth_user_id
    FROM public.users u
    WHERE je.created_by = u.id
      AND u.auth_user_id IS NOT NULL
      AND je.created_by IS DISTINCT FROM u.auth_user_id;
  END IF;
END $$;

-- Payments: backfill only if created_by currently equals public.users.id (legacy)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'created_by') THEN
    UPDATE payments pay
    SET created_by = u.auth_user_id
    FROM public.users u
    WHERE pay.created_by = u.id
      AND u.auth_user_id IS NOT NULL
      AND pay.created_by IS DISTINCT FROM u.auth_user_id;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- skip if type mismatch
END $$;

COMMENT ON TABLE sales IS 'created_by = auth.users.id (identity). Display: join users on users.auth_user_id = sales.created_by.';
