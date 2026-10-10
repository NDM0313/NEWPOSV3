# DIN CHINA — Cash Flow finance summary

**Status:** CANDIDATE_ONLY — NOT FINANCE APPROVED  
**Finance decision required:** **Q5** (internal transfers) · **Q7** (delta treatment)  
**Period:** 2000-01-01 to 2026-06-29 (wide range, all branches)

## Summary totals (candidate preview compare)

| Metric | Legacy (official) | Unified preview | Δ |
|--------|-------------------|-----------------|---|
| Cash In | PKR 104,176,812 | PKR 118,313,121 | PKR -14,136,309 |
| Cash Out | PKR 67,042,426 | PKR 126,854,008 | PKR -59,811,582 |
| Net movement | PKR 37,134,386 | PKR -8,540,887 | PKR 45,675,273 |
| **Closing** | **PKR 37,134,386** | **PKR -8,540,887** | **PKR 45,675,273** |

## Row-keyed export (Phase 3B-F @ production)

| Tier | Count |
|------|-------|
| Exact matches | 89 |
| Strong matches | 0 |
| Weak matches | 11 |
| Legacy-only | 223 |
| Preview-only | 305 |

## Primary bucket — transfer legs (Q5)

| Field | Value |
|-------|-------|
| Rows | 80 |
| Cash in total | PKR 2,000,000 |
| Cash out total | PKR 58,889,891 |
| **Net impact** | **PKR -56,889,891** |

Legacy roznamcha path presents internal transfers differently than unified GL liquidity lines (both legs visible in preview). This bucket is the **primary driver** of the closing delta.

## Finance question

**Q5:** Should internal transfers be shown gross (both legs), netted, excluded from normal Cash Flow, or keep legacy presentation?

See [`cash-flow-finance-decision-form.md`](cash-flow-finance-decision-form.md) for options.

**Loader swap:** NOT APPROVED until Q5/Q7 decided and re-capture passes.
