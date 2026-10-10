# R3 — Pre-expansion audit complete report

**Status:** `AUDIT_COMPLETE — R5 BLOCKED ON FINANCE SIGN-OFF`  
**Date:** 2026-06-27  
**Production:** https://erp.dincouture.pk  
**Method:** Read-only SQL via `dincouture-vps` (no flag SQL, no GL mutations)

---

## Executive summary

R3 read-only expansion audit is **complete**. Production has **three active companies**; only **DIN CHINA** has unified ledger flags (12 ON). **Zero** other-company loader flags are enabled. Candidate golden baselines for **DIN BRIDAL** and **DIN COUTURE** are captured as planning artifacts.

**R5 (first non-DIN pilot) remains blocked** until finance selects a target company and signs off per the expansion checklist.

---

## Production flag audit (PASS)

| Gate | Result |
|------|--------|
| Other-company `unified_ledger_loader_*` enabled | **0** (PASS) |
| DIN CHINA unified flags ON | **12** (expected) |
| DIN BRIDAL unified flags | **0** |
| DIN COUTURE unified flags | **0** |
| Flag SQL executed this pass | **No** |
| GL mutations | **None** |

---

## Company inventory

| Company | company_id | Branches | JE count | Unified flags |
|---------|------------|----------|----------|---------------|
| DIN BRIDAL | `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` | 2 | 254 | 0 |
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` | 2 | 443 | 12 (live) |
| DIN COUTURE | `2ab65903-62a3-4bcf-bced-076b681e9b74` | 1 | 79 | 0 |

---

## Candidate golden baselines (shadow RPC)

Captured via `get_unified_trial_balance`, `get_unified_party_ledger`, and liquidity GL sums. **Not** legacy browser loaders — finance must validate before R5.

### DIN BRIDAL

| Fixture | Value (PKR) |
|---------|-------------|
| Trial Balance debit = credit | 21,919,575.00 |
| Golden party | MR REHAN ALI |
| Party closing (LV2 / AS / PL proxy) | 530,000 |
| Roznamcha cash in / out (GL proxy) | 1,916,350 / 942,780 |
| Roznamcha closing (GL net proxy) | 973,570 |

Artifact: [`din-bridal/golden-fixtures.json`](../din-bridal/golden-fixtures.json)

### DIN COUTURE

| Fixture | Value (PKR) |
|---------|-------------|
| Trial Balance debit = credit | 49,747,104.00 |
| Golden party | DHARIA |
| Party closing (LV2 / AS / PL proxy) | 4,488,088 |
| Roznamcha cash in / out (GL proxy) | 85,000 / 34,500 |
| Roznamcha closing (GL net proxy) | 50,500 |

Artifact: [`din-couture/golden-fixtures.json`](../din-couture/golden-fixtures.json)

### DIN CHINA sanity check

MR JALIL `get_unified_party_ledger` last running balance = **PKR 216,300** — matches Phase 2.16 authoritative golden.

---

## Roznamcha caveat

Raw GL liquidity totals **differ** from live roznamcha UI golden values (DIN CHINA example: GL proxy ≠ parity-assembler totals). Expansion companies must capture **legacy roznamcha browser totals** before loader enablement, same as DIN CHINA Phase 2.15 parity workflow.

---

## Scripts used

| Script | Purpose |
|--------|---------|
| [`r3-readonly-expansion-audit.sql`](../../../scripts/single-core-ledger/r3-readonly-expansion-audit.sql) | Flags, branches, JE counts |
| [`r3-readonly-golden-baseline.sql`](../../../scripts/single-core-ledger/r3-readonly-golden-baseline.sql) | TB / party / liquidity proxies |

Manifest: [`r3-audit-manifest.json`](r3-audit-manifest.json)

---

## What was NOT done (by design)

- No `feature_flags` updates
- No migrations applied
- No monitoring profile activation for DIN BRIDAL / DIN COUTURE
- No browser QA (`QA_BROWSER_PASSWORD` unavailable)
- No target company selected for R5 pilot

---

## Operator next steps (R5 gate)

1. **Select** DIN BRIDAL or DIN COUTURE (or defer)
2. **Obtain finance sign-off** — [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md)
3. **Capture legacy browser goldens** (especially roznamcha parity totals)
4. Copy `_template` → company slug in `monitoring-company-profiles.json`
5. Follow [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md) staged enablement

---

## Final statement

**R3 audit: COMPLETE.** **R5 pilot: BLOCKED** until finance sign-off and target company selection.
