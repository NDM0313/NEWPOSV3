-- ============================================================================
-- ERP Health Dashboard (Admin/Owner Only)
-- View + SECURITY DEFINER function. No DO block, no temp tables.
-- Defensive: checks table/column existence before querying. Production-safe.
-- ============================================================================

-- Drop view first (depends on function)
DROP VIEW IF EXISTS public.erp_health_dashboard;

-- Drop function so we can replace it
DROP FUNCTION IF EXISTS public.get_erp_health_dashboard();

-- Function: returns health rows. Only admin/owner get data; others get empty.
CREATE OR REPLACE FUNCTION public.get_erp_health_dashboard()
RETURNS TABLE(component TEXT, status TEXT, details TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Restrict to admin or owner only
  IF COALESCE(get_user_role()::text, '') NOT IN ('admin', 'owner') THEN
    RETURN;
  END IF;

  -- -------------------------------------------------------------------------
  -- 1. Walk-in Integrity (1 per company)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'system_type') THEN
      RETURN QUERY
      SELECT
        'Walk-in Integrity'::TEXT,
        CASE WHEN EXISTS (
          SELECT 1 FROM public.contacts
          WHERE system_type = 'walking_customer'
          GROUP BY company_id
          HAVING COUNT(*) > 1
        ) THEN 'FAIL'::TEXT ELSE 'OK'::TEXT END,
        'One walk-in per company'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Walk-in Integrity'::TEXT, 'SKIP'::TEXT, 'contacts.system_type missing'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT 'Walk-in Integrity'::TEXT, 'SKIP'::TEXT, 'contacts table does not exist'::TEXT;
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. Orphan Users (users without auth_user_id)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id') THEN
      RETURN QUERY
      SELECT
        'Orphan Users'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM public.users WHERE auth_user_id IS NULL) > 0 THEN 'FAIL'::TEXT ELSE 'OK'::TEXT END,
        (SELECT COALESCE((SELECT COUNT(*)::TEXT FROM public.users WHERE auth_user_id IS NULL), '0') || ' without auth_user_id')::TEXT;
    ELSE
      RETURN QUERY SELECT 'Orphan Users'::TEXT, 'SKIP'::TEXT, 'users.auth_user_id missing'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT 'Orphan Users'::TEXT, 'SKIP'::TEXT, 'users table does not exist'::TEXT;
  END IF;

  -- -------------------------------------------------------------------------
  -- 3. Orphan Sales (sales.customer_id not in contacts)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'customer_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
        RETURN QUERY
        SELECT
          'Orphan Sales'::TEXT,
          CASE WHEN (SELECT COUNT(*) FROM public.sales s WHERE s.customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = s.customer_id)) > 0 THEN 'FAIL'::TEXT ELSE 'OK'::TEXT END,
          (SELECT COALESCE((SELECT COUNT(*)::TEXT FROM public.sales s WHERE s.customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = s.customer_id)), '0') || ' orphan sale(s)')::TEXT;
      ELSE
        RETURN QUERY SELECT 'Orphan Sales'::TEXT, 'SKIP'::TEXT, 'contacts table does not exist'::TEXT;
      END IF;
    ELSE
      RETURN QUERY SELECT 'Orphan Sales'::TEXT, 'SKIP'::TEXT, 'sales.customer_id missing'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT 'Orphan Sales'::TEXT, 'SKIP'::TEXT, 'sales table does not exist'::TEXT;
  END IF;

  -- -------------------------------------------------------------------------
  -- 4. Negative Stock (inventory_balance.quantity < 0)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_balance') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_balance' AND column_name = 'quantity') THEN
      RETURN QUERY
      SELECT
        'Negative Stock'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM public.inventory_balance WHERE quantity < 0) > 0 THEN 'FAIL'::TEXT ELSE 'OK'::TEXT END,
        (SELECT COALESCE((SELECT COUNT(*)::TEXT FROM public.inventory_balance WHERE quantity < 0), '0') || ' row(s) with quantity < 0')::TEXT;
    ELSE
      RETURN QUERY SELECT 'Negative Stock'::TEXT, 'SKIP'::TEXT, 'inventory_balance.quantity missing'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT 'Negative Stock'::TEXT, 'SKIP'::TEXT, 'inventory_balance table does not exist'::TEXT;
  END IF;

  -- -------------------------------------------------------------------------
  -- 5. Document Sequence Validity (current_number >= 0)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_sequences_global') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'document_sequences_global' AND column_name = 'current_number') THEN
      RETURN QUERY
      SELECT
        'Document Sequence Validity'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM public.document_sequences_global WHERE current_number < 0) > 0 THEN 'FAIL'::TEXT ELSE 'OK'::TEXT END,
        (SELECT COALESCE((SELECT COUNT(*)::TEXT FROM public.document_sequences_global WHERE current_number < 0), '0') || ' row(s) with current_number < 0')::TEXT;
    ELSE
      RETURN QUERY SELECT 'Document Sequence Validity'::TEXT, 'SKIP'::TEXT, 'document_sequences_global.current_number missing'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT 'Document Sequence Validity'::TEXT, 'SKIP'::TEXT, 'document_sequences_global table does not exist'::TEXT;
  END IF;

  -- -------------------------------------------------------------------------
  -- 6. Sales created_by integrity (must exist in auth.users)
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'created_by') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        RETURN QUERY
        SELECT
          'Sales created_by integrity'::TEXT,
          CASE WHEN (SELECT COUNT(*) FROM public.sales s WHERE s.created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.created_by)) > 0 THEN 'FAIL'::TEXT ELSE 'OK'::TEXT END,
          (SELECT COALESCE((SELECT COUNT(*)::TEXT FROM public.sales s WHERE s.created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.created_by)), '0') || ' sale(s) with invalid created_by')::TEXT;
      ELSE
        RETURN QUERY SELECT 'Sales created_by integrity'::TEXT, 'SKIP'::TEXT, 'auth.users not accessible'::TEXT;
      END IF;
    ELSE
      RETURN QUERY SELECT 'Sales created_by integrity'::TEXT, 'SKIP'::TEXT, 'sales.created_by missing'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT 'Sales created_by integrity'::TEXT, 'SKIP'::TEXT, 'sales table does not exist'::TEXT;
  END IF;

  -- -------------------------------------------------------------------------
  -- 7. Payments received_by integrity
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'received_by') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        RETURN QUERY
        SELECT
          'Payments received_by integrity'::TEXT,
          CASE WHEN (SELECT COUNT(*) FROM public.payments p WHERE p.received_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.received_by)) > 0 THEN 'FAIL'::TEXT ELSE 'OK'::TEXT END,
          (SELECT COALESCE((SELECT COUNT(*)::TEXT FROM public.payments p WHERE p.received_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.received_by)), '0') || ' payment(s) with invalid received_by')::TEXT;
      ELSE
        RETURN QUERY SELECT 'Payments received_by integrity'::TEXT, 'SKIP'::TEXT, 'auth.users not accessible'::TEXT;
      END IF;
    ELSE
      RETURN QUERY SELECT 'Payments received_by integrity'::TEXT, 'SKIP'::TEXT, 'payments.received_by missing'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT 'Payments received_by integrity'::TEXT, 'SKIP'::TEXT, 'payments table does not exist'::TEXT;
  END IF;

  -- -------------------------------------------------------------------------
  -- 8. OVERALL (computed from component rows - done in app or via second pass)
  -- We add OVERALL here by re-checking: if any component would be FAIL, OVERALL = FAIL.
  -- Simplified: we don't re-query; frontend computes OVERALL from returned rows.
  -- So we don't add an OVERALL row in DB; frontend adds it.
  -- Task said "Each row must return component, status, details" and "Compute OVERALL" in Phase 4 frontend.
  -- So no OVERALL row from DB. Frontend will compute and display OVERALL.
  -- -------------------------------------------------------------------------
  RETURN;
END;
$$;

-- View: exposes dashboard to SELECT (still guarded by function's role check)
CREATE VIEW public.erp_health_dashboard AS
SELECT component, status, details
FROM public.get_erp_health_dashboard();

COMMENT ON FUNCTION public.get_erp_health_dashboard() IS 'ERP health dashboard; only admin/owner get rows. Defensive checks, no DO block.';
COMMENT ON VIEW public.erp_health_dashboard IS 'Admin/owner only: SELECT from get_erp_health_dashboard().';
