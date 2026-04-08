-- AR/AP party GL read parity with posted subledger accounts (linked_contact_id under 1100/2000).
-- Root cause: saleAccountingService posts Dr AR to resolveReceivablePostingAccountId() (child under 1100),
-- but get_contact_party_gl_balances / get_customer_ar_gl_ledger_for_contact only matched journal lines on the
-- control account id — sale debits on AR-{contact} were invisible to party GL, statements, and control drawer.
-- Mirrors the supplier subtree pattern from 20260329_ap_subtree_supplier_party_gl.sql, merged with
-- _gl_resolve_party_id_for_journal_entry + correction_reversal (20260405/20260406).

-- ---------------------------------------------------------------------------
-- 1) Per-contact party balances: AR + AP use control subtrees; party = linked_contact_id OR resolver
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contact_party_gl_balances(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  contact_id UUID,
  gl_ar_receivable NUMERIC,
  gl_ap_payable NUMERIC,
  gl_worker_payable NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
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
  ap_control AS (
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
  acct AS (
    SELECT
      (SELECT ar_id FROM ar_control) AS ar_id,
      (SELECT ap_id FROM ap_control) AS ap_id,
      (SELECT a.id FROM public.accounts a
       WHERE a.company_id = p_company_id AND TRIM(COALESCE(a.code, '')) = '2010' AND COALESCE(a.is_active, TRUE) LIMIT 1) AS wp_id,
      (SELECT a.id FROM public.accounts a
       WHERE a.company_id = p_company_id AND TRIM(COALESCE(a.code, '')) = '1180' AND COALESCE(a.is_active, TRUE) LIMIT 1) AS wa_id
  ),
  resolved AS (
    SELECT
      jel.account_id,
      jel.debit,
      jel.credit,
      acc.linked_contact_id AS acc_linked_contact_id,
      CASE
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public._gl_resolve_party_id_for_journal_entry(p_company_id, je.reference_id::uuid)
        ELSE public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id)
      END AS party_id_resolved
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    LEFT JOIN public.accounts acc ON acc.id = jel.account_id AND acc.company_id = p_company_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND (
        p_branch_id IS NULL
        OR je.branch_id IS NULL
        OR je.branch_id = p_branch_id
      )
  ),
  ar_agg AS (
    SELECT x.party_key AS party_id, SUM(x.dr - x.cr) AS net
    FROM (
      SELECT
        r.debit AS dr,
        r.credit AS cr,
        CASE
          WHEN r.acc_linked_contact_id IS NOT NULL THEN r.acc_linked_contact_id
          ELSE r.party_id_resolved
        END AS party_key
      FROM resolved r
      WHERE r.account_id IN (SELECT id FROM ar_subtree)
    ) x
    WHERE x.party_key IS NOT NULL
    GROUP BY x.party_key
  ),
  ap_agg AS (
    SELECT x.party_key AS party_id, SUM(x.cr - x.dr) AS net
    FROM (
      SELECT
        r.debit AS dr,
        r.credit AS cr,
        CASE
          WHEN r.acc_linked_contact_id IS NOT NULL THEN r.acc_linked_contact_id
          ELSE r.party_id_resolved
        END AS party_key
      FROM resolved r
      WHERE r.account_id IN (SELECT id FROM ap_subtree)
    ) x
    WHERE x.party_key IS NOT NULL
    GROUP BY x.party_key
  ),
  wp_agg AS (
    SELECT r.party_id_resolved AS party_id, SUM(r.credit - r.debit) AS net
    FROM resolved r
    CROSS JOIN acct
    WHERE acct.wp_id IS NOT NULL AND r.account_id = acct.wp_id AND r.party_id_resolved IS NOT NULL
    GROUP BY r.party_id_resolved
  ),
  wa_agg AS (
    SELECT r.party_id_resolved AS party_id, SUM(r.debit - r.credit) AS net_dr
    FROM resolved r
    CROSS JOIN acct
    WHERE acct.wa_id IS NOT NULL AND r.account_id = acct.wa_id AND r.party_id_resolved IS NOT NULL
    GROUP BY r.party_id_resolved
  ),
  wk AS (
    SELECT
      COALESCE(wp.party_id, wa.party_id) AS party_id,
      GREATEST(0::numeric, COALESCE(wp.net, 0::numeric) - COALESCE(wa.net_dr, 0::numeric)) AS net_payable
    FROM wp_agg wp
    FULL OUTER JOIN wa_agg wa ON wp.party_id = wa.party_id
  )
  SELECT
    c.id AS contact_id,
    COALESCE(ar.net, 0)::numeric AS gl_ar_receivable,
    COALESCE(ap.net, 0)::numeric AS gl_ap_payable,
    COALESCE(wk.net_payable, 0)::numeric AS gl_worker_payable
  FROM public.contacts c
  LEFT JOIN ar_agg ar ON ar.party_id = c.id
  LEFT JOIN ap_agg ap ON ap.party_id = c.id
  LEFT JOIN wk ON wk.party_id = c.id
  WHERE c.company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) IS
  'GL per-contact: AR on 1100 subtree (control + party sub-accounts); AP on 2000 subtree; worker net on 2010/1180. Party = accounts.linked_contact_id when set, else _gl_resolve_party_id_for_journal_entry.';

GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Customer AR statement: lines on 1100 subtree; party = linked_contact_id OR resolver
-- ---------------------------------------------------------------------------
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
      COALESCE(NULLIF(TRIM(COALESCE(je.description, '')), ''), NULLIF(TRIM(COALESCE(jel.description, '')), ''), '—') AS descr,
      je.payment_id AS pid,
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
  'AR lines for one customer: all accounts in 1100 subtree; party = linked_contact_id on line account when set, else _gl_resolve_party_id_for_journal_entry.';

GRANT EXECUTE ON FUNCTION public.get_customer_ar_gl_ledger_for_contact(UUID, UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_ar_gl_ledger_for_contact(UUID, UUID, UUID, DATE, DATE) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Supplier AP statement: restore 2000 subtree (parity with AR fix)
-- ---------------------------------------------------------------------------
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
      COALESCE(NULLIF(TRIM(COALESCE(je.description, '')), ''), NULLIF(TRIM(COALESCE(jel.description, '')), ''), '—') AS descr,
      je.payment_id AS pid,
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
  'AP lines for one supplier: 2000 subtree; party = linked_contact_id when set, else _gl_resolve_party_id_for_journal_entry.';

GRANT EXECUTE ON FUNCTION public.get_supplier_ap_gl_ledger_for_contact(UUID, UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_ap_gl_ledger_for_contact(UUID, UUID, UUID, DATE, DATE) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Unmapped buckets: include full 1100 / 2000 subtrees so child-only lines are classified
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_control_unmapped_party_gl_buckets(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_control_code TEXT DEFAULT '1100'
)
RETURNS TABLE (
  reference_type TEXT,
  net_amount NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := UPPER(TRIM(COALESCE(p_control_code, '')));
  v_root_id UUID;
  v_use_ar_convention BOOLEAN;
BEGIN
  SELECT a.id INTO v_root_id
  FROM public.accounts a
  WHERE a.company_id = p_company_id
    AND UPPER(TRIM(COALESCE(a.code, ''))) = v_code
    AND COALESCE(a.is_active, TRUE)
  LIMIT 1;

  IF v_root_id IS NULL THEN
    RETURN;
  END IF;

  v_use_ar_convention := v_code IN ('1100', '1180');

  RETURN QUERY
  WITH RECURSIVE sub AS (
    SELECT v_root_id AS id
    UNION ALL
    SELECT a.id
    FROM public.accounts a
    INNER JOIN sub s ON a.parent_id = s.id
    WHERE a.company_id = p_company_id AND COALESCE(a.is_active, TRUE)
  ),
  resolved AS (
    SELECT
      jel.account_id,
      jel.debit,
      jel.credit,
      je.reference_type,
      CASE
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public._gl_resolve_party_id_for_journal_entry(p_company_id, je.reference_id::uuid)
        ELSE public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id)
      END AS party_id
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND (
        p_branch_id IS NULL
        OR je.branch_id IS NULL
        OR je.branch_id = p_branch_id
      )
      AND jel.account_id IN (SELECT id FROM sub)
  ),
  bucketed AS (
    SELECT
      COALESCE(LOWER(TRIM(COALESCE(r.reference_type, ''))), '(blank)') AS rt,
      SUM(
        CASE
          WHEN v_use_ar_convention THEN (r.debit - r.credit)
          ELSE (r.credit - r.debit)
        END
      )::numeric AS net_amt
    FROM resolved r
    WHERE r.party_id IS NULL
    GROUP BY 1
    HAVING ABS(SUM(
      CASE
        WHEN v_use_ar_convention THEN (r.debit - r.credit)
        ELSE (r.credit - r.debit)
      END
    )) > 0.0000001
  )
  SELECT b.rt::text, ROUND(b.net_amt::numeric, 4)
  FROM bucketed b
  ORDER BY ABS(b.net_amt) DESC;
END;
$$;

COMMENT ON FUNCTION public.get_control_unmapped_party_gl_buckets(UUID, UUID, TEXT) IS
  'Unmapped journal lines under control code subtree (recursive): net per reference_type. 1100/1180 Dr−Cr; 2000/2010 Cr−Dr.';

GRANT EXECUTE ON FUNCTION public.get_control_unmapped_party_gl_buckets(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_control_unmapped_party_gl_buckets(UUID, UUID, TEXT) TO service_role;
