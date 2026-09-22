# Office Closing Handoff — Phase 1.5 Remaining Tasks

**Project:** DIN Collection ERP — Single Core Ledger Migration  
**Branch:** `feature/single-core-ledger-phase-1-5-systemwide`  
**Last known commit:** `0334fe51` — `feat(accounting): add phase 1.5 systemwide unified ledger foundation`  
**Status:** Code complete, tests pass, staging validation **NETWORK_BLOCKED**  
**Date:** 2026-06-20

---

## 1. Current status

Phase 1.5 code foundation is complete on branch `feature/single-core-ledger-phase-1-5-systemwide`.

| Item | Status |
|------|--------|
| `npm run test:unified-ledger` | **19/19 pass** |
| Foundation commit | `0334fe51` |
| Staging guard | Rejects VPS (`supabase.dincouture.pk`, `72.62.254.176`) |
| Feature flag `unified_ledger_engine` | **OFF** (default) |
| Old ledger engines | Retained |
| VPS deploy | **No** |
| Live data mutation | **No** |
| Main merge | **No** |
| Production screen replacement | **No** |
| `service_role` in frontend | **No** |

### Network blocker

```text
wrwljqzckmnmuphwhslt.supabase.co     → ENOTFOUND
db.wrwljqzckmnmuphwhslt.supabase.co → ENOTFOUND
```

Because staging DNS is unreachable, the following did **not** run:

- Phase 1.5 migrations on staging
- Systemwide diagnostics (`companies_count` remains 0)
- DIN CHINA pilot tie-out
- All-company tie-out
- Trial balance validation
- Cash/bank validation

**Gate decision:**

```text
PHASE 1.5 NOT VALIDATED — reachable staging clone required first.
```

Recorded artifact: `reports/single-core-ledger/diagnostics-network-blocked-2026-06-20.json`

---

## 2. Absolute safety rules

1. Do not deploy to VPS.
2. Do not touch live/production ERP.
3. Do not merge to `main`.
4. Do not enable `unified_ledger_engine` for normal users.
5. Do not replace production ledger screens.
6. Do not mutate live business data.
7. Do not auto-fix `branch_id`, `contact_id`, AR/AP, opening balances, or unposted documents.
8. Do not use `service_role` in frontend.
9. Do not commit `.env.local`.
10. Do not fall back to `supabase.dincouture.pk` or `72.62.254.176` for staging validation.
11. DIN CHINA remains pilot validation only — never hardcode in general SQL/RPC logic.

---

## 3. Remaining task bundles

### Bundle A — Restore or replace staging clone

**Goal:** Reachable staging that is **not VPS** and **not production**.

Options:

- Reactivate Supabase Cloud project `wrwljqzckmnmuphwhslt.supabase.co`, or
- Create new Supabase Cloud staging project, or
- Provide a safe staging database clone URL.

Required `.env.local` (local only — never commit):

```env
UNIFIED_LEDGER_STAGING=1
UNIFIED_LEDGER_TIEOUT_STAGING=1
DATABASE_URL=<reachable-staging-postgres-url>
VITE_SUPABASE_URL=<reachable-staging-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
```

Print only masked target: DB host, database name, Supabase host, guard flags. Never print passwords or service role key.

**Stop** if target is `supabase.dincouture.pk` or `72.62.254.176`.

---

### Bundle B — Apply Phase 1.5 migrations (staging only)

```bash
node scripts/apply-unified-ledger-phase-15-migrations.mjs
```

Migrations (in order):

```text
20260620140000_get_unified_party_ledger_shadow.sql
20260621120000_single_core_ledger_systemwide_diagnostics.sql
20260621150000_unified_ledger_phase_15_rpcs.sql
20260621151000_unified_ledger_phase_15_indexes.sql
```

Verify RPCs exist: `get_unified_party_ledger`, `get_unified_account_ledger`, `get_unified_cash_bank_ledger`, `get_unified_trial_balance`, `get_single_core_ledger_systemwide_diagnostics`.

---

### Bundle C — Run diagnostics and DIN CHINA pilot tie-out

**Diagnostics:**

```powershell
$env:UNIFIED_LEDGER_STAGING="1"
node scripts/run-single-core-ledger-diagnostics.mjs --write-report
```

**DIN CHINA pilot tie-out (run first before all-company):**

```powershell
$env:UNIFIED_LEDGER_STAGING="1"
$env:UNIFIED_LEDGER_TIEOUT_STAGING="1"
node scripts/run-unified-ledger-tieout.mjs --pilot-only --write-report
```

**DIN CHINA pilot requirements** (config: `scripts/single-core-ledger/pilot-companies.json`):

