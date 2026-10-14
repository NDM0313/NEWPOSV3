# AR/AP Phase 2b — Migration safety review

**Migration:** `migrations/20260712120000_get_unified_contact_party_gl_balances.sql`
**Checksum (SHA-256):** `dc383ec1d04de1e76affd7500c1e987fdf07bc8f7fd409bd6636292c99d77448`

## Verdict: SAFE — additive RPC only

| Check | Result |
|-------|--------|
| Additive only | PASS — single `CREATE OR REPLACE FUNCTION` + `COMMENT` + `GRANT` |
| Table mutation | NONE |
| UPDATE / DELETE / TRUNCATE | NONE |
| Destructive ALTER | NONE |
| Historical GL rewrite | NONE — read-only aggregation |
| Journal posting | NONE |
| Account creation | NONE |
| Privilege escalation | LIMITED — `GRANT EXECUTE` to `authenticated` and `service_role` only (matches legacy party GL RPC pattern) |

## Function signature

```sql
public.get_unified_contact_party_gl_balances(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT NULL,
  p_basis TEXT DEFAULT 'effective_party'
)
RETURNS TABLE (
  contact_id UUID,
  gl_ar_receivable NUMERIC,
  gl_ap_payable NUMERIC,
  gl_worker_payable NUMERIC
)
```

**Volatility:** STABLE
**Security:** SECURITY DEFINER with `SET search_path = public`

## Returned columns (legacy-compatible)

| Column | Meaning |
|--------|---------|
| `contact_id` | Contact UUID for company |
| `gl_ar_receivable` | Net AR (dr − cr) on AR control subtree (code 1100) |
| `gl_ap_payable` | Net AP (cr − dr) on AP control subtree (code 2000) |
| `gl_worker_payable` | Worker payable net (2010 minus 1180 advance offset) |

Output shape matches `get_contact_party_gl_balances` for AR/AP Diagnostics consumption.

## Scoping and filtering

| Concern | Implementation |
|---------|----------------|
| Company scope | `je.company_id = p_company_id`, contacts filtered by `company_id` |
| Branch scope | `_unified_ledger_strict_branch_includes_row(p_branch_id, je.branch_id, je.reference_type)` |
| Basis handling | `_unified_ledger_basis_includes_row` with `official_gl`, `effective_party`, `audit_full_history` |
| Voided entries | `COALESCE(je.is_void, FALSE) = FALSE` |
| As-of date | `p_as_of_date IS NULL OR je.entry_date::date <= p_as_of_date` |
| Caller access | `_unified_ledger_assert_caller_access(p_company_id, p_branch_id)` before query |

## Production object collision

Pre-migration production check: **0** functions named `get_unified_contact_party_gl_balances`.

`CREATE OR REPLACE` is safe for first deploy. No existing production definition to overwrite.

## Rollback (function only — no GL data change)

```sql
DROP FUNCTION IF EXISTS public.get_unified_contact_party_gl_balances(UUID, UUID, DATE, TEXT);
```

Runtime retains legacy fallback to `get_contact_party_gl_balances` when unified RPC is absent or kill switch is ON.

## Migration approval gate

**Status:** MIGRATION NOT APPROVED

Required operator phrase (not received):

`APPROVE_AR_AP_PHASE2B_UNIFIED_RPC_PRODUCTION_MIGRATION`
