-- Single Core Ledger — Phase 1.5 systemwide diagnostics (read-only views + RPC)
-- NO GRANT to authenticated — staging/service_role CLI only.
-- Uses verified schema columns (see PHASE_1_5 verification report schema audit).

-- ---------------------------------------------------------------------------
-- Per-company diagnostic aggregates (read-only view)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_single_core_ledger_company_diagnostics AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  COALESCE(c.is_active, TRUE) AS company_is_active,
  (
    SELECT COUNT(*)
    FROM payments p
    INNER JOIN sales s ON s.id = p.reference_id AND s.company_id = p.company_id
    WHERE p.company_id = c.id
      AND LOWER(TRIM(COALESCE(p.reference_type, ''))) = 'sale'
      AND p.contact_id IS NULL
      AND p.voided_at IS NULL
  )::bigint AS payments_missing_contact_sale_linked,
  (
    SELECT COUNT(*)
    FROM payments p
    INNER JOIN sales s ON s.id = p.reference_id AND s.company_id = p.company_id
    WHERE p.company_id = c.id
      AND LOWER(TRIM(COALESCE(p.reference_type, ''))) = 'sale'
      AND p.contact_id IS NOT NULL
      AND p.contact_id IS DISTINCT FROM s.customer_id
      AND p.voided_at IS NULL
  )::bigint AS payments_wrong_party_attribution,
  (
    SELECT COUNT(*)
    FROM journal_entries je
    WHERE je.company_id = c.id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND je.branch_id IS NULL
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN (
        'sale', 'payment', 'payment_adjustment', 'manual_receipt', 'purchase', 'rental', 'expense', 'transfer'
      )
  )::bigint AS branch_attribution_risk,
  (
    SELECT COUNT(*)
    FROM sales s
    WHERE s.company_id = c.id
      AND LOWER(TRIM(COALESCE(s.status, ''))) IN ('final', 'finalized')
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je.company_id = s.company_id
          AND COALESCE(je.is_void, FALSE) = FALSE
          AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'sale_adjustment')
          AND je.reference_id = s.id
      )
  )::bigint AS unposted_final_sales,
  (
    SELECT COUNT(*)
    FROM purchases pu
    WHERE pu.company_id = c.id
      AND LOWER(TRIM(COALESCE(pu.status, ''))) IN ('final', 'finalized', 'received')
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je.company_id = pu.company_id
          AND COALESCE(je.is_void, FALSE) = FALSE
          AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('purchase', 'purchase_adjustment')
          AND je.reference_id = pu.id
      )
  )::bigint AS unposted_final_purchases,
  (
    SELECT COUNT(*)
    FROM rentals r
    WHERE r.company_id = c.id
      AND COALESCE(r.total_amount, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je.company_id = r.company_id
          AND COALESCE(je.is_void, FALSE) = FALSE
          AND LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'rental'
          AND je.reference_id = r.id
      )
  )::bigint AS unposted_rentals,
  (
    SELECT COUNT(*)
    FROM journal_entries je
    WHERE je.company_id = c.id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
  )::bigint AS correction_reversal_je_count,
  (
    SELECT COUNT(*)
    FROM journal_entries je
    WHERE je.company_id = c.id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND je.branch_id IS NULL
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) LIKE 'opening_balance%'
  )::bigint AS opening_balance_null_branch_je_count
FROM companies c;

COMMENT ON VIEW public.v_single_core_ledger_company_diagnostics IS
  'Phase 1.5 read-only per-company ledger integrity counts. service_role / direct SQL only — not granted to authenticated.';

-- ---------------------------------------------------------------------------
-- Branch attribution risk detail (transactional NULL branch_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_single_core_ledger_branch_attribution_risk AS
SELECT
  je.company_id,
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.payment_id,
  je.branch_id,
  je.description
FROM journal_entries je
WHERE COALESCE(je.is_void, FALSE) = FALSE
  AND je.branch_id IS NULL
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN (
    'sale', 'payment', 'payment_adjustment', 'manual_receipt', 'purchase', 'rental', 'expense', 'transfer'
  );

COMMENT ON VIEW public.v_single_core_ledger_branch_attribution_risk IS
  'Transactional JEs with NULL branch_id — excluded from branch-specific unified ledgers unless manually verified.';

-- ---------------------------------------------------------------------------
-- Systemwide diagnostics JSON (staging CLI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_single_core_ledger_systemwide_diagnostics()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $BODY$
DECLARE
  v_companies json;
  v_summary json;
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM companies WHERE COALESCE(is_active, TRUE);

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.company_name), '[]'::json)
  INTO v_companies
  FROM (
    SELECT
      d.company_id,
      d.company_name,
      d.company_is_active,
      d.payments_missing_contact_sale_linked,
      d.payments_wrong_party_attribution,
      d.branch_attribution_risk,
      d.unposted_final_sales,
      d.unposted_final_purchases,
      d.unposted_rentals,
      d.correction_reversal_je_count,
      d.opening_balance_null_branch_je_count,
      (
        d.branch_attribution_risk = 0
        AND d.payments_missing_contact_sale_linked = 0
        AND d.payments_wrong_party_attribution = 0
      ) AS strict_pass
    FROM v_single_core_ledger_company_diagnostics d
  ) t;

  SELECT json_build_object(
    'companies_total', v_count,
    'strict_pass_count', (
      SELECT COUNT(*) FROM v_single_core_ledger_company_diagnostics d
      WHERE d.branch_attribution_risk = 0
        AND d.payments_missing_contact_sale_linked = 0
        AND d.payments_wrong_party_attribution = 0
    ),
    'strict_fail_count', (
      SELECT COUNT(*) FROM v_single_core_ledger_company_diagnostics d
      WHERE d.branch_attribution_risk > 0
        OR d.payments_missing_contact_sale_linked > 0
        OR d.payments_wrong_party_attribution > 0
    ),
    'branch_attribution_risk_total', (
      SELECT COALESCE(SUM(d.branch_attribution_risk), 0)
      FROM v_single_core_ledger_company_diagnostics d
    ),
    'warnings_unposted_sales', (
      SELECT COALESCE(SUM(d.unposted_final_sales), 0)
      FROM v_single_core_ledger_company_diagnostics d
    ),
    'warnings_unposted_purchases', (
      SELECT COALESCE(SUM(d.unposted_final_purchases), 0)
      FROM v_single_core_ledger_company_diagnostics d
    )
  ) INTO v_summary;

  RETURN json_build_object(
    'generated_at', NOW() AT TIME ZONE 'UTC',
    'companies_count', v_count,
    'summary', v_summary,
    'companies', v_companies
  );
END;
$BODY$;

COMMENT ON FUNCTION public.get_single_core_ledger_systemwide_diagnostics() IS
  'Phase 1.5 systemwide read-only diagnostics JSON. Apply migration on staging; run via service_role CLI.';

-- Intentionally NOT granted to authenticated (staging / service_role only)
GRANT EXECUTE ON FUNCTION public.get_single_core_ledger_systemwide_diagnostics() TO service_role;
