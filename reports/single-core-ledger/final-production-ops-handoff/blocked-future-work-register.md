# Blocked future work register — Single Core Ledger

**Archive lock date:** 2026-06-29  
**Program mode:** Production ops — monitoring only until separate approval

---

## Classification key

| Class | Meaning |
|-------|---------|
| `DESIGN_ONLY` | Documented; no migration applied |
| `BLOCKED` | Explicitly blocked pending gates |
| `BLOCKED_NEEDS_FINANCE_AND_DATA_APPROVAL` | Any GL/data/flag mutation |
| `OPTIONAL_FUTURE` | Not required for current production ops |

---

## Register

| ID | Workstream | Class | Blockers | Approval required |
|----|------------|-------|----------|-------------------|
| R7 | `roznamcha_payment` RPC mode | **DESIGN_ONLY** | Design review · finance approval · migration approval · clone validation · backup | Written finance + engineering sign-off before any migration |
| R8 | Legacy engine retirement (`getCustomerLedger`, `roznamchaService`, etc.) | **BLOCKED** | Required stability period on all approved companies · rollback strategy | Separate approval after stability period met |
| NEXT | Next company unified loader rollout | **BLOCKED** | Separate finance sign-off · golden capture · per-company runbook | Finance written sign-off per company |
| OPT-SCREENS | Remaining screens (BS, P&L, Cash Flow, Day Book, COA balances, mobile parity) | **OPTIONAL_FUTURE** | Per-screen design + golden capture | Per-screen approval — see master roadmap |
| GL-MUT | Any ad-hoc GL / journal / payment / balance repair | **BLOCKED_NEEDS_FINANCE_AND_DATA_APPROVAL** | Money + legal document risk | Finance + data owner approval with remediation runbook |
| FX-APP | FX / multi-currency application | **OUT_OF_SCOPE** | Separate product | Not part of Single Core Ledger program |

---

## Explicitly complete (do not re-rollout without incident)

- Three-company unified ledger baseline (DIN CHINA · DIN BRIDAL · DIN COUTURE)
- Migration closure — no pending approved migrations
- Monitoring credential hardening
- Ops schedule + incident runbook
- Password rotation + post-rotation monitoring PASS

---

## Ongoing (not blocked)

| Item | Command / doc |
|------|----------------|
| Scheduled read-only monitoring | `npm run monitor:three-company-unified-ledger` |
| Daily checklist | [`daily-monitoring-checklist.md`](daily-monitoring-checklist.md) |
