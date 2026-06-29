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

## Phase 3A — BS / P&L unified preview (preview-only)

| Field | Value |
|-------|-------|
| **Status** | `COMPLETE — DEPLOYED` |
| **Production** | https://erp.dincouture.pk @ `4a5dc304` |
| **Action** | Admin/developer unified TB preview compare on BS and P&L pages |
| **Evidence** | [`phase-3a-bs-pl-preview/`](../phase-3a-bs-pl-preview/) |
| **Default runtime** | **UNCHANGED** — legacy `getBalanceSheet` / `getProfitLoss` remain main |
| **Loader swap** | **NOT APPROVED** |
| **Finance golden** | Candidate capture complete — finance sign-off pending |
| **Deploy** | **DONE** @ 2026-06-29 — [`production-deploy-notes.md`](../phase-3a-bs-pl-preview/production-deploy-notes.md) |

---

## Phase 3D — BS / P&L candidate golden capture

| Field | Value |
|-------|-------|
| **Status** | `COMPLETE — CANDIDATE_ONLY` |
| **Action** | Production preview compare evidence for DIN CHINA · DIN BRIDAL · DIN COUTURE |
| **Evidence** | [`phase-3d-bs-pl-golden-capture/`](../phase-3d-bs-pl-golden-capture/) |
| **Values** | **CANDIDATE_ONLY — NOT FINANCE APPROVED** |
| **Loader swap** | **NOT APPROVED** |
| **Migrations / flags / GL** | **NONE** |
| **R7 / R8 / next company** | **BLOCKED** |
| **Next** | Finance reviews [`finance-signoff-pack.md`](../phase-3d-bs-pl-golden-capture/finance-signoff-pack.md) |

---

## Phase 3D-SIGNOFF — BS / P&L finance sign-off pack

| Field | Value |
|-------|-------|
| **Status** | `PREPARED — PENDING` |
| **Action** | Finance-readable sign-off pack with approval checklist |
| **Evidence** | [`finance-signoff-pack.md`](../phase-3d-bs-pl-golden-capture/finance-signoff-pack.md) |
| **Finance status** | **PENDING** (no explicit approval in this run) |
| **Loader swap** | **BLOCKED** — see [`bs-pl-loader-swap-gate.md`](../phase-3d-bs-pl-golden-capture/bs-pl-loader-swap-gate.md) |
| **Migrations / flags / GL** | **NONE** |
| **R7 / R8 / next company** | **BLOCKED** |

---

## Phase 3B — Cash Flow unified preview (preview-only)

| Field | Value |
|-------|-------|
| **Status** | `DEPLOYED` |
| **Action** | Admin/developer unified Roznamcha preview compare on Cash Flow page |
| **Evidence** | [`phase-3b-cash-flow-preview/`](../phase-3b-cash-flow-preview/) |
| **Production** | https://erp.dincouture.pk @ `99f2e3b3` |
| **Default runtime** | **UNCHANGED** — legacy `getCashFlowReport` remains main |
| **Loader swap** | **NOT APPROVED** |
| **Finance golden** | **NEEDS_GOLDEN_CAPTURE** before adoption |
| **BS/P&L finance** | **PENDING** (unchanged) |
| **Deploy** | **COMPLETE** @ 2026-06-29 — frontend only; no migrations, no flags, no GL/data mutations |

---

## Phase 3B-D — Cash Flow candidate golden capture

| Field | Value |
|-------|-------|
| **Status** | `COMPLETE — CANDIDATE_ONLY` |
| **Action** | Capture legacy vs unified preview compare from production Cash Flow panel |
| **Evidence** | [`phase-3b-d-cash-flow-golden-capture/`](../phase-3b-d-cash-flow-golden-capture/) |
| **Companies** | DIN CHINA · DIN BRIDAL · DIN COUTURE |
| **Finance approval** | **NOT APPROVED** — default status PENDING |
| **Loader swap** | **NOT APPROVED** |
| **BS/P&L finance** | **PENDING** (unchanged) |
| **Zero-diff** | DIN COUTURE |
| **Non-zero-diff** | DIN CHINA · DIN BRIDAL — NEEDS_RULE_CONFIRMATION |
| **Migrations / flags / GL** | **NONE** |
| **R7 / R8 / next company** | **BLOCKED** |

---

## Phase 3B-E — Cash Flow delta investigation

| Field | Value |
|-------|-------|
| **Status** | `COMPLETE` |
| **Action** | Read-only rule map + row-bucket analysis for DIN CHINA / DIN BRIDAL deltas |
| **Evidence** | [`phase-3b-e-cash-flow-delta-investigation/`](../phase-3b-e-cash-flow-delta-investigation/) |
| **Recommendation** | **D + E** — deeper row export tooling, then finance approval before fix |
| **Runtime changes** | **NONE** |
| **Loader swap** | **NOT APPROVED** |
| **BS/P&L finance** | **PENDING** |

---

## Phase 3B-F — Cash Flow row-keyed export / deeper diff tooling

| Field | Value |
|-------|-------|
| **Status** | `DEPLOYED` |
| **Production commit** | `5433ac2c` |
| **Action** | Preview-only row-keyed JSON export + thematic diff buckets |
| **Evidence** | [`phase-3b-f-cash-flow-row-export/`](../phase-3b-f-cash-flow-row-export/) |
| **Diagnostic-only** | **YES** — no official totals changed |
| **Loader swap** | **NOT APPROVED** |

---

## Phase 3B-G — Cash Flow finance rule decision pack

| Field | Value |
|-------|-------|
| **Status** | `PREPARED` |
| **Action** | Finance-readable Q4/Q5/Q7 decision form + company summaries + outcome matrix |
| **Evidence** | [`phase-3b-g-cash-flow-finance-rule-decision/`](../phase-3b-g-cash-flow-finance-rule-decision/) |
| **Finance status** | **PENDING** — no approval without explicit written sign-off |
| **Runtime changes** | **NONE** |
| **Loader swap** | **BLOCKED** |
| **Required decisions** | Q4 (DIN BRIDAL opening) · Q5 (DIN CHINA transfers) · Q7 (delta treatment) |
| **BS/P&L finance** | **PENDING** |
| **R7 / R8 / next company** | **BLOCKED** |

---

## Phase 3B-H — Cash Flow preview alignment

| Field | Value |
|-------|-------|
| **Status** | `IMPLEMENTED` |
| **Finance decisions** | Q4=A, Q5=C, Q7=B (preview alignment only) |
| **Evidence** | [`phase-3b-h-cash-flow-preview-alignment/`](../phase-3b-h-cash-flow-preview-alignment/) |
| **Official legacy** | **UNCHANGED** |
| **Deploy** | **NOT RUN** — operator approval required |
| **Re-capture** | Phase 3B-I after deploy |
| **Loader swap** | **BLOCKED** |

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
