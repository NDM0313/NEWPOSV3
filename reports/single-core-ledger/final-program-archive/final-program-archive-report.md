# Three-company unified ledger — final program archive report

**Status:** `THREE-COMPANY UNIFIED LEDGER BASELINE COMPLETE`  
**Run:** THREE-COMPANY UNIFIED LEDGER FINAL ARCHIVE + OPERATIONAL BASELINE  
**Generated:** 2026-06-14T00:00:00Z  
**Latest `main` commit:** `d227d221` — `docs(accounting): complete DIN COUTURE unified ledger rollout`

---

## Executive summary

DIN CHINA, DIN BRIDAL, and DIN COUTURE unified ledger rollouts are **complete and stable**. Migration closure is **complete** with no approved pending migrations. Three-company operational baseline (read-only flags + production monitoring) **PASS**. R7 remains design-only; R8 remains blocked. No next-company expansion in this run.

---

## Company state

| Company | Flags | Loaders | Golden party | Monitoring |
|---------|-------|---------|--------------|------------|
| DIN CHINA | 12/12 ON | 5/5 ON | MR JALIL | PASS |
| DIN BRIDAL | 12/12 ON | 5/5 ON | MR REHAN ALI | PASS |
| DIN COUTURE | 12/12 ON | 5/5 ON | DHARIA | PASS |

**Other-company loaders:** 0 (unapproved companies)  
**Cross-company leakage:** false

---

## Migration closure

- Status: **COMPLETE**
- Evidence: [`migration-closure-final-report.md`](../migration-closure/migration-closure-final-report.md)
- Migrations applied this run: **none**

---

## Monitoring baseline

Evidence: [`three-company-monitoring-baseline.md`](three-company-monitoring-baseline.md)

All golden totals match production for all three profiles (Ledger V2, Account Statement, Party Ledger, Trial Balance, Roznamcha).

---

## R7 / R8

| Gate | Status |
|------|--------|
| R7 roznamcha_payment RPC | **DESIGN ONLY** — no migration |
| R8 legacy engine retirement | **BLOCKED** |
| Next-company expansion | **BLOCKED** — separate finance sign-off |

Evidence: [`r7-r8-gate-status.md`](r7-r8-gate-status.md)

---

## Rollback references

| Company | Rollback SQL |
|---------|--------------|
| DIN CHINA | `scripts/single-core-ledger/phase-21x-rollback-*.sql` |
| DIN BRIDAL | `scripts/single-core-ledger/din-bridal/db-rollback-*.sql` |
| DIN COUTURE | `scripts/single-core-ledger/din-couture/dc-rollback-*.sql` |

Do not execute without incident approval.

---

## Credentials audit

- No passwords or tokens committed in this run
- QA credentials used via environment only (`QA_BROWSER_PASSWORD`, per-company login emails)
- Git diff for archive commit: docs/reports/verification scripts only

---

## Tests / build

| Check | Result |
|-------|--------|
| `npm run test:unified-ledger` | **245/245 PASS** |
| `npm run build` | **PASS** |

---

## Deploy decision

**SKIP** — archive/monitoring only. See [`deploy-or-skip-notes.md`](deploy-or-skip-notes.md).

---

## Constraints honored

| Constraint | Honored |
|------------|---------|
| No migrations | YES |
| No R7 apply | YES |
| No R8 retirement | YES |
| No new company enablement | YES |
| Read-only flag SQL only | YES |
| No GL / balance mutations | YES |
| No FX app changes | YES |
| No loader behavior changes | YES |
| No credentials in git | YES |

---

## Evidence index

| Artifact | Path |
|----------|------|
| Commit reconciliation | [`commit-reconciliation.md`](commit-reconciliation.md) |
| Flag baseline | [`three-company-flag-baseline.md`](three-company-flag-baseline.md) |
| Monitoring baseline | [`three-company-monitoring-baseline.md`](three-company-monitoring-baseline.md) |
| R7/R8 gates | [`r7-r8-gate-status.md`](r7-r8-gate-status.md) |
| Manifest | [`final-program-archive-manifest.json`](final-program-archive-manifest.json) |

---

## Exact next action

1. **Periodic operational monitoring only** — `MONITORING_PROFILE=din-china|din-bridal|din-couture node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs`
2. **Do not start another company** without separate finance sign-off
3. **Do not start R7 or R8** without separate approval
