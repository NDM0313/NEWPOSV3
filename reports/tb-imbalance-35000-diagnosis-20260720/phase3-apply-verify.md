# Phase 3 apply + verify — 2026-07-20

**Status:** `TB_IMBALANCE_FIXED`

| Item | Before | After |
|------|--------|-------|
| JE-0222 diff | −26,000 | **0.00** |
| JE-0247 diff | −9,000 | **0.00** |
| DIN BRIDAL TB debit | 29,437,453 | **29,472,453** |
| DIN BRIDAL TB credit | 29,472,453 | **29,472,453** |
| TB difference | −35,000 | **0.00** |
| Unbalanced JE count | 2 | **0** |

## Actions applied

1. **JE-0222:** set COGS line `16973f7a-…` debit = 26,000; header totals 236,000/236,000  
2. **JE-0247:** insert Dr Extra Service Income 9,000 (4120); header totals 91,000/91,000  

No migration. No feature-flag change. No physical deletes. Payments untouched.
