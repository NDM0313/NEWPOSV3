# Gap analysis — remaining optional screens

**Run:** PHASE 3  
**Generated:** 2026-06-29  
**No fixes applied this phase.**

---

## Gap summary by surface

### Balance Sheet

| ID | Gap | Classification |
|----|-----|----------------|
| G-BS-01 | BS uses legacy `getTrialBalance` while TB screen uses unified RPC when loader ON | NEEDS_RUNTIME_CHANGE |
| G-BS-02 | No `unified_ledger_loader_balance_sheet` flag in `unifiedLedgerFlagKeys.ts` | NEEDS_RUNTIME_CHANGE |
| G-BS-03 | No unified preview/compare harness for BS (unlike TB/PL loaders) | PREVIEW_ONLY_SAFE |
| G-BS-04 | No finance-approved BS golden totals per company | NEEDS_FINANCE_GOLDEN_APPROVAL |
| G-BS-05 | `reportVisibilityContract` not applied to BS derivation | NEEDS_RUNTIME_CHANGE |
| G-BS-06 | Parity contract document | DOC_ONLY — **this audit** |

### Profit & Loss

| ID | Gap | Classification |
|----|-----|----------------|
| G-PL-01 | P&L uses legacy TB path — diverges from unified TB main | NEEDS_RUNTIME_CHANGE |
| G-PL-02 | No unified loader flag for P&L | NEEDS_RUNTIME_CHANGE |
| G-PL-03 | COGS vs expense split is heuristic — needs finance mapping sign-off | NEEDS_FINANCE_GOLDEN_APPROVAL |
| G-PL-04 | No P&L preview/compare module | PREVIEW_ONLY_SAFE |
| G-PL-05 | No P&L golden capture | NEEDS_FINANCE_GOLDEN_APPROVAL |

### Cash Flow

| ID | Gap | Classification |
|----|-----|----------------|
| G-CF-01 | Cash Flow tab uses legacy roznamcha while Roznamcha loader may be unified | NEEDS_RUNTIME_CHANGE |
| G-CF-02 | No unified loader flag for Cash Flow | NEEDS_RUNTIME_CHANGE |
| G-CF-03 | Partial `reportVisibilityContract` — good baseline; unified path not wired | PREVIEW_ONLY_SAFE |
| G-CF-04 | No CF statement golden totals (filters differ from Roznamcha tab) | NEEDS_FINANCE_GOLDEN_APPROVAL |
| G-CF-05 | R7 `roznamcha_payment` RPC not applied | BLOCKED_R7 |

### Mobile

| ID | Gap | Classification |
|----|-----|----------------|
| G-MOB-01 | No BS / P&L / TB / Cash Flow statement screens | UI_ONLY_SAFE (future) |
| G-MOB-02 | No unified loader resolution in mobile APIs | NEEDS_RUNTIME_CHANGE |
| G-MOB-03 | Roznamcha mobile uses legacy `api/roznamcha.ts` | NEEDS_RUNTIME_CHANGE |
| G-MOB-04 | No audit mode on mobile Roznamcha | UI_ONLY_SAFE |
| G-MOB-05 | Export PDF parity vs web print not golden-tested | TEST_ONLY |
| G-MOB-06 | Mobile parity deferred in rollout plan | DOC_ONLY |

### Program / blocked

| ID | Gap | Classification |
|----|-----|----------------|
| G-PRG-01 | R8 legacy engine retirement | BLOCKED_R8 |
| G-PRG-02 | Next company rollout | BLOCKED_DATA_MUTATION |
| G-PRG-03 | Any GL/flag/migration change for new loaders | NEEDS_MIGRATION_APPROVAL / BLOCKED_DATA_MUTATION |

---

## Classification counts

| Class | Count |
|-------|-------|
| DOC_ONLY | 2 |
| TEST_ONLY | 1 |
| PREVIEW_ONLY_SAFE | 3 |
| UI_ONLY_SAFE | 2 |
| NEEDS_RUNTIME_CHANGE | 9 |
| NEEDS_MIGRATION_APPROVAL | 1 |
| NEEDS_FINANCE_GOLDEN_APPROVAL | 4 |
| BLOCKED_R7 | 1 |
| BLOCKED_R8 | 1 |
| BLOCKED_DATA_MUTATION | 2 |

---

## Recommended sequencing

1. **Phase 3A** — BS + P&L preview-only design (PREVIEW_ONLY_SAFE + DOC_ONLY)  
2. **Phase 3D** — Golden capture pack (NEEDS_FINANCE_GOLDEN_APPROVAL)  
3. **Phase 3B** — Cash Flow UI contract + preview  
4. **Phase 3C** — Mobile audit + test mapping  
5. **Phase 3E** — Runtime loader swaps only after finance approval (NEEDS_RUNTIME_CHANGE)
