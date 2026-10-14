# Root cause — DIN BRIDAL TB difference −35,000

**As of:** 2026-07-20 (live production read-only)  
**Company:** DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)  
**Classification:** `MULTIPLE_UNBALANCED_JES` (two sale-related JEs)

## Company TB totals

| Metric | Amount |
|--------|--------|
| TB TOTAL DEBIT | 29,437,453.00 |
| TB TOTAL CREDIT | 29,472,453.00 |
| **TB DIFFERENCE** | **−35,000.00** |
| DIN CHINA / DIN COUTURE | balanced (diff 0) |

## Unbalanced journal entries

| JE | Date | Type | Source | Dr | Cr | Diff |
|----|------|------|--------|----|----|------|
| **JE-0222** | 2026-07-05 | `sale` | SL-0031 | 210,000 | 236,000 | **−26,000** |
| **JE-0247** | 2026-07-19 | `sale_reversal` | SL-0042 | 82,000 | 91,000 | **−9,000** |
| **Sum** | | | | | | **−35,000** |

Sum of JE diffs = company TB difference (exact match).

### JE-0222 (SL-0031 edited 2026-07-18)

Sale still `final`, total 210,000 (subtotal 202,000 + lining extra 8,000). Inventory credit 26,000 posted, but **COGS (5010) line debit = 0**.

Expected balanced pair:

- Dr AR 210,000 / Cr Sales 202,000 / Cr Extra 8,000  
- Dr COGS 26,000 / Cr Inventory 26,000  

Actual: COGS line exists (`16973f7a-…`) with debit 0 → credit-heavy by 26,000.

### JE-0247 (SL-0042 cancelled)

Sale `cancelled`, total 50,000 (merchandise 41,000 + extras stitching/lining 9,000). Reversal posted:

- Cr AR 50,000  
- Dr Sales 41,000  
- Dr Inventory 41,000 / Cr COGS 41,000  

**Missing:** Dr Extra Service Income (4120) 9,000 to reverse charged extras. Diff −9,000.

## Not the cause

- Single Core loader / unified TB RPC bug (CHINA/COUTURE balanced; bridal JE math explains 100% of diff)
- Fixture / monitoring golden drift
- `accounts.balance` cache mismatch alone
