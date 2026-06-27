# R3 — Pre-expansion audit (preflight)

**Status:** `PLANNING_ONLY — BLOCKED ON FINANCE SIGN-OFF`  
**Date:** 2026-06-27

---

## Scope

Prepare other-company unified ledger expansion **without** enabling flags, running migrations, or executing production SQL.

---

## Blocker

**No target company selected. No finance sign-off artifact provided.**

R3 full execution (golden capture on production, profile activation) requires:

1. Named target company + `company_id`
2. Signed finance approval per [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md)
3. Operator approval for read-only production browser sessions

---

## Completed in this preflight pass

| Item | Status |
|------|--------|
| Per-company runbook (R4) | [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md) |
| DIN CHINA golden JSON reference | [`din-china/golden-fixtures.json`](../din-china/golden-fixtures.json) |
| Monitoring profile template | `scripts/single-core-ledger/monitoring-company-profiles.json` (`_template`) |
| Company template path | `reports/single-core-ledger/_company-template/golden-fixtures.template.json` |

---

## Operator next action (when ready)

1. Select company; obtain finance sign-off
2. Capture legacy golden fixtures → `reports/single-core-ledger/<slug>/golden-fixtures.json`
3. Copy `_template` profile in `monitoring-company-profiles.json` → `<slug>` with real values
4. Follow R4 runbook staged enablement — **not before sign-off**

---

## DIN CHINA

**Closed on `main`.** No R3 work required for DIN CHINA.
