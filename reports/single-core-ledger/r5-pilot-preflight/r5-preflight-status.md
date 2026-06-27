# R5 — First non-DIN company pilot (preflight)

**Status:** `PREFLIGHT_READY — BLOCKED ON FINANCE SIGN-OFF + TARGET SELECTION`  
**Date:** 2026-06-27  
**Prerequisite:** R3 audit complete — [`r3-audit-complete-report.md`](../r3-pre-expansion-audit/r3-audit-complete-report.md)

---

## Scope

Prepare staged unified ledger rollout for **one** expansion company. **No flag SQL in this preflight pass.**

---

## Expansion candidates (from R3)

| Company | company_id | TB golden (PKR) | Golden party | Party closing (PKR) | Fixture |
|---------|------------|-----------------|--------------|----------------------|---------|
| DIN BRIDAL | `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` | 21,919,575 | MR REHAN ALI | 530,000 | [`din-bridal/golden-fixtures.json`](../din-bridal/golden-fixtures.json) |
| DIN COUTURE | `2ab65903-62a3-4bcf-bced-076b681e9b74` | 49,747,104 | DHARIA | 4,488,088 | [`din-couture/golden-fixtures.json`](../din-couture/golden-fixtures.json) |

---

## Hard gates before R5 execution

| Gate | Status |
|------|--------|
| R3 read-only audit | **PASS** |
| Finance sign-off artifact | **MISSING** |
| Operator target company selected | **MISSING** |
| Legacy browser roznamcha goldens | **MISSING** (RPC proxies only) |
| Monitoring profile activated | **BLOCKED** (`requires_finance_sign_off: true`) |
| Other-company loader flags = 0 | **PASS** @ 2026-06-27 |

---

## R5 execution checklist (when unblocked)

1. Record finance sign-off path in golden-fixtures.json `finance_sign_off_ref`
2. Remove `requires_finance_sign_off` blocker OR operator waiver for monitoring profile
3. Capture legacy browser goldens (roznamcha parity totals mandatory)
4. Follow [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md) steps 1→6
5. One loader at a time; L1 rollback SQL staged before each enable
6. `MONITORING_PROFILE=<slug> QA_BROWSER_PASSWORD=... node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs`

---

## Explicit stop

**Do not run `phase-21x-enable*.sql` or UPDATE feature_flags for DIN BRIDAL / DIN COUTURE without finance sign-off.**
