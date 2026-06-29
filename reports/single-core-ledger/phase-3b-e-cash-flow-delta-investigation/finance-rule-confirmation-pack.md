# Finance rule confirmation pack — Phase 3B-E

**Default status:** PENDING for all questions  
**Loader swap:** NOT APPROVED  
**BS/P&L finance:** PENDING

| # | Question | Status | Notes |
|---|----------|--------|-------|
| Q1 | Should Cash Flow follow legacy `getCashFlowReport` exactly? | PENDING | Recommended: **YES** (official) |
| Q2 | Should Cash Flow follow unified effective_party basis? | PENDING | Not without finance sign-off |
| Q3 | Void/reversal hidden in normal, audit only? | PENDING | Matches visibility contract |
| Q4 | Opening balance from prior activity vs period rows only? | PENDING | DIN BRIDAL `opening_balance_account` |
| Q5 | Internal transfers gross, net, or excluded? | PENDING | **Critical — DIN CHINA** |
| Q6 | Which source modules in normal Cash Flow? | PENDING | Current: all |
| Q7 | Accept DIN CHINA/BRIDAL deltas or fix? | PENDING | Confirm rules before any fix phase |

## Company deltas (candidate only)

| Company | Closing Δ | Finance status |
|---------|-----------|----------------|
| DIN CHINA | PKR 45,675,273 | NEEDS_RULE_CONFIRMATION |
| DIN BRIDAL | PKR -55,000 | NEEDS_RULE_CONFIRMATION |
| DIN COUTURE | 0 | PENDING |

## Phase 3B-F tooling (diagnostic-only)

Phase 3B-F Cash Flow row-keyed export / deeper diff tooling is **implemented**. It is diagnostic-only; no official totals changed. Cash Flow loader swap remains blocked. Use row-keyed export + [`export-cash-flow-row-diff.mjs`](../../../scripts/single-core-ledger/phase-3b-f/export-cash-flow-row-diff.mjs) to answer Q4–Q7 with bucket evidence after operator deploys preview export UI. BS/P&L finance remains **PENDING**. R7/R8/next company remain blocked.
