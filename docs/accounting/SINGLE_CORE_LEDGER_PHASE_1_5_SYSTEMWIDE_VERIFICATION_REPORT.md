# Single Core Ledger — Phase 1.5 Systemwide Verification Report

**Branch:** `feature/single-core-ledger-phase-1-5-systemwide`  
**Date:** 2026-06-23  
**Staging validation:** **Phase 1.6 clone remediation applied** — payment contact **0 gaps**; branch **6 manual-review** JEs remain

---

## Phase 1.6 clone remediation (2026-06-23)

| Step | Result |
|------|--------|
| Inventory | 74 payment gaps, 8 branch risk |
| Dry-run safe_apply | 74 payment + 2 branch |
| Clone apply | 74 payments + 2 JEs updated |
| Post-apply diagnostics | strict_pass **1/3** (DIN COUTURE); missing_contact **0** all cos |
| Pilot tie-out | **PASS** 6/6 |

**Gate:** Payment contact blocker **cleared**. Branch transfers (FT-000287, FT-000309) remain for manual-review sign-off.

---

## Executive summary

Phase 1.5 migrations and CLI validation ran successfully on an **isolated VPS clone** (`ledger_stage_20260623`). **DIN CHINA pilot tie-out passes** (legacy GL vs unified party ledger, all three bases). **Systemwide diagnostics fail** strict gate for 2/3 companies due to payment contact and branch attribution data quality — blocking Phase 1.5 sign-off.

| Check | Result |
|-------|--------|
| Unit tests (`npm run test:unified-ledger`) | **19/19 pass** |
| Staging clone | **VPS `ledger_stage_20260623`** |
| Migrations on clone | **4/4 applied** |
| RPC verification | **5/5 functions** |
| Systemwide diagnostics | **FAIL** (1 pass, 2 fail) — payment contact **0**; branch risk **6** |
| DIN CHINA pilot tie-out | **PASS** (9/9 comparisons, diff 0) |
| All-company tie-out | **PASS** (pilot-scoped 9/9) |
| Feature flag OFF | **Confirmed** |
| Live `postgres` DB | **Untouched** |

---

## Staging target (masked)

| Field | Value |
|-------|-------|
| Target type | VPS isolated clone |
| DB host | `172.19.0.15` (docker internal) |
| Database | `ledger_stage_20260623` |
| Production DB | `postgres` — not used |
| Guards | `UNIFIED_LEDGER_STAGING=1`, `UNIFIED_LEDGER_VPS_CLONE=1`, `UNIFIED_LEDGER_PG_ONLY=1` |

---

## Commands run

```bash
npm run test:unified-ledger
CLONE_DB=ledger_stage_20260623 bash scripts/single-core-ledger/create-vps-ledger-clone.sh
CLONE_DB=ledger_stage_20260623 bash scripts/single-core-ledger/apply-phase-15-docker-exec.sh
UNIFIED_LEDGER_STAGING=1 UNIFIED_LEDGER_VPS_CLONE=1 UNIFIED_LEDGER_PG_ONLY=1 \
  node scripts/run-single-core-ledger-diagnostics.mjs --write-report
UNIFIED_LEDGER_STAGING=1 UNIFIED_LEDGER_VPS_CLONE=1 UNIFIED_LEDGER_PG_ONLY=1 \
  UNIFIED_LEDGER_TIEOUT_STAGING=1 node scripts/run-unified-ledger-tieout.mjs --pilot-only --write-report
```

---

## Artifacts

| Artifact | Path | SHA256 (prefix) |
|----------|------|-----------------|
| Diagnostics JSON | `reports/single-core-ledger/diagnostics-2026-06-23T14-20-34-284Z.json` | `b07fd3de…` |
| Tie-out JSON | `reports/single-core-ledger/tieout-2026-06-23T14-20-51-991Z.json` | `144c6d65…` |
| Resume report | `docs/accounting/SINGLE_CORE_LEDGER_RESUME_REPORT.md` | — |

---

## DIN CHINA pilot results

- company_id: `30bd8592-3384-4f34-899a-f3907e336485`
- Bases: `official_gl`, `effective_party`, `audit_full_history` — all **PASS** vs `legacy_gl_rpc`
- JALIL: old/new balance **216,300** (15 rows each)
- Trial balance: **balanced** (All branches + BL0002)
- Cash/bank RPC: returns rows; liquidity accounts enumerated

---

## Blockers before Gate A

1. ~~`payments_missing_contact_sale_linked`~~ — **cleared** on clone (74 backfilled; metric **0** all companies)
2. `branch_attribution_risk` — **6 remaining** (manual_review: transfers FT-000287/FT-000309, manual_receipt JEs)
3. BL0001/HQ branch scope not exercised in pilot RPC checks

**Gate status:** **PARTIAL** — payment contact blocker cleared; branch manual-review sign-off required for full 3/3 strict pass.

See `SINGLE_CORE_LEDGER_PHASE_1_6_REMEDIATION_PLAN.md` for exception list.

---

## Safety

| Rule | Status |
|------|--------|
| VPS production DB changed | **No** |
| `unified_ledger_engine` ON | **No** |
| Main merge | **No** |