| Requirement | Value |
|-------------|--------|
| company_id | `30bd8592-3384-4f34-899a-f3907e336485` |
| Branches | All branches, Main Branch/HQ (BL0001), BL0002 |
| Basis | `official_gl`, `effective_party`, `audit_full_history` |
| Old sources | `legacy_gl_rpc`; `hybrid_frontend_equivalent` via dev UI where applicable; `operational_open_items` when Phase 2 RPC exists |

Required outputs:

- `companies_count > 0`
- Per-company diagnostics + `fix_class` per issue
- `branch_attribution_risk` rows for DIN CHINA
- HQ vs BL0002 branch-wise tie-out rows
- Trial balance + cash/bank RPC smoke (pilot runner)
- Unresolved differences row-by-row

**Optional all-company tie-out** (after DIN CHINA succeeds):

```powershell
$env:UNIFIED_LEDGER_TIEOUT_STAGING="1"
node scripts/run-unified-ledger-tieout.mjs --write-report
```

---

### Bundle D — Update reports and gate decision

Update with **real** staging results (timestamp, JSON path, SHA256, pass/fail):

```text
docs/accounting/SINGLE_CORE_LEDGER_DIAGNOSTIC_REPORT.md
docs/accounting/SINGLE_CORE_LEDGER_ALL_COMPANY_TIEOUT_REPORT.md
docs/accounting/SINGLE_CORE_LEDGER_PHASE_1_5_SYSTEMWIDE_VERIFICATION_REPORT.md
```

Final gate (exactly one):

```text
PHASE 1.5 VALIDATED — ready for Phase 2 planning
```

or

```text
PHASE 1.5 NOT VALIDATED — fix staging/data issues first
```

---

## 4. Stop conditions

Stop and report if:

- Staging DNS still `ENOTFOUND`
- Service role key missing
- Target resolves to VPS
- Migrations target production
- `.env.local` staged for commit
- Tests fail
- DIN CHINA company missing in staging clone
- `companies_count` remains 0 after real staging run

---

## 5. GitHub push checklist

Before push:

```bash
git branch --show-current
git status --short
npm run test:unified-ledger
```

Confirm:

- `.env.local` not staged
- Unrelated DIN CHINA / accounting WIP not staged
- No production config committed
- Branch = `feature/single-core-ledger-phase-1-5-systemwide`

Push:

```bash
git push -u origin feature/single-core-ledger-phase-1-5-systemwide
```

**Draft PR only** — do not merge.

| Field | Value |
|-------|--------|
| Title | Phase 1.5 Systemwide Unified Ledger Foundation |
| Note | Do not merge yet. Staging validation is blocked by unreachable Supabase Cloud staging. This PR is for branch backup/review only. |

---

## 6. Phase 2 gate

**Do not start Phase 2** until all of:

1. Reachable staging clone exists
2. Migrations apply successfully on staging
3. Diagnostics run with `companies_count > 0`
4. DIN CHINA pilot tie-out executes with documented diffs
5. Trial balance balanced or differences explained
6. Cash/bank validation passes or differences explained
7. `branch_attribution_risk` documented (no auto-fix)
8. Feature flag remains OFF globally
9. Old engines retained
10. No production screens replaced

---

## 7. Safety confirmations (office closing)

| Rule | Confirmed |
|------|-----------|
| VPS not touched for validation | Yes (guard blocks) |
| No live mutation | Yes |
| Feature flag OFF | Yes |
| Old engines retained | Yes |
| No screen wiring | Yes |
| `.env.local` not in git | Yes (gitignored) |

---

## 8. Next operator action

Provide **one** of:

1. Reactivated Supabase Cloud staging project (`wrwljqzckmnmuphwhslt` or replacement), or  
2. New reachable staging clone with:
   - `DATABASE_URL` (Postgres, SSL)
   - `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (CLI only)

Then re-run Bundles B → C → D on branch `feature/single-core-ledger-phase-1-5-systemwide`.

**Do not start Phase 2 until Phase 1.5 is validated.**

---

## 9. Key reference files

| Path | Purpose |
|------|---------|
| `docs/accounting/SINGLE_CORE_LEDGER_PHASE_1_5_SYSTEMWIDE_VERIFICATION_REPORT.md` | Full verification report |
| `scripts/single-core-ledger/staging-env-guard.mjs` | VPS block + masked target |
| `scripts/apply-unified-ledger-phase-15-migrations.mjs` | Staging-only migration applier |
| `scripts/run-single-core-ledger-diagnostics.mjs` | Systemwide diagnostics CLI |
| `scripts/run-unified-ledger-tieout.mjs` | Pilot / all-company tie-out CLI |
| `scripts/single-core-ledger/pilot-companies.json` | DIN CHINA pilot config only |
