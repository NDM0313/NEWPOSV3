# Diff analysis — Phase 3B-D

**Captured:** 2026-06-29T12:16:53.046Z  
**All zero-diff:** NO

| Company | Zero-diff | Max Δ | Row Δ | Finance can review | Code change needed |
|---------|-----------|-------|-------|-------------------|-------------------|
| DIN CHINA | false | 59811582 | -82 | true | true |
| DIN BRIDAL | false | 80000 | -2 | true | true |
| DIN COUTURE | true | 0 | 0 | true | false |

## Rule confirmations

### DIN CHINA
- PREVIEW_ONLY — not finance-approved golden totals.
- NEEDS_FINANCE_GOLDEN_APPROVAL before any loader swap.
- NEEDS_RULE_CONFIRMATION — legacy vs unified preview totals differ; finance must confirm mapping before loader swap.
- Reversal/void visibility may affect row-level compare — review with finance.

### DIN BRIDAL
- PREVIEW_ONLY — not finance-approved golden totals.
- NEEDS_FINANCE_GOLDEN_APPROVAL before any loader swap.
- NEEDS_RULE_CONFIRMATION — legacy vs unified preview totals differ; finance must confirm mapping before loader swap.
- Reversal/void visibility may affect row-level compare — review with finance.

### DIN COUTURE
- PREVIEW_ONLY — not finance-approved golden totals.
- NEEDS_FINANCE_GOLDEN_APPROVAL before any loader swap.
- Reversal/void visibility may affect row-level compare — review with finance.
