-- Worker / courier role-model account domain (additive, prospective-first).
-- Capability only: does NOT flip production contact types or create leaves for
-- DHL/KIRAN/SHAHMIM. No historical AP reclass.
--
-- Adds:
--   _ensure_worker_advance_subaccount  → WA-* under 1180 (linked_contact_id)
--   aligns _ensure_worker_payable_subaccount with worker role gate
--   get_or_create_courier_payable_account linked_contact_id parity
--   get_contact_party_gl_balances WA subtree (WA-* leaves)
--   _resolve_worker_payment_debit_account helper for payment debit routing

-- ---------------------------------------------------------------------------
-- 1) Worker Advance leaf ensure (1180 / WA-*)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ensure_worker_advance_subaccount(
  p_company_id UUID,
  p_contact_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control_id UUID;
  v_child_id UUID;
  v_contact RECORD;
  v_slug TEXT;
  v_code TEXT;
  v_name TEXT;
BEGIN
  SELECT id INTO v_control_id
  FROM accounts
  WHERE company_id = p_company_id
    AND trim(COALESCE(code, '')) = '1180'
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_control_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_contact_id IS NULL THEN
    RETURN v_control_id;
  END IF;

  SELECT id INTO v_child_id
  FROM accounts
  WHERE company_id = p_company_id
    AND parent_id = v_control_id
    AND linked_contact_id = p_contact_id
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_child_id IS NOT NULL THEN
    RETURN v_child_id;
  END IF;

  SELECT id, name, type, code, company_id INTO v_contact
  FROM contacts
  WHERE id = p_contact_id
  LIMIT 1;

  IF v_contact.id IS NULL THEN
    RETURN v_control_id;
  END IF;

  IF v_contact.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'WORKER_ADVANCE_WRONG_COMPANY: contact % does not belong to company %',
      p_contact_id, p_company_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF lower(trim(COALESCE(v_contact.type, ''))) <> 'worker' THEN
    -- Non-worker: do not create WA leaf; return control for callers that only need a posting id.
    RETURN v_control_id;
  END IF;

  v_slug := public._party_slug_from_contact(v_contact.code, p_contact_id);
  v_code := 'WA-' || v_slug;
  v_name := left('Worker Advance — ' || COALESCE(v_contact.name, 'Worker'), 250);

  BEGIN
    INSERT INTO accounts (
      company_id, code, name, type, parent_id, linked_contact_id, is_active
    )
    VALUES (
      p_company_id, v_code, v_name, 'asset'::account_type, v_control_id, p_contact_id, TRUE
    )
    RETURNING id INTO v_child_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_child_id
      FROM accounts
      WHERE company_id = p_company_id AND code = v_code
      LIMIT 1;
      IF v_child_id IS NOT NULL THEN
        UPDATE accounts
        SET linked_contact_id = COALESCE(linked_contact_id, p_contact_id),
            parent_id = COALESCE(parent_id, v_control_id),
            is_active = TRUE,
            updated_at = now()
        WHERE id = v_child_id
          AND (
            linked_contact_id IS DISTINCT FROM p_contact_id
            OR parent_id IS DISTINCT FROM v_control_id
            OR COALESCE(is_active, TRUE) = FALSE
          );
      END IF;
  END;

  RETURN COALESCE(v_child_id, v_control_id);
END;
$$;

COMMENT ON FUNCTION public._ensure_worker_advance_subaccount(UUID, UUID) IS
  'Idempotent WA-* leaf under 1180 for type=worker contacts; wrong company raises; non-worker returns 1180 control.';

GRANT EXECUTE ON FUNCTION public._ensure_worker_advance_subaccount(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public._ensure_worker_advance_subaccount(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Align Worker Payable ensure with worker role gate (keep parent 2010 / WP-*)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ensure_worker_payable_subaccount(
  p_company_id UUID,
  p_contact_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control_id UUID;
  v_child_id UUID;
  v_contact RECORD;
  v_slug TEXT;
  v_code TEXT;
  v_name TEXT;
BEGIN
  SELECT id INTO v_control_id
  FROM accounts
  WHERE company_id = p_company_id
    AND trim(COALESCE(code, '')) = '2010'
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_control_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_contact_id IS NULL THEN
    RETURN v_control_id;
  END IF;

  SELECT id INTO v_child_id
  FROM accounts
  WHERE company_id = p_company_id
    AND parent_id = v_control_id
    AND linked_contact_id = p_contact_id
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_child_id IS NOT NULL THEN
    RETURN v_child_id;
  END IF;

  SELECT id, name, type, code, company_id INTO v_contact
  FROM contacts
  WHERE id = p_contact_id
  LIMIT 1;

  IF v_contact.id IS NULL THEN
    RETURN v_control_id;
  END IF;

  IF v_contact.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'WORKER_PAYABLE_WRONG_COMPANY: contact % does not belong to company %',
      p_contact_id, p_company_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF lower(trim(COALESCE(v_contact.type, ''))) <> 'worker' THEN
    RETURN v_control_id;
  END IF;

  v_slug := public._party_slug_from_contact(v_contact.code, p_contact_id);
  v_code := 'WP-' || v_slug;
  v_name := left('Worker Payable — ' || COALESCE(v_contact.name, 'Worker'), 250);

  BEGIN
    INSERT INTO accounts (
      company_id, code, name, type, parent_id, linked_contact_id, is_active
    )
    VALUES (
      p_company_id, v_code, v_name, 'liability'::account_type, v_control_id, p_contact_id, TRUE
    )
    RETURNING id INTO v_child_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_child_id
      FROM accounts
      WHERE company_id = p_company_id AND code = v_code
      LIMIT 1;
      IF v_child_id IS NOT NULL THEN
        UPDATE accounts
        SET linked_contact_id = COALESCE(linked_contact_id, p_contact_id),
            parent_id = COALESCE(parent_id, v_control_id),
            is_active = TRUE,
            updated_at = now()
        WHERE id = v_child_id
          AND (
            linked_contact_id IS DISTINCT FROM p_contact_id
            OR parent_id IS DISTINCT FROM v_control_id
            OR COALESCE(is_active, TRUE) = FALSE
          );
      END IF;
  END;

  RETURN COALESCE(v_child_id, v_control_id);
END;
$$;

COMMENT ON FUNCTION public._ensure_worker_payable_subaccount(UUID, UUID) IS
  'Idempotent WP-* leaf under 2010 for type=worker contacts; wrong company raises; non-worker returns 2010 control.';

-- ---------------------------------------------------------------------------
-- 3) Courier 203x ensure — linked_contact_id + contact_id parity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_courier_payable_account(
  p_company_id UUID,
  p_contact_id UUID,
  p_contact_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control_id UUID;
  v_account_id UUID;
  v_next_code TEXT;
  v_max_suffix INT;
  v_contact RECORD;
  v_name TEXT;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_control_id
  FROM accounts
  WHERE company_id = p_company_id
    AND trim(COALESCE(code, '')) = '2030'
    AND COALESCE(is_active, TRUE)
  LIMIT 1;

  IF v_control_id IS NULL THEN
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '2030', 'Courier Payable (Control)', 'liability'::account_type, 0, TRUE)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT id INTO v_control_id
    FROM accounts
    WHERE company_id = p_company_id AND trim(COALESCE(code, '')) = '2030'
    LIMIT 1;
  END IF;

  IF p_contact_id IS NOT NULL THEN
    SELECT id, name, type, company_id INTO v_contact
    FROM contacts
    WHERE id = p_contact_id
    LIMIT 1;

    IF v_contact.id IS NOT NULL AND v_contact.company_id IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION 'COURIER_ACCOUNT_WRONG_COMPANY: contact % does not belong to company %',
        p_contact_id, p_company_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Prefer linked_contact_id under 2030; also accept legacy contact_id rows.
    SELECT a.id INTO v_account_id
    FROM accounts a
    WHERE a.company_id = p_company_id
      AND COALESCE(a.is_active, TRUE)
      AND (
        a.linked_contact_id = p_contact_id
        OR a.contact_id = p_contact_id
      )
      AND (
        a.parent_id = v_control_id
        OR a.code ~ '^203[0-9]+$'
      )
      AND trim(COALESCE(a.code, '')) <> '2030'
    ORDER BY
      CASE WHEN a.linked_contact_id = p_contact_id THEN 0 ELSE 1 END,
      a.code
    LIMIT 1;

    IF v_account_id IS NOT NULL THEN
      UPDATE accounts
      SET linked_contact_id = COALESCE(linked_contact_id, p_contact_id),
          contact_id = COALESCE(contact_id, p_contact_id),
          parent_id = COALESCE(parent_id, v_control_id),
          updated_at = now()
      WHERE id = v_account_id
        AND (
          linked_contact_id IS DISTINCT FROM p_contact_id
          OR contact_id IS DISTINCT FROM p_contact_id
          OR parent_id IS DISTINCT FROM v_control_id
        );
      RETURN v_account_id;
    END IF;
  END IF;

  SELECT COALESCE(
    MAX(
      CASE
        WHEN code ~ '^203[0-9]+$' THEN NULLIF(SUBSTRING(code FROM 4), '')::INT
        ELSE 0
      END
    ),
    0
  ) + 1
  INTO v_max_suffix
  FROM accounts
  WHERE company_id = p_company_id
    AND code ~ '^203[0-9]+$'
    AND trim(COALESCE(code, '')) <> '2030';

  v_next_code := '203' || v_max_suffix::TEXT;
  v_name := left(
    COALESCE(NULLIF(trim(p_contact_name), ''), NULLIF(trim(v_contact.name), ''), 'Courier') || ' Payable',
    250
  );

  BEGIN
    INSERT INTO accounts (
      company_id, code, name, type, balance, is_active, parent_id, contact_id, linked_contact_id
    )
    VALUES (
      p_company_id,
      v_next_code,
      v_name,
      'liability'::account_type,
      0,
      TRUE,
      v_control_id,
      p_contact_id,
      p_contact_id
    )
    RETURNING id INTO v_account_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT a.id INTO v_account_id
      FROM accounts a
      WHERE a.company_id = p_company_id
        AND COALESCE(a.is_active, TRUE)
        AND (
          a.linked_contact_id = p_contact_id
          OR a.contact_id = p_contact_id
          OR a.code = v_next_code
        )
      ORDER BY
        CASE WHEN a.linked_contact_id = p_contact_id THEN 0 ELSE 1 END,
        a.code
      LIMIT 1;
      IF v_account_id IS NOT NULL AND p_contact_id IS NOT NULL THEN
        UPDATE accounts
        SET linked_contact_id = COALESCE(linked_contact_id, p_contact_id),
            contact_id = COALESCE(contact_id, p_contact_id),
            parent_id = COALESCE(parent_id, v_control_id),
            updated_at = now()
        WHERE id = v_account_id;
      END IF;
  END;

  RETURN v_account_id;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_courier_payable_account(UUID, UUID, TEXT) IS
  'Returns courier 203x payable leaf under 2030; sets both contact_id and linked_contact_id; idempotent per contact.';

GRANT EXECUTE ON FUNCTION public.get_or_create_courier_payable_account(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_courier_payable_account(UUID, UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Worker payment debit resolver (WA leaf vs WP leaf)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._resolve_worker_payment_debit_account(
  p_company_id UUID,
  p_worker_contact_id UUID,
  p_pay_to_payable BOOLEAN
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_pay_to_payable THEN
    v_id := public._ensure_worker_payable_subaccount(p_company_id, p_worker_contact_id);
  ELSE
    v_id := public._ensure_worker_advance_subaccount(p_company_id, p_worker_contact_id);
  END IF;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public._resolve_worker_payment_debit_account(UUID, UUID, BOOLEAN) IS
  'Prospective helper: unpaid bill → WP leaf (or 2010); else WA leaf (or 1180). Does not post.';

GRANT EXECUTE ON FUNCTION public._resolve_worker_payment_debit_account(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public._resolve_worker_payment_debit_account(UUID, UUID, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Party GL: WA subtree so WA-* leaves attribute like WP-*
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contact_party_gl_balances(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT NULL
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
  wp_control AS (
    SELECT a.id AS wp_id
    FROM public.accounts a
    WHERE a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = '2010'
      AND COALESCE(a.is_active, TRUE)
    LIMIT 1
  ),
  wp_subtree AS (
    WITH RECURSIVE sub AS (
      SELECT c.wp_id AS id FROM wp_control c WHERE c.wp_id IS NOT NULL
      UNION ALL
      SELECT a.id
      FROM public.accounts a
      INNER JOIN sub s ON a.parent_id = s.id
      WHERE a.company_id = p_company_id AND COALESCE(a.is_active, TRUE)
    )
    SELECT id FROM sub
  ),
  wa_control AS (
    SELECT a.id AS wa_id
    FROM public.accounts a
    WHERE a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = '1180'
      AND COALESCE(a.is_active, TRUE)
    LIMIT 1
  ),
  wa_subtree AS (
    WITH RECURSIVE sub AS (
      SELECT c.wa_id AS id FROM wa_control c WHERE c.wa_id IS NOT NULL
      UNION ALL
      SELECT a.id
      FROM public.accounts a
      INNER JOIN sub s ON a.parent_id = s.id
      WHERE a.company_id = p_company_id AND COALESCE(a.is_active, TRUE)
    )
    SELECT id FROM sub
  ),
  resolved AS (
    SELECT
      jel.account_id,
      jel.debit,
      jel.credit,
      je.id AS journal_entry_id,
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
      AND (p_as_of_date IS NULL OR je.entry_date <= p_as_of_date)
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
      WHERE r.account_id IN (SELECT id FROM wp_subtree)
    ) x
    WHERE x.party_key IS NOT NULL
    GROUP BY x.party_key
  ),
  wa_agg AS (
    SELECT x.party_key AS party_id, SUM(x.dr - x.cr) AS net_dr
    FROM (
      SELECT
        r.debit AS dr,
        r.credit AS cr,
        CASE
          WHEN r.acc_linked_contact_id IS NOT NULL THEN r.acc_linked_contact_id
          ELSE r.party_id_resolved
        END AS party_key
      FROM resolved r
      WHERE r.account_id IN (SELECT id FROM wa_subtree)
    ) x
    WHERE x.party_key IS NOT NULL
    GROUP BY x.party_key
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

COMMENT ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) IS
  'GL per-contact balances; WA uses 1180 subtree (WA-* leaves + control); optional p_as_of_date.';

NOTIFY pgrst, 'reload schema';
