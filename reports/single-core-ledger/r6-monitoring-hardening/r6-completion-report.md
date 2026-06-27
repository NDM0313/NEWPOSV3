# R6 — Monitoring + deploy completion report

**Status:** `R6 COMPLETE — FRONTEND DEPLOYED`  
**Date:** 2026-06-27  
**Phase bundle:** R6 + R4 runbook + R3 preflight (planning only)

---

## R6 monitoring hardening

| Deliverable | Path |
|-------------|------|
| Company profiles JSON | `scripts/single-core-ledger/monitoring-company-profiles.json` |
| Profile loader | `scripts/single-core-ledger/loadMonitoringProfile.mjs` |
| Parameterized entry | `scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs` |
| Updated Phase 2.16 script | `scripts/single-core-ledger/run-phase-216-monitoring-verify.mjs` |
| Profile tests | `scripts/single-core-ledger/loadMonitoringProfile.test.mjs` |
| DIN CHINA golden JSON | `reports/single-core-ledger/din-china/golden-fixtures.json` |

**Usage:** `MONITORING_PROFILE=din-china QA_BROWSER_PASSWORD=... node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs`

Post-deploy monitoring re-run: **skipped** if `QA_BROWSER_PASSWORD` unavailable locally.

---

## R4 per-company runbook

[`docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md)

---

## R3 pre-expansion

[`r3-preflight-status.md`](../r3-pre-expansion-audit/r3-preflight-status.md) — **BLOCKED ON FINANCE SIGN-OFF** (no target company).

---

## Production frontend deploy

Script: `scripts/single-core-ledger/deploy-phase-r6-production-frontend-vps.sh`

- **Scope:** Frontend bundle only (includes R2 Admin Compare diagnostic UI)
- **No** flag SQL, migrations, or GL mutations
- **Read-only** flag verification before/after build

Deploy evidence: see `r6-production-deploy-notes.md` after VPS run.

---

## Constraints

| Constraint | Performed |
|------------|-----------|
| Flags changed | **NO** |
| Migrations run | **NO** |
| Production SQL executed | **NO** |
| GL mutations | **NO** |
| Other-company expansion | **NO** |
| FX app touched | **NO** |
| Live loader behavior changed | **NO** (frontend deploy only) |

---

## Recommended next phase

**R3 execution** — only after operator provides target company + finance sign-off.

Alternative: **Pause** program until finance selects next company.
