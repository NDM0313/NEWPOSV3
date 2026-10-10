# Single Core Ledger — Phase 1.8 Post-Migration Validation Report

**Status:** `PHASE 1.8 VALIDATION PASS` — ready for Phase 2 planning, engine still OFF  
**Branch:** `feature/single-core-ledger-phase-1-8-post-migration-validation`  
**Run timestamp (UTC):** `2026-06-25T09:21:42Z`  
**Clone:** `ledger_stage_20260625_prodcheck` (fresh from live `postgres`, `RECREATE=1`)

---

## Executive summary

| Check | Result |
|-------|--------|
| Production read-only verification | **PASS** |
| Phase 1.5 migrations on `postgres` | **4/4** in `schema_migrations` |
| Unified RPCs on `postgres` | **5/5** |
| Payment contact gaps (clone inventory) | **0** |
| Branch attribution risk (clone) | **0** |
| Gate A strict diagnostics | **PASS 3/3** |
| DIN CHINA pilot tie-out | **PASS 9/9** |
| All-company tie-out | **PASS 9/9** |
| MR JALIL balance | **PKR 216,300.00** |
| `unified_ledger_engine` | **OFF** (absent) |
| Production DB mutated in Phase 1.8 | **No** |
| Phase 1.5 production apply executed | **No** |
| Phase 2 | **NOT started** |

---

## Production read-only verification (`postgres`)

Executed on VPS `dincouture-vps` / `supabase-db` — read-only SQL only.

| Check | Result |
|-------|--------|
| `schema_migrations` Phase 1.5 files | **4/4** present |
| `get_unified_party_ledger` | exists |
| `get_unified_account_ledger` | exists |
| `get_unified_cash_bank_ledger` | exists |
| `get_unified_trial_balance` | exists |
| `get_single_core_ledger_systemwide_diagnostics` | exists |
| `unified_ledger_engine` (DIN CHINA) | **absent** |
| MR JALIL `gl_ar_receivable` | **216300.00** |

Script: `scripts/single-core-ledger/phase-18-prod-readonly-verify.sql`

---

## Fresh clone validation

| Field | Value |
|-------|-------|
| Source | `postgres` (read-only `pg_dump`) |
| Clone DB | `ledger_stage_20260625_prodcheck` |
| Clone size | ~154 MB |
| Remediation apply on clone | **None** (read-only inventory + Gate A only) |

Orchestration: `scripts/single-core-ledger/run-phase-18-post-migration-validation.sh`

### Inventory (read-only)

| Artifact | Path |
|----------|------|
| JSON | `reports/single-core-ledger/remediation-inventory-2026-06-25T09-21-41-767Z.json` |
| SHA256 | `7cf8df8a287a8afb1684fd3ad95795075df20e9da79902014d7fc95b85dbffaf` |
| Payment gaps | **0** |
| Branch risk | **0** |
| safe_apply / manual_review | **0 / 0** |

### Gate A diagnostics

| Artifact | Path |
|----------|------|
| JSON | `reports/single-core-ledger/diagnostics-2026-06-25T09-21-42-118Z.json` |
| SHA256 | `cd8272a6666bf1fbf85d849df187d09c99226f79d53c287972316365baa124f5` |
| Status | **PASS** |
| strict_pass / strict_fail | **3 / 0** |
| branch_attribution_risk_total | **0** |

### Tie-out

| Run | JSON | Status | Pass/Fail |
|-----|------|--------|-----------|
| Pilot | `tieout-2026-06-25T09-21-42-272Z.json` | PASS | 9/0 |
| All-company | `tieout-2026-06-25T09-21-42-659Z.json` | PASS | 9/0 |

MR JALIL: `old_balance` = `new_balance` = **216300** (DIN CHINA pilot).

---

## Safety confirmations

| Rule | Status |
|------|--------|
| No production DB mutation | **Confirmed** |
| No Phase 1.5 production apply | **Confirmed** |
| No migrations on production | **Confirmed** |
| `unified_ledger_engine` enablement | **Not done** |
| Phase 2 UI wiring | **Not started** |
| Merge / deploy | **No** |

---

## Tests (local)

| Command | Result |
|---------|--------|
| `npm run test:unified-ledger` | **26/26 pass** |

---

## Recommendation — next step

1. Obtain explicit approval for **Phase 2 planning** (screen wiring behind `unified_ledger_engine`).
2. Keep `unified_ledger_engine` **OFF** until Phase 2 rollout plan is signed.
3. Optional: operator/finance sign-off on Phase 1.5 migration plan §9 (formal re-apply not required — migrations already on prod).
4. Do **not** merge or deploy without separate ops approval.

**Final status:** `PHASE 1.8 VALIDATION PASS — ready for Phase 2 planning, engine still OFF`

---

## Related documents

| Document | Purpose |
|----------|---------|
| [Production ready pack](SINGLE_CORE_LEDGER_PRODUCTION_READY.md) | Master status |
| [Phase 1.5 migration plan](SINGLE_CORE_LEDGER_PHASE_1_5_PRODUCTION_MIGRATION_PLAN.md) | Migration approval |
| [Smoke test (1.7)](SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md) | Pre-validation smoke |
