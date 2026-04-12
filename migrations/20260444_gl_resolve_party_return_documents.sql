-- Sale / purchase return JEs use reference_id = return document UUID.
-- Resolve party from sale_returns / purchase_returns (not sales / purchases).
-- Normalize legacy reference_type values like 'Sale Return' -> sale_return for RPC party filters.

CREATE OR REPLACE FUNCTION public._gl_resolve_party_id_for_journal_entry(
  p_company_id uuid,
  p_je_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $BODY$
  SELECT CASE
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'opening_balance_contact_ar'
      AND je.reference_id IS NOT NULL
      THEN je.reference_id::uuid
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'opening_balance_contact_ap'
      AND je.reference_id IS NOT NULL
      THEN je.reference_id::uuid
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'opening_balance_contact_worker'
      AND je.reference_id IS NOT NULL
      THEN je.reference_id::uuid
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'manual_receipt'
      AND je.reference_id IS NOT NULL
      THEN je.reference_id::uuid
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'manual_payment'
      AND je.reference_id IS NOT NULL
      THEN je.reference_id::uuid
    WHEN LOWER(REGEXP_REPLACE(TRIM(COALESCE(je.reference_type, '')), '\s+', '_', 'g')) = 'sale_return'
      AND je.reference_id IS NOT NULL
      THEN (
        SELECT sr.customer_id FROM public.sale_returns sr
        WHERE sr.id = je.reference_id::uuid AND sr.company_id = p_company_id LIMIT 1
      )
    WHEN LOWER(REGEXP_REPLACE(TRIM(COALESCE(je.reference_type, '')), '\s+', '_', 'g')) IN ('sale', 'sale_adjustment', 'sale_extra_expense', 'sale_reversal')
      AND je.reference_id IS NOT NULL
      THEN (
        SELECT s.customer_id FROM public.sales s
        WHERE s.id = je.reference_id::uuid AND s.company_id = p_company_id LIMIT 1
      )
    WHEN LOWER(REGEXP_REPLACE(TRIM(COALESCE(je.reference_type, '')), '\s+', '_', 'g')) = 'purchase_return'
      AND je.reference_id IS NOT NULL
      THEN (
        SELECT pr.supplier_id FROM public.purchase_returns pr
        WHERE pr.id = je.reference_id::uuid AND pr.company_id = p_company_id LIMIT 1
      )
    WHEN LOWER(REGEXP_REPLACE(TRIM(COALESCE(je.reference_type, '')), '\s+', '_', 'g')) IN ('purchase', 'purchase_adjustment', 'purchase_reversal')
      AND je.reference_id IS NOT NULL
      THEN (
        SELECT p.supplier_id FROM public.purchases p
        WHERE p.id = je.reference_id::uuid AND p.company_id = p_company_id LIMIT 1
      )
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('worker_payment', 'worker_advance_settlement')
      AND je.reference_id IS NOT NULL
      THEN je.reference_id::uuid
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('studio_production_stage', 'studio_production_stage_reversal')
      AND je.reference_id IS NOT NULL
      THEN (
        SELECT st.assigned_worker_id FROM public.studio_production_stages st
        WHERE st.id = je.reference_id::uuid LIMIT 1
      )
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'rental'
      AND je.reference_id IS NOT NULL
      THEN (
        SELECT r.customer_id FROM public.rentals r
        WHERE r.id = je.reference_id::uuid AND r.company_id = p_company_id LIMIT 1
      )
    WHEN je.payment_id IS NOT NULL THEN
      (SELECT pay.contact_id FROM public.payments pay
       WHERE pay.id = je.payment_id AND pay.company_id = p_company_id LIMIT 1)
    ELSE NULL
  END
  FROM public.journal_entries je
  WHERE je.id = p_je_id AND je.company_id = p_company_id;
$BODY$;

COMMENT ON FUNCTION public._gl_resolve_party_id_for_journal_entry(UUID, UUID) IS
  'Map journal entry to party contact_id: sale_return/purchase_return use return row; sale/purchase use document row; whitespace reference_type normalized.';

-- Legacy UI posted reference_type with a space ("sale return") — party resolver never matched.
UPDATE public.journal_entries je
SET reference_type = 'sale_return',
    updated_at = COALESCE(je.updated_at, now())
WHERE je.reference_type IS NOT NULL
  AND LOWER(REGEXP_REPLACE(TRIM(je.reference_type), '\s+', '_', 'g')) = 'sale_return'
  AND TRIM(je.reference_type) IS DISTINCT FROM 'sale_return';
