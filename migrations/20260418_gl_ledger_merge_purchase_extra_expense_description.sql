-- Purchase document JEs: journal_entries.description is generic ("Purchase PUR-x from …")
-- while journal_entry_lines carry charge type (freight (purchase), Payable - cargo, …).
-- Party GL RPCs used COALESCE(je.description, jel.description) so line detail was dropped.
-- This helper mirrors accountingService.mergeLedgerEntryDescriptionForStatement; RPC je_lines use it for descr.

CREATE OR REPLACE FUNCTION public._gl_ledger_line_display_description(
  p_reference_type text,
  p_entry_description text,
  p_line_description text
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $f$
  SELECT CASE
    WHEN NULLIF(btrim(COALESCE(p_entry_description, '')), '') IS NULL
     AND NULLIF(btrim(COALESCE(p_line_description, '')), '') IS NULL
      THEN '—'::text
    WHEN NULLIF(btrim(COALESCE(p_line_description, '')), '') IS NULL
      THEN btrim(COALESCE(p_entry_description, ''))
    WHEN NULLIF(btrim(COALESCE(p_entry_description, '')), '') IS NULL
      THEN btrim(COALESCE(p_line_description, ''))
    WHEN lower(btrim(COALESCE(p_line_description, ''))) = lower(btrim(COALESCE(p_entry_description, '')))
      THEN btrim(COALESCE(p_entry_description, ''))
    WHEN position(lower(btrim(COALESCE(p_line_description, ''))) IN lower(btrim(COALESCE(p_entry_description, '')))) > 0
      THEN btrim(COALESCE(p_entry_description, ''))
    WHEN lower(btrim(COALESCE(p_reference_type, ''))) IN ('purchase', 'purchase_adjustment')
      AND (
        COALESCE(p_line_description, '') ~* '\(purchase|adj\)\s*$'
        OR COALESCE(p_line_description, '') ~* '^payable\s*[-–]\s*\S'
        OR COALESCE(p_line_description, '') ~* 'purchase\s+discount'
        OR COALESCE(p_line_description, '') ~* '^discount\s+received'
        OR (
          lower(btrim(COALESCE(p_reference_type, ''))) = 'purchase_adjustment'
          AND COALESCE(p_line_description, '') ~* 'freight/extra'
        )
      )
      THEN btrim(COALESCE(p_entry_description, '')) || ' — ' || btrim(COALESCE(p_line_description, ''))
    WHEN lower(btrim(COALESCE(p_reference_type, ''))) = 'purchase_reversal'
      AND (
        COALESCE(p_line_description, '') ~* '^reversal:\s*'
        OR COALESCE(p_line_description, '') ~* '\(purchase|adj\)\s*$'
        OR COALESCE(p_line_description, '') ~* '^payable\s*[-–]\s*\S'
      )
      THEN btrim(COALESCE(p_entry_description, '')) || ' — ' || btrim(COALESCE(p_line_description, ''))
    ELSE COALESCE(
      NULLIF(btrim(COALESCE(p_entry_description, '')), ''),
      NULLIF(btrim(COALESCE(p_line_description, '')), ''),
      '—'
    )
  END;
$f$;

COMMENT ON FUNCTION public._gl_ledger_line_display_description(text, text, text) IS
  'Statement narration: for purchase-type JEs, append line-level charge/discount text when entry header is generic.';

-- Re-apply party GL RPC bodies from 20260436 with merged descr (keeps payment_adjustment pid COALESCE).

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
  WITH ar_control AS (
    SELECT a.id AS ar_id
    FROM public.accounts a
    WHERE a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = '1100'
      AND COALESCE(a.is_active, TRUE)
    LIMIT 1
  ),
  ar_subtree AS (
    WITH RECURSIVE sub AS (
      SELECT c.ar_id AS id FROM ar_control c WHERE c.ar_id IS NOT NULL
      UNION ALL
      SELECT a.id
      FROM public.accounts a
      INNER JOIN sub s ON a.parent_id = s.id
      WHERE a.company_id = p_company_id AND COALESCE(a.is_active, TRUE)
    )
    SELECT id FROM sub
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
      je.reference_type AS ref_type,
      public._gl_ledger_line_display_description(je.reference_type::text, je.description, jel.description) AS descr,
      COALESCE(
        je.payment_id,
        CASE
          WHEN lower(trim(COALESCE(je.reference_type, ''))) = 'payment_adjustment'
            AND je.reference_id IS NOT NULL
            AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN je.reference_id::uuid
          ELSE NULL
        END
      ) AS pid,
      je.branch_id AS bid,
      br.name AS bname,
      TRIM(COALESCE(acc.code, '')) AS acode,
      COALESCE(acc.name, '') AS aname,
      acc.linked_contact_id AS acc_linked_contact_id,
      CASE
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public._gl_resolve_party_id_for_journal_entry(p_company_id, je.reference_id::uuid)
        ELSE public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id)
      END AS party_resolved
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    INNER JOIN public.accounts acc ON acc.id = jel.account_id AND acc.company_id = p_company_id
    LEFT JOIN public.branches br ON br.id = je.branch_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND jel.account_id IN (SELECT id FROM ar_subtree)
      AND (
        p_branch_id IS NULL
        OR je.branch_id IS NULL
        OR je.branch_id = p_branch_id
      )
  ),
  je_attributed AS (
    SELECT
      j.*,
      CASE
        WHEN j.acc_linked_contact_id IS NOT NULL THEN j.acc_linked_contact_id
        ELSE j.party_resolved
      END AS party_id
    FROM je_lines j
  ),
  for_customer AS (
    SELECT * FROM je_attributed WHERE party_id = p_customer_id
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
      o.ref_type,
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
            'reference_type', t.ref_type,
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
  'AR lines for one customer: 1100 subtree. payment_id includes PF-14 payment_adjustment via reference_id. Purchase charge lines merge entry + line description.';

CREATE OR REPLACE FUNCTION public.get_supplier_ap_gl_ledger_for_contact(
  p_company_id uuid,
  p_supplier_id uuid,
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
  WITH ap_control AS (
    SELECT a.id AS ap_id
    FROM public.accounts a
    WHERE a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = '2000'
      AND COALESCE(a.is_active, TRUE)
    LIMIT 1
  ),
  ap_subtree AS (
    WITH RECURSIVE sub AS (
      SELECT c.ap_id AS id FROM ap_control c WHERE c.ap_id IS NOT NULL
      UNION ALL
      SELECT a.id
      FROM public.accounts a
      INNER JOIN sub s ON a.parent_id = s.id
      WHERE a.company_id = p_company_id AND COALESCE(a.is_active, TRUE)
    )
    SELECT id FROM sub
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
      je.reference_type AS ref_type,
      public._gl_ledger_line_display_description(je.reference_type::text, je.description, jel.description) AS descr,
      COALESCE(
        je.payment_id,
        CASE
          WHEN lower(trim(COALESCE(je.reference_type, ''))) = 'payment_adjustment'
            AND je.reference_id IS NOT NULL
            AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN je.reference_id::uuid
          ELSE NULL
        END
      ) AS pid,
      je.branch_id AS bid,
      br.name AS bname,
      TRIM(COALESCE(acc.code, '')) AS acode,
      COALESCE(acc.name, '') AS aname,
      acc.linked_contact_id AS acc_linked_contact_id,
      CASE
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public._gl_resolve_party_id_for_journal_entry(p_company_id, je.reference_id::uuid)
        ELSE public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id)
      END AS party_resolved
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    INNER JOIN public.accounts acc ON acc.id = jel.account_id AND acc.company_id = p_company_id
    LEFT JOIN public.branches br ON br.id = je.branch_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND jel.account_id IN (SELECT id FROM ap_subtree)
      AND (
        p_branch_id IS NULL
        OR je.branch_id IS NULL
        OR je.branch_id = p_branch_id
      )
  ),
  je_attributed AS (
    SELECT
      j.*,
      CASE
        WHEN j.acc_linked_contact_id IS NOT NULL THEN j.acc_linked_contact_id
        ELSE j.party_resolved
      END AS party_id
    FROM je_lines j
  ),
  for_supplier AS (
    SELECT * FROM je_attributed WHERE party_id = p_supplier_id
  ),
  opening_calc AS (
    SELECT COALESCE(SUM(fs.cr - fs.dr), 0)::numeric AS ob
    FROM for_supplier fs
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
    FROM for_supplier fs
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
      o.ref_type,
      o.descr,
      o.dr,
      o.cr,
      o.pid,
      o.bid,
      o.bname,
      o.acode,
      o.aname,
      o.pob,
      o.pob + SUM(o.cr - o.dr) OVER (
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
            'reference_type', t.ref_type,
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

COMMENT ON FUNCTION public.get_supplier_ap_gl_ledger_for_contact(UUID, UUID, UUID, DATE, DATE) IS
  'AP lines for one supplier: 2000 subtree. payment_id includes PF-14 payment_adjustment via reference_id. Purchase charge lines merge entry + line description.';
