-- G-PAR-02b: Close AR/AP/worker party resolver gap for payment-linked JEs.
-- Problem: getCustomerLedger matches reference_type=payment via payment id + sale graph;
--          _gl_resolve_party_id_for_journal_entry only used payments.contact_id, so
--          sale-linked receipts with NULL contact_id on payments stayed "unmapped" (top bucket = payment).
-- Non-destructive: new helper + CREATE OR REPLACE _gl_resolve_party_id_for_journal_entry only.

CREATE OR REPLACE FUNCTION public._gl_party_id_from_payment_row(
  p_company_id uuid,
  p_payment_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $BODY$
  SELECT COALESCE(
    pay.contact_id,
    CASE
      WHEN LOWER(TRIM(COALESCE(pay.reference_type, ''))) IN (
        'sale', 'sale_return', 'sale_adjustment', 'sale_extra_expense'
      )
        AND pay.reference_id IS NOT NULL
      THEN (
        SELECT s.customer_id
        FROM public.sales s
        WHERE s.id = pay.reference_id::uuid AND s.company_id = p_company_id
        LIMIT 1
      )
      WHEN LOWER(TRIM(COALESCE(pay.reference_type, ''))) IN (
        'purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal'
      )
        AND pay.reference_id IS NOT NULL
      THEN (
        SELECT p.supplier_id
        FROM public.purchases p
        WHERE p.id = pay.reference_id::uuid AND p.company_id = p_company_id
        LIMIT 1
      )
      WHEN LOWER(TRIM(COALESCE(pay.reference_type, ''))) IN ('worker_payment', 'worker_advance_settlement')
        AND pay.reference_id IS NOT NULL
      THEN pay.reference_id::uuid
      ELSE NULL
    END
  )
  FROM public.payments pay
  WHERE pay.id = p_payment_id
    AND pay.company_id = p_company_id
  LIMIT 1;
$BODY$;

COMMENT ON FUNCTION public._gl_party_id_from_payment_row(UUID, UUID) IS
  'Party contact_id from payments row: contact_id, else customer/supplier/worker via reference_type + reference_id.';

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
    -- manual_payment JEs use reference_id = payments.id (Add Entry V2); party is on the payment row, not this UUID as contact_id
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'manual_payment'
      AND je.reference_id IS NOT NULL
      AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public._gl_party_id_from_payment_row(p_company_id, je.reference_id::uuid)
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'sale_return', 'sale_adjustment', 'sale_extra_expense')
      AND je.reference_id IS NOT NULL
      THEN (
        SELECT s.customer_id FROM public.sales s
        WHERE s.id = je.reference_id::uuid AND s.company_id = p_company_id LIMIT 1
      )
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal')
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
    WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('payment', 'payment_adjustment')
      AND je.reference_id IS NOT NULL
      AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public._gl_party_id_from_payment_row(p_company_id, je.reference_id::uuid)
    WHEN je.payment_id IS NOT NULL
    THEN public._gl_party_id_from_payment_row(p_company_id, je.payment_id)
    ELSE NULL
  END
  FROM public.journal_entries je
  WHERE je.id = p_je_id AND je.company_id = p_company_id;
$BODY$;

GRANT EXECUTE ON FUNCTION public._gl_party_id_from_payment_row(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public._gl_party_id_from_payment_row(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public._gl_resolve_party_id_for_journal_entry(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public._gl_resolve_party_id_for_journal_entry(UUID, UUID) TO service_role;
