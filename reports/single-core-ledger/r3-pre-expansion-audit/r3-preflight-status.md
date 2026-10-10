# R3 — Pre-expansion audit

**Status:** `AUDIT_COMPLETE — R5 BLOCKED ON FINANCE SIGN-OFF`  
**Date:** 2026-06-27

---

## Scope

Other-company unified ledger expansion planning — **read-only audit complete**. No flags enabled, no migrations, no production writes.

---

## Completed (R3 audit pass)

| Item | Status | Evidence |
|------|--------|----------|
| Production company inventory | **Done** | 3 companies — DIN BRIDAL, DIN CHINA, DIN COUTURE |
| Flag audit (other-company loaders = 0) | **PASS** | [`r3-audit-complete-report.md`](r3-audit-complete-report.md) |
| Candidate golden baselines (shadow RPC) | **Done** | [`din-bridal/golden-fixtures.json`](../din-bridal/golden-fixtures.json), [`din-couture/golden-fixtures.json`](../din-couture/golden-fixtures.json) |
| Read-only audit scripts | **Done** | `scripts/single-core-ledger/r3-readonly-*.sql` |
| Manifest | **Done** | [`r3-audit-manifest.json`](r3-audit-manifest.json) |
| Per-company runbook (R4) | **Active** | [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md) |
| DIN CHINA reference golden | **Closed** | [`din-china/golden-fixtures.json`](../din-china/golden-fixtures.json) |

---

## Still blocked (R5)

| Blocker | Detail |
|---------|--------|
| Finance sign-off | No signed artifact for DIN BRIDAL or DIN COUTURE |
| Target company | Operator has not selected first pilot company |
| Legacy browser goldens | Roznamcha parity totals need UI capture before enablement |
| Monitoring profiles | `_template` only — not activated for expansion companies |

---

## Operator next action

1. Select **DIN BRIDAL** or **DIN COUTURE** (or defer expansion)
2. Obtain finance sign-off per expansion checklist
3. Capture legacy browser goldens (especially roznamcha)
4. Activate monitoring profile + follow R4 runbook for staged R5 enablement

---

## DIN CHINA

**Closed on `main`.** No further R3 work for DIN CHINA.
