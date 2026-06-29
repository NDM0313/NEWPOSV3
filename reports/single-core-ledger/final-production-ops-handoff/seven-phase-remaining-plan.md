# Seven-phase remaining plan — Single Core Ledger

**Generated:** 2026-06-29T14:00:00.000Z  
**Program mode:** Production ops — phases classified, not auto-approved

---

## Phase 1 — Production ops monitoring

| Field | Value |
|-------|-------|
| **Status** | `ONGOING_OPS` |
| **Action** | Daily/weekly read-only monitoring only |
| **Command** | `npm run monitor:three-company-unified-ledger` |
| **Credentials** | Per-company `QA_BROWSER_PASSWORD_*` only |
| **Checklist** | [`daily-monitoring-checklist.md`](daily-monitoring-checklist.md) |

---

## Phase 2 — Office PC local cleanup

| Field | Value |
|-------|-------|
| **Status** | `SAFE_LOCAL_CLEANUP` |
| **Action** | Review unrelated local files; do not delete unless operator approves |
| **Inventory** | [`office-pc-local-change-inventory.md`](office-pc-local-change-inventory.md) |
| **Next prompt** | `OFFICE PC LOCAL CLEANUP REVIEW — DRY RUN ONLY` |

---

## Phase 3 — Remaining optional screen audit

| Field | Value |
|-------|-------|
| **Status** | `COMPLETE` |
| **Action** | Balance Sheet, P&L, Cash Flow, mobile parity — audit docs only |
| **Evidence** | [`remaining-optional-screens-audit/`](../remaining-optional-screens-audit/) (supersedes [`remaining-screens-audit.md`](../post-baseline-remaining-phases/remaining-screens-audit.md) for Phase 3 scope) |
| **Constraint** | No flags, no migrations, no GL mutations — **verified** |
| **Note** | Remaining optional screens audit **completed** @ 2026-06-29. No runtime/accounting behavior changed. Implementation is not automatically approved. R7/R8/next-company still blocked. Finance golden approval required before final numbers are adopted. |
| **Next (if approved)** | Phase 3A — [`next-implementation-plan.md`](../remaining-optional-screens-audit/next-implementation-plan.md) |

---

## Phase 4 — Safe report/UI fixes

| Field | Value |
|-------|-------|
| **Status** | `OPTIONAL_FUTURE` |
| **Action** | UI labeling / diagnostic clarity only — if no migration, no GL mutation, no loader behavior change |
| **Pattern** | R2 Cash/Bank Admin Compare closure |
| **Constraint** | Must not alter report totals or loader resolution |

---

## Phase 5 — Next company rollout

| Field | Value |
|-------|-------|
| **Status** | `BLOCKED_NEEDS_FINANCE_SIGNOFF` |
| **Action** | Finance sign-off + golden capture + per-company runbook required |
| **Runbook** | [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md) |
| **Note** | DIN CHINA, DIN BRIDAL, DIN COUTURE already live — this gate applies to any **additional** company |

---

## Phase 6 — R7 roznamcha_payment RPC

| Field | Value |
|-------|-------|
| **Status** | `BLOCKED_NEEDS_MIGRATION_APPROVAL` |
| **Action** | Design review + finance approval + migration approval + clone validation + backup required |
| **Design** | [`SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md) |
| **Current** | DESIGN_ONLY — not applied |

---

## Phase 7 — R8 legacy engine retirement

| Field | Value |
|-------|-------|
| **Status** | `BLOCKED_R8` |
| **Action** | Stability period + separate approval + rollback strategy required |
| **Map** | [`PHASE8_LEGACY_RETIREMENT_MAP.md`](../../../docs/accounting/PHASE8_LEGACY_RETIREMENT_MAP.md) |
| **Constraint** | Do not delete legacy paths until all gates met |

---

## Phase summary

| Phase | Status | Auto-approved |
|-------|--------|---------------|
| 1 Monitoring | ONGOING_OPS | Yes (read-only) |
| 2 Local cleanup | SAFE_LOCAL_CLEANUP | Dry-run only |
| 3 Screen audit | SAFE_AUDIT_ONLY | Yes (read-only) |
| 4 Safe UI fixes | OPTIONAL_FUTURE | Per change |
| 5 Next company | BLOCKED | No |
| 6 R7 | BLOCKED | No |
| 7 R8 | BLOCKED | No |
