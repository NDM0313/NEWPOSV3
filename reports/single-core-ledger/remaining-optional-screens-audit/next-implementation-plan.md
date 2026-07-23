# Next implementation plan — Phases 3A–3E

**Run:** PHASE 3 audit complete  
**Generated:** 2026-06-29  
**Implementation is not automatically approved.** Operator + finance gates required per phase.

---

## Phase 3A — Balance Sheet + P&L parity design / preview-only

| Item | Detail |
|------|--------|
| **Objective** | Add read-only unified TB-derived preview/compare for BS and P&L; document mapping; no main loader swap |
| **Files likely touched** | `src/app/lib/balanceSheetUnifiedPreview*.ts` (new), `src/app/lib/profitLossUnifiedPreview*.ts` (new), `src/app/components/reports/BalanceSheetPage.tsx` (preview banner only), `ProfitLossPage.tsx` (preview banner), tests mirroring `trialBalanceUnifiedPreview*` |
| **Tests** | Unit tests for mapper + compare; no change to `test:unified-ledger` golden constants |
| **Rollback** | Remove preview UI; flags stay OFF |
| **Approval** | **Operator required** to start 3A |
| **Deploy** | Optional — preview behind admin/developer role only |
| **Stop if** | Preview compare fails any company; finance rejects mapping |

---

## Phase 3B — Cash Flow parity audit and UI contract

| Item | Detail |
|------|--------|
| **Objective** | Wire preview compare unified cash/bank vs legacy roznamcha stream; finalize normal/audit contract in UI |
| **Files likely touched** | `cashFlowReportService.ts`, `cashFlowReportLogic.ts`, `CashFlowReportPage.tsx`, `roznamchaCashBankCompareMappers.ts` (extend), tests |
| **Tests** | Extend `cashFlowReportLogic.test.ts`; optional browser QA script |
| **Rollback** | Legacy `getCashFlowReport` main unchanged |
| **Approval** | Operator + finance for contract wording |
| **Deploy** | After 3A pattern proven |
| **Stop if** | R7 dependency claimed (BLOCKED_R7) |

---

## Phase 3C — Mobile report/export/print parity audit

| Item | Detail |
|------|--------|
| **Objective** | Document and test mobile vs web for account/party/roznamcha; PDF export checklist |
| **Files likely touched** | `erp-mobile-app/src/components/accounts/reports/*`, `erp-mobile-app/src/api/roznamcha.ts`, test files, docs under `docs/infra/MOBILE_*` if needed |
| **Tests** | Mobile unit tests; optional snapshot tests for PDF builders |
| **Rollback** | Docs/tests only if scoped correctly |
| **Approval** | Operator |
| **Deploy** | Mobile APK build separate from web; no unified loader swap |
| **Stop if** | Requires web loader changes first |

---

## Phase 3D — Tests and golden capture pack

| Item | Detail |
|------|--------|
| **Objective** | Finance-led golden capture for BS, P&L, CF per company; store in `reports/single-core-ledger/` (not bridal sensitive paths without approval) |
| **Files likely touched** | `reports/single-core-ledger/phase-3-golden-capture/*` (new), monitoring scripts optional |
| **Tests** | Golden fixture tests after finance signs values |
| **Rollback** | Do not enable loaders until goldens PASS |
| **Approval** | **Finance required** before final numbers adopted |
| **Deploy** | No |
| **Stop if** | Numbers not approved — remain NEEDS_GOLDEN_CAPTURE |

---

## Phase 3E — Optional runtime implementation (post-approval only)

| Item | Detail |
|------|--------|
| **Objective** | Per-screen loader flags + main path swap following per-company runbook |
| **Files likely touched** | `unifiedLedgerFlagKeys.ts`, `resolve*MainLoaderSource.ts` (new), `accountingReportsService.ts`, feature flag DB rows (ops) |
| **Tests** | Full `test:unified-ledger` + golden + three-company monitoring |
| **Rollback** | L1 loader flag OFF per runbook |
| **Approval** | **Finance + ops mandatory** |
| **Deploy** | **Yes** — staged per company |
| **Stop if** | Any golden fail; R8/next-company scope creep |

---

## Explicit non-goals (all phases)

- R7 apply, R8 start, next company enable  
- FX / multi-currency app  
- Mutation of five live unified loaders  
- Changes to DIN BRIDAL finance-sensitive golden files without separate approval
