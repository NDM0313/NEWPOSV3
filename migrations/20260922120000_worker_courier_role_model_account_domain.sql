-- Worker / courier role-model account domain (additive, prospective-first).
-- Capability only: does NOT flip production contact types or create leaves for
-- DHL/KIRAN/SHAHMIM. No historical AP reclass.
--
-- Security (2026-09-22 gate):
--   SECURITY DEFINER entrypoints self-authorize via get_user_company_id() for
--   authenticated callers (same pattern as journal account guard).
--   Custom GUCs are NEVER privilege proof.
--   Explicit REVOKE ALL FROM PUBLIC/anon after every CREATE OR REPLACE.
--
-- Functions:
--   _ensure_worker_advance_subaccount  → WA-* under 1180
--   _ensure_worker_payable_subaccount  → WP-* under 2010 (worker role gate)
--   get_or_create_courier_payable_account → 203x + linked_contact_id parity
--   get_contact_party_gl_balances → WA subtree + company scope for clients
--   _resolve_worker_payment_debit_account → authorized debit helper

-- ---------------------------------------------------------------------------
-- 0) Auth helpers (mirror journal account guard: role from session, not GUC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._party_role_account_effective_role()
RETURNS text
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := NULLIF(btrim(current_setting('role', true)), '');
  IF v_role IS NULL OR lower(v_role) = 'none' THEN
    RETURN session_user::text;
  END IF;
  RETURN v_role;
END;
$$;

COMMENT ON FUNCTION public._party_role_account_effective_role() IS
  'Session role for party-role account DEFINER gates. Never uses client-writable GUCs for privilege.';

REVOKE ALL ON FUNCTION public._party_role_account_effective_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._party_role_account_effective_role() FROM anon;
REVOKE ALL ON FUNCTION public._party_role_account_effective_role() FROM authenticated;
REVOKE ALL ON FUNCTION public._party_role_account_effective_role() FROM service_role;

CREATE OR REPLACE FUNCTION public._party_role_account_assert_company_access(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_auth_company uuid;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'PARTY_ROLE_ACCOUNT_COMPANY_REQUIRED'
      USING ERRCODE = 'check_violation';
  END IF;

  v_role := public._party_role_account_effective_role();

  IF v_role = 'authenticated' THEN
    v_auth_company := public.get_user_company_id();
    IF v_auth_company IS NULL THEN
      RAISE EXCEPTION 'PARTY_ROLE_ACCOUNT_AUTH_COMPANY_REQUIRED'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_auth_company IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION
        'PARTY_ROLE_ACCOUNT_FORBIDDEN: limited to caller company scope'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN;
  END IF;

  IF v_role IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN;
  END IF;

  RAISE EXCEPTION
    'PARTY_ROLE_ACCOUNT_FORBIDDEN: not authorized'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION public._party_role_account_assert_company_access(uuid) IS
  'Fail-closed company gate for party-role account DEFINER RPCs. Authenticated must match get_user_company_id().';

REVOKE ALL ON FUNCTION public._party_role_account_assert_company_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._party_role_account_assert_company_access(uuid) FROM anon;
REVOKE ALL ON FUNCTION public._party_role_account_assert_company_access(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public._party_role_account_assert_company_access(uuid) FROM service_role;

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
  PERFORM public._party_role_account_assert_company_access(p_company_id);

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
    RAISE EXCEPTION 'WORKER_ADVANCE_CONTACT_NOT_FOUND: %', p_contact_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_contact.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'WORKER_ADVANCE_WRONG_COMPANY: contact % does not belong to company %',
      p_contact_id, p_company_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF lower(trim(COALESCE(v_contact.type::text, ''))) <> 'worker' THEN
    -- Fail-loud: do not silently post suppliers onto control 1180 via this ensure.
    RAISE EXCEPTION 'WORKER_ADVANCE_ROLE_REQUIRED: contact % type=% must be worker',
      p_contact_id, v_contact.type
      USING ERRCODE = 'check_violation';
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
  'Idempotent WA-* under 1180 for type=worker. Self-authorizes company. Wrong role raises (no control fallback).';

REVOKE ALL ON FUNCTION public._ensure_worker_advance_subaccount(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._ensure_worker_advance_subaccount(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public._ensure_worker_advance_subaccount(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public._ensure_worker_advance_subaccount(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Worker Payable ensure (2010 / WP-*) — worker role gate + company auth
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
  PERFORM public._party_role_account_assert_company_access(p_company_id);

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
    RAISE EXCEPTION 'WORKER_PAYABLE_CONTACT_NOT_FOUND: %', p_contact_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_contact.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'WORKER_PAYABLE_WRONG_COMPANY: contact % does not belong to company %',
      p_contact_id, p_company_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF lower(trim(COALESCE(v_contact.type::text, ''))) <> 'worker' THEN
    RAISE EXCEPTION 'WORKER_PAYABLE_ROLE_REQUIRED: contact % type=% must be worker',
      p_contact_id, v_contact.type
      USING ERRCODE = 'check_violation';
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
  'Idempotent WP-* under 2010 for type=worker. Self-authorizes company. Wrong role raises.';

REVOKE ALL ON FUNCTION public._ensure_worker_payable_subaccount(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._ensure_worker_payable_subaccount(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public._ensure_worker_payable_subaccount(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public._ensure_worker_payable_subaccount(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Courier 203x — company auth BEFORE any mutation; null contact fail-closed
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
  PERFORM public._party_role_account_assert_company_access(p_company_id);

  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'COURIER_ACCOUNT_CONTACT_REQUIRED'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id, name, type, company_id INTO v_contact
  FROM contacts
  WHERE id = p_contact_id
  LIMIT 1;

  IF v_contact.id IS NULL THEN
    RAISE EXCEPTION 'COURIER_ACCOUNT_CONTACT_NOT_FOUND: %', p_contact_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_contact.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'COURIER_ACCOUNT_WRONG_COMPANY: contact % does not belong to company %',
      p_contact_id, p_company_id
      USING ERRCODE = 'check_violation';
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

  -- New leaf only for explicit courier role (no name heuristics).
  IF lower(trim(COALESCE(v_contact.type::text, ''))) <> 'courier' THEN
    RAISE EXCEPTION 'COURIER_ACCOUNT_ROLE_REQUIRED: contact % type=% must be courier',
      p_contact_id, v_contact.type
      USING ERRCODE = 'check_violation';
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
      IF v_account_id IS NOT NULL THEN
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
  'Courier 203x under 2030 with contact_id+linked_contact_id. Self-authorizes; null contact rejected; create requires type=courier.';

REVOKE ALL ON FUNCTION public.get_or_create_courier_payable_account(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_courier_payable_account(UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_courier_payable_account(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_courier_payable_account(UUID, UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Worker payment debit resolver — self-authorizes (not an ACL bypass)
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
  PERFORM public._party_role_account_assert_company_access(p_company_id);

  IF p_pay_to_payable THEN
    v_id := public._ensure_worker_payable_subaccount(p_company_id, p_worker_contact_id);
  ELSE
    v_id := public._ensure_worker_advance_subaccount(p_company_id, p_worker_contact_id);
  END IF;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public._resolve_worker_payment_debit_account(UUID, UUID, BOOLEAN) IS
  'Authorized helper: unpaid bill → WP leaf; else WA leaf. Self-authorizes company.';

REVOKE ALL ON FUNCTION public._resolve_worker_payment_debit_account(UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._resolve_worker_payment_debit_account(UUID, UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public._resolve_worker_payment_debit_account(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public._resolve_worker_payment_debit_account(UUID, UUID, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Party GL: WA subtree + company scope for authenticated direct calls
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
  PERFORM public._party_role_account_assert_company_access(p_company_id);

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
  'GL per-contact balances; WA uses 1180 subtree; authenticated limited to get_user_company_id().';

REVOKE ALL ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) TO service_role;

-- Compatibility overloads without as-of (if present in older callers)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_contact_party_gl_balances'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid'
  ) THEN
    EXECUTE $f$
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
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT * FROM public.get_contact_party_gl_balances(p_company_id, p_branch_id, NULL::date);
      $body$;
    $f$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) FROM anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID) TO service_role';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
