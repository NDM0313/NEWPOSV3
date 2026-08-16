# DIN BRIDAL — Cash Flow finance summary

**Status:** CANDIDATE_ONLY — NOT FINANCE APPROVED  
**Finance decision required:** **Q4** (opening balance rows) · **Q7** (delta treatment)  
**Period:** 2000-01-01 to 2026-06-29 (wide range, all branches)

## Summary totals (candidate preview compare)

| Metric | Legacy (official) | Unified preview | Δ |
|--------|-------------------|-----------------|---|
| Cash In | PKR 1,836,350 | PKR 1,916,350 | PKR -80,000 |
| Cash Out | PKR 917,780 | PKR 942,780 | PKR -25,000 |
| Net movement | PKR 918,570 | PKR 973,570 | PKR -55,000 |
| **Closing** | **PKR 918,570** | **PKR 973,570** | **PKR -55,000** |

## Row-keyed export (Phase 3B-F @ production)

| Tier | Count |
|------|-------|
| Exact matches | 2 |
| Strong matches | 48 |
| Weak matches | 0 |
| Legacy-only | 1 |
| Preview-only | 3 |

## Opening balance / June 2026 row issue (Q4)

| Bucket | Rows | Net impact | Sample |
|--------|------|------------|--------|
| Legacy-only | 1 | PKR 25,000 | 2026-06-06 cash-in PKR 25,000 |
| Preview-only | 3 | PKR 80,000 | Jun 2026 rows split across preview JE mapping |

Phase 3B-E identified `opening_balance_account` and JE mapping differences. Preview shows additional cash-in/out legs legacy roznamcha does not surface the same way.

## Finance questions

**Q4:** Should opening balance rows appear only in summary/opening, as period cash-in rows, or company-specific?

**Q7:** Accept PKR -55,000 closing delta as rule difference, or approve future alignment fix phase?

See [`cash-flow-finance-decision-form.md`](cash-flow-finance-decision-form.md).

**Loader swap:** NOT APPROVED until Q4/Q7 decided and re-capture passes.
