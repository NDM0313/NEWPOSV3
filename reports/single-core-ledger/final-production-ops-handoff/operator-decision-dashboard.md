# Operator decision dashboard — Single Core Ledger

**Generated:** 2026-06-29T14:00:00.000Z  
**Program mode:** Production ops

---

## What is fully complete?

- Three-company unified ledger (DIN CHINA · DIN BRIDAL · DIN COUTURE) — 12/12 flags, 5/5 loaders each
- Migration closure — no pending approved migrations
- Monitoring credential hardening, ops schedule, incident runbook
- Password rotation + post-rotation monitoring PASS
- Final production ops handoff archived @ `fdb68235`

---

## What is daily ongoing only?

| Item | Action |
|------|--------|
| Three-company monitoring | `npm run monitor:three-company-unified-ledger` |
| Scheduler | Windows Task Scheduler or launchd per guide |
| Credentials | Per-company env vars locally — never in git |

---

## What can be safely done next without approval?

| Item | Class | Doc |
|------|-------|-----|
| Continue monitoring | ONGOING_OPS | [`daily-monitoring-checklist.md`](daily-monitoring-checklist.md) |
| Docs/register updates | SAFE_DOCS_ONLY | This handoff pack |

**Phase 3A BS/P&L preview-only:** **DEPLOYED TO PRODUCTION** @ 2026-06-29 (`4a5dc304`). Legacy BS/P&L default behavior unchanged. Loader swap not approved. R7/R8/next company remain blocked. No migrations and no GL/data mutations.

**Phase 3D BS/P&L candidate golden capture:** **COMPLETE** @ 2026-06-29. DIN CHINA · DIN BRIDAL · DIN COUTURE — preview compare evidence captured. Values are **candidate-only, not finance approved**. Loader swap not approved.

**Phase 3D-SIGNOFF finance pack:** **PREPARED** @ 2026-06-29. [`finance-signoff-pack.md`](../phase-3d-bs-pl-golden-capture/finance-signoff-pack.md) ready for finance review. Finance status **PENDING**. Loader swap **BLOCKED**. R7/R8/next company remain blocked.

**Phase 3B Cash Flow preview:** **DEPLOYED TO PRODUCTION** @ 2026-06-29 (`99f2e3b3`). Legacy Cash Flow default behavior unchanged. Loader swap not approved. BS/P&L finance status remains **PENDING**. R7/R8/next company remain blocked. No migrations, no flags, and no GL/data mutations.

**Phase 3B-D Cash Flow candidate golden capture:** **COMPLETE** @ 2026-06-29. DIN CHINA · DIN BRIDAL · DIN COUTURE — values **candidate-only, not finance approved**. DIN COUTURE zero-diff; DIN CHINA/DIN BRIDAL non-zero-diff. Cash Flow loader swap not approved.

---

## What requires operator approval to start next?

| Item | Class | Doc |
|------|-------|-----|
| Phase 3D — finance golden capture for BS/P&L | FINANCE_GATE | [`finance-golden-capture-plan.md`](../phase-3a-bs-pl-preview/finance-golden-capture-plan.md) |
| Phase 3B-D — Cash Flow finance review | FINANCE_GATE | [`finance-review-pack.md`](../phase-3b-d-cash-flow-golden-capture/finance-review-pack.md) |

---

## What requires finance sign-off?

| Item | Gate |
|------|------|
| Next company (4th+) rollout | Written finance sign-off + golden capture |
| Any GL/journal/payment/balance repair | Finance + data owner approval |
| R7 migration (after design review) | Finance + migration approval |
| R8 legacy retirement (after stability) | Finance + engineering approval |

---

## What requires migration approval?

| Item | Prerequisite |
|------|--------------|
| R7 roznamcha_payment RPC | Design review · finance · approved migration · clone validation · backup |
| Any new DB schema change | Per [`GIT_WORKFLOW_RULES.txt`](../../../GIT_WORKFLOW_RULES.txt) lockdown rules |

---

## What must not be started?

- R7 apply (design-only today)
- R8 legacy engine deletion
- Next company enablement
- Migrations from monitoring failures
- Flag toggles to “fix” golden drift without runbook
- FX / multi-currency app changes under this program

---

## Recommended next prompt

```
OFFICE PC LOCAL CLEANUP REVIEW — DRY RUN ONLY
```

Review [`office-pc-local-change-inventory.md`](office-pc-local-change-inventory.md). Classify each unstaged file. Propose archive/delete/commit actions. Do not modify or delete files without explicit operator approval.

---

## Quick links

| Doc | Purpose |
|-----|---------|
| [`remaining-tasks-master-register.md`](remaining-tasks-master-register.md) | Full task classification |
| [`seven-phase-remaining-plan.md`](seven-phase-remaining-plan.md) | Seven-phase map |
| [`blocked-future-work-register.md`](blocked-future-work-register.md) | Blocked work detail |
| [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md) | Production entry point |
