-- Customer AR statement: same party attribution as get_contact_party_gl_balances (1100 control only).
-- Mirrors get_supplier_ap_gl_ledger_for_contact with asset convention (running += debit − credit).

CREATE OR REPLACE FUNCTION public.get_customer_ar_gl_ledger_for_contact(
  p_company_id uuid,
  p_customer_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $BODY$
  WITH ar AS (
    SELECT a.id AS ar_id
    FROM public.accounts a
    WHERE a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = '1100'
      AND COALESCE(a.is_active, TRUE)
    LIMIT 1
  ),
  je_lines AS (
    SELECT
      jel.id AS jel_id,
      jel.debit AS dr,
      jel.credit AS cr,
      je.id AS je_id,
      je.entry_date::date AS ed,
      je.created_at AS ca,
      je.entry_no AS eno,
      COALESCE(NULLIF(TRIM(COALESCE(je.description, '')), ''), NULLIF(TRIM(COALESCE(jel.description, '')), ''), '—') AS descr,
      je.payment_id AS pid,
      je.branch_id AS bid,
      br.name AS bname,
      TRIM(COALESCE(acc.code, '')) AS acode,
      COALESCE(acc.name, '') AS aname,
      CASE
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public._gl_resolve_party_id_for_journal_entry(p_company_id, je.reference_id::uuid)
        ELSE public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id)
      END AS party_id
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    CROSS JOIN ar
    LEFT JOIN public.branches br ON br.id = je.branch_id
    LEFT JOIN public.accounts acc ON acc.id = jel.account_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND jel.account_id = ar.ar_id
      AND (
        p_branch_id IS NULL
        OR je.branch_id IS NULL
        OR je.branch_id = p_branch_id
      )
  ),
  for_customer AS (
    SELECT * FROM je_lines WHERE party_id = p_customer_id
  ),
  opening_calc AS (
    SELECT COALESCE(SUM(fs.dr - fs.cr), 0)::numeric AS ob
    FROM for_customer fs
    WHERE p_start_date IS NOT NULL
      AND fs.ed < p_start_date
  ),
  ob_val AS (
    SELECT COALESCE((SELECT ob FROM opening_calc), 0::numeric) AS v
  ),
  ordered AS (
    SELECT
      fs.*,
      (SELECT v FROM ob_val) AS pob
    FROM for_customer fs
    WHERE (p_start_date IS NULL OR fs.ed >= p_start_date)
      AND (p_end_date IS NULL OR fs.ed <= p_end_date)
  ),
  with_running AS (
    SELECT
      o.jel_id,
      o.je_id,
      o.ed,
      o.ca,
      o.eno,
      o.descr,
      o.dr,
      o.cr,
      o.pid,
      o.bid,
      o.bname,
      o.acode,
      o.aname,
      o.pob,
      o.pob + SUM(o.dr - o.cr) OVER (
        ORDER BY o.ed ASC, o.ca ASC NULLS LAST, o.eno ASC NULLS LAST, o.jel_id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS rb
    FROM ordered o
  )
  SELECT json_build_object(
    'period_opening_balance', (SELECT v FROM ob_val),
    'rows', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'journal_entry_line_id', t.jel_id,
            'journal_entry_id', t.je_id,
            'entry_date', t.ed,
            'created_at', t.ca,
            'entry_no', t.eno,
            'description', t.descr,
            'debit', t.dr,
            'credit', t.cr,
            'running_balance', t.rb,
            'period_opening_balance', t.pob,
            'payment_id', t.pid,
            'branch_id', t.bid,
            'branch_name', t.bname,
            'account_code', t.acode,
            'account_name', t.aname
          )
          ORDER BY t.ed ASC, t.ca ASC NULLS LAST, t.eno ASC NULLS LAST, t.jel_id ASC
        )
        FROM with_running t
      ),
      '[]'::json
    )
  );
$BODY$;

COMMENT ON FUNCTION public.get_customer_ar_gl_ledger_for_contact(UUID, UUID, UUID, DATE, DATE) IS
  'AR (code 1100) lines for one customer using _gl_resolve_party_id_for_journal_entry — parity with get_contact_party_gl_balances. Returns JSON: period_opening_balance + rows.';

GRANT EXECUTE ON FUNCTION public.get_customer_ar_gl_ledger_for_contact(UUID, UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_ar_gl_ledger_for_contact(UUID, UUID, UUID, DATE, DATE) TO service_role;
