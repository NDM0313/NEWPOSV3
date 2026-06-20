# Single Core Ledger — Phase 1.5 Systemwide Verification Report

**Branch:** `feature/single-core-ledger-phase-1-5-systemwide`  
**Date:** 2026-06-20  
**Staging validation:** **NETWORK_BLOCKED** (code complete; live staging run pending reachable clone)

---

## Executive summary

Phase 1.5 implementation and staging CLI tooling are **complete on the feature branch**. Staging validation could **not** finish because the documented Supabase Cloud staging project (`wrwljqzckmnmuphwhslt.supabase.co`) returns **DNS ENOTFOUND** from this environment. Per safety rules, **VPS** (`supabase.dincouture.pk` / `72.62.254.176`) was **rejected** by the staging guard.

| Check | Result |
|-------|--------|
| Unit tests (`npm run test:unified-ledger`) | **19/19 pass** |
| Migrations applied on staging | **Not run** (no DB) |
| Systemwide diagnostics | **NETWORK_BLOCKED** |
| DIN CHINA pilot tie-out | **Not run** |
| Feature flag OFF | **Confirmed in code** |
| VPS deploy | **No** |
| Live mutation | **No** |
| Main merge | **No** |

---

## Commands run

```text
git branch --show-current          → feature/single-core-ledger-phase-1-5-systemwide
npm run test:unified-ledger        → 19 pass
node scripts/apply-unified-ledger-phase-15-migrations.mjs  → ENOTFOUND (db host)
node scripts/run-single-core-ledger-diagnostics.mjs --write-report  → NETWORK_BLOCKED
node scripts/run-unified-ledger-tieout.mjs --pilot-only --write-report  → not reached (no API)
```

**Masked staging target attempted:**

| Field | Value |
|-------|-------|
| DB host | `db.wrwljqzckmnmuphwhslt.supabase.co` (ENOTFOUND) |
| Database | `postgres` |
| Supabase host | `wrwljqzckmnmuphwhslt.supabase.co` (ENOTFOUND) |
| Staging guard | `UNIFIED_LEDGER_STAGING=1` |

---

## Auth helpers used (no invented helpers)

| Helper | Usage |
|--------|--------|
| `get_user_company_id()` | `_unified_ledger_assert_caller_access` company scope |
| `get_user_role()` | Admin/owner/manager/accountant bypass |
| `has_branch_access()` | Branch-scoped non-admin access |

---

## Staging run artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Diagnostics JSON | `reports/single-core-ledger/diagnostics-network-blocked-2026-06-20.json` | NETWORK_BLOCKED |
| Tie-out JSON | _(not produced)_ | Blocked |
| Diagnostic report | `docs/accounting/SINGLE_CORE_LEDGER_DIAGNOSTIC_REPORT.md` | Updated |
| Tie-out report | `docs/accounting/SINGLE_CORE_LEDGER_ALL_COMPANY_TIEOUT_REPORT.md` | Blocked template |

---

## DIN CHINA pilot (not executed)

- company_id: `30bd8592-3384-4f34-899a-f3907e336485` (pilot config only)
- Branches: All branches, BL0001/HQ, BL0002 — pending tie-out
- Bases: official_gl, effective_party, audit_full_history — pending
- Trial balance / cash/bank RPC smoke — pending

---

## Safety confirmations

| Rule | Status |
|------|--------|
| No VPS deploy | ✅ |
| No live ERP mutation | ✅ |
| No main merge | ✅ |
| Feature flag OFF (`unified_ledger_engine`) | ✅ |
| Old engines retained | ✅ |
| No production screen replacement | ✅ |
| No service_role in frontend | ✅ |
| VPS DB rejected by staging guard | ✅ |

---

## Open risks

1. **No reachable staging clone** in current environment — blocks Phase 1.5 sign-off.
2. Documented Cloud project may be paused/deleted — needs operator restore or new clone URL.
3. `branch_attribution_risk` / tie-out diffs unknown until staging runs.

---

## Phase 2 recommendation

**Do not start Phase 2** until:

1. Operator provides **reachable staging clone** (not VPS production).
2. Migrations `20260620140000` → `20260621151000` applied on that clone.
3. Diagnostics return `companies_count > 0`.
4. DIN CHINA pilot tie-out executed with row-level diffs documented.
5. Trial balance balanced (or differences explained).

**Operator remediation:**

```powershell
# .env.local — staging only (not VPS)
UNIFIED_LEDGER_STAGING=1
UNIFIED_LEDGER_TIEOUT_STAGING=1
DATABASE_URL=<reachable-staging-postgres>
VITE_SUPABASE_URL=<reachable-staging-supabase>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role>

node scripts/apply-unified-ledger-phase-15-migrations.mjs
node scripts/run-single-core-ledger-diagnostics.mjs --write-report
node scripts/run-unified-ledger-tieout.mjs --pilot-only --write-report
```

---

## Files in Phase 1.5 scope (committed on feature branch)

See git commit `feat(accounting): add phase 1.5 systemwide unified ledger foundation` for exact file list.
