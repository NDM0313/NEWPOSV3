# Incident quick reference — monitoring FAIL

**Full runbook:** [`monitoring-incident-response-runbook.md`](../operational-monitoring/monitoring-incident-response-runbook.md)

---

## First 5 minutes

1. **Stop** — do not auto-fix accounting, flags, or GL.
2. **Capture** — save console output and `latest-three-company-monitoring.json`.
3. **Classify** — credential vs loader vs golden drift vs infra.

---

## Decision tree (short)

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Login timeout / wrong party | Wrong per-company password or email | Fix local env vars; rerun. No GL changes. |
| `generic_fallback_allowed` blocked | Missing per-company password env | Set `QA_BROWSER_PASSWORD_*` for each company. |
| Golden party mismatch | Real accounting drift **or** wrong company user | Verify credentials first. If credentials correct → escalate to finance; **no** silent GL repair. |
| Loader not unified | Flag drift | Read-only flag guard output. Escalate; do not toggle flags without approved runbook. |
| Other-company loaders ON | Cross-company leakage | **Stop ops** — escalate immediately per full runbook. |
| Playwright / network error | Infra | Retry once. If persistent, check erp.dincouture.pk availability. |

---

## Never do in monitoring incident

- Run migrations
- Apply R7 or start R8
- Enable another company
- Mutate journal entries, payments, balances, or report totals
- Commit credentials to git
- Use generic password fallback without documenting emergency in incident report

---

## Escalation

Document in incident report: timestamp, profile(s) failed, check name, evidence JSON path, actions taken (read-only only).

Rollback SQL exists for L1 loader rollback — **finance approval required** before any execution.
