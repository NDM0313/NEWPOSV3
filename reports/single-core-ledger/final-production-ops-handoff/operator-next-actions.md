# Operator next actions — production ops mode

**Status:** Final production ops handoff complete @ 2026-06-29  
**Latest main:** `6b701ed1`

---

## Do now (ongoing)

1. **Schedule** daily monitoring per [`windows-task-scheduler-guide.md`](../operational-monitoring/windows-task-scheduler-guide.md).
2. **Run** `npm run monitor:three-company-unified-ledger` with per-company `QA_BROWSER_PASSWORD_*` only.
3. **Use** [`daily-monitoring-checklist.md`](daily-monitoring-checklist.md) each run.
4. **Archive** PASS evidence to `%USERPROFILE%\erp-monitoring-logs` (optional, outside repo).

---

## Do not do without separate approval

| Action | Why blocked |
|--------|-------------|
| Apply R7 roznamcha_payment migration | DESIGN_ONLY |
| Start R8 legacy retirement | BLOCKED — stability period |
| Enable next company loaders | BLOCKED — finance sign-off |
| Run migrations from monitoring failures | Money + stock risk |
| Toggle feature flags to “fix” golden drift | Requires approved runbook |
| Deploy ERP frontend for monitoring-only changes | Not needed |
| Commit passwords or `.env` to git | Security policy |

---

## If monitoring FAILs

1. Follow [`incident-quick-reference.md`](incident-quick-reference.md).
2. Full procedure: [`monitoring-incident-response-runbook.md`](../operational-monitoring/monitoring-incident-response-runbook.md).
3. Check [`blocked-future-work-register.md`](blocked-future-work-register.md) before proposing program expansion.

---

## Key doc index

| Doc | Purpose |
|-----|---------|
| [`final-production-ops-handoff.md`](final-production-ops-handoff.md) | Authoritative handoff pack |
| [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md) | Production entry point |
| [`master-remaining-roadmap.md`](../master-roadmap-after-din-china-closure/master-remaining-roadmap.md) | Long-term program phases |
| [`password-rotation-final-closure-manifest.json`](../operational-monitoring/password-rotation-final-closure-manifest.json) | Rotation closure evidence |

---

## Exact next action

Continue scheduled operational monitoring only:

```powershell
npm run monitor:three-company-unified-ledger
```

Do **not** start R7, R8, or another company without separate approval.
