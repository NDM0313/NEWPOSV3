# Task file classification — stale vs active

**Generated:** 2026-06-29  
**Run:** MAC HOME SYNC AUDIT

---

## Source files classified

| File | Classification | Rationale |
|------|----------------|-----------|
| `docs/accounting/OFFICE_CLOSING_PHASE_1_5_REMAINING_TASKS.md` | **HISTORICAL / STALE** | Dated 2026-06-20; branch `feature/single-core-ledger-phase-1-5-systemwide` @ `0334fe51`; staging DNS ENOTFOUND; “PHASE 1.5 NOT VALIDATED”; “Do not merge to main”. Project has since merged Phase 1.5+, Phase 1.6 remediation, production ops handoff, Phase 3A–3B-M on `main`. |
| `docs/accounting/remaining-tasks-2026-06-16.md` | **OLD BACKLOG — REVALIDATE** | Sync point `3136cad7` (13 days before current `origin/main`). TB/Reports fixes may be done; GL repair items need fresh diagnostics; UI QA items still plausible but unverified. |
| `docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md` | **ACTIVE — AUTHORITATIVE** | Updated 2026-06-29; production ops mode; three-company loaders live; Phase 3B-M Cash Flow loader **EXECUTED** on production for 3 companies; points to master register. |
| `reports/single-core-ledger/final-production-ops-handoff/remaining-tasks-master-register.md` | **ACTIVE — AUTHORITATIVE** | Generated 2026-06-29; classifies COMPLETE / BLOCKED / OPTIONAL_FUTURE tasks. |
| `reports/single-core-ledger/final-production-ops-handoff/operator-decision-dashboard.md` | **ACTIVE — REFERENCE** | Operator gates for blocked work. |
| `reports/single-core-ledger/final-production-ops-handoff/seven-phase-remaining-plan.md` | **ACTIVE — REFERENCE** | Phased optional work; not auto-approved. |

---

## Stale content — do NOT promote to active roadmap

From **OFFICE_CLOSING_PHASE_1_5**:

- “Do not start Phase 2 until Phase 1.5 validated”
- Staging clone `wrwljqzckmnmuphwhslt` requirement
- “Do not merge to main” / “Feature flag OFF globally” as current blockers
- Bundle A–D staging-only migration apply on unreachable host

**Superseded by:** production-ready pack + office execution through Phase 3B-M on VPS for DIN CHINA · BRIDAL · COUTURE.

---

## Old backlog items — revalidation required before action

From **remaining-tasks-2026-06-16** (keep topic, not status):

| Item | Fresh validation needed |
|------|-------------------------|
| MURAD DC-0007 Rs 257,140 | Business decision + current TB/party statement |
| AZIZ / ABDUL WAJID 1100 mismatches | Run diag SQL; no apply without data approval |
| DIN BRIDAL control 1100 -136,500 | Business decision |
| Reports date reload QA | Browser QA on current `main` |
| REN-0005 Amount Due KPI | Browser QA |
| DIN CHINA COGS / purchase delta | Business approval unchanged |
| Mobile rental AR | Separate mobile scope |

---

## Explicitly NOT approved (from current authoritative docs)

| Item | Status |
|------|--------|
| Cash Flow loader swap (beyond 3B-M already executed on 3 cos) | Further swaps / rollbacks need operator approval |
| BS/P&L unified main loader swap | Finance **PENDING** |
| R7 roznamcha_payment RPC | **BLOCKED_R7** — design only |
| R8 legacy retirement | **BLOCKED_R8** |
| 4th company rollout | **BLOCKED_NEEDS_FINANCE_SIGNOFF** |
| Ad-hoc GL repair scripts | **BLOCKED_NEEDS_DATA_APPROVAL** |

---

## Mac Home new work (ae6c69d0)

| Feature | Classification |
|---------|----------------|
| Party Ledger Discount | **NEW — release candidate**; browser QA + deploy approval pending |
| Create Business OTP | **NEW — release candidate**; browser QA + deploy approval pending |
