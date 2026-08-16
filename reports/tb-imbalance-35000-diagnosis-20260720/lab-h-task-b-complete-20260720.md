# Lab H Task B complete — AR vs receivables (2026-07-20)

**Company:** DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)  
**Lab H metric:** `document_due (final sales, due > 0) − AR journal (1100 + AR-*)`  
**Observed:** **−1,382,450** (matches office handoff)

## Verdict

| Label | Value |
|-------|--------|
| Classification | **EXPECTED_METRIC_GAP** — not a Trial Balance defect |
| GL mutation performed | **no** |
| JE rebuild / suspense | **no** |
| Task B investigation | **COMPLETE** |
| Force sales.due = AR | **rejected** (would corrupt openings / rental AR) |

## Live numbers (production read-only)

| Side | Amount (PKR) |
|------|-------------:|
| Final sales positive `due` (Lab H left) | **329,000** |
| AR journal Dr−Cr on 1100 + AR-* (Lab H right) | **1,711,450** |
| Lab H difference (due − AR) | **−1,382,450** |
| Final sales count | 28 (6 with positive due) |

## Why the gap exists

Lab H compares **open final-sale document dues only** against **all AR GL activity**, including:

| AR journal reference_type | Net Dr−Cr (PKR) |
|---------------------------|----------------:|
| `opening_balance_contact_ar` | **+2,382,950** (57 JEs) |
| `sale` | +1,410,700 |
| `rental` | +180,000 |
| `correction_reversal` | +80,000 |
| `payment` | −1,540,000 |
| `manual_receipt` | −615,000 |
| `sale_reversal` | −187,200 |
| `gl_correction` | 0 |

Opening customer AR (imported/posted 2026-05-30 JE-0088… class) is **not** represented as `sales.due` rows. Rentals also post to AR subledgers without adding to the sales-due side. Therefore Lab H will show a large negative difference even when:

- TB Σ(Dr−Cr) = **0**
- Account balance cache mismatches = **0** (Task A done)
- Unbalanced JEs = **0**

## What was NOT done (by design)

- No balancing JE / suspense write
- No mass rewrite of `sales.due_amount`
- No void of opening AR
- No change to Lab H formula in this closeout (optional UX follow-up only)

## Optional future UX (not blocking)

Label Lab H card as e.g. “Final sales due vs full AR GL (includes openings + rentals)” and/or show an **opening AR bridge** line so operators do not treat this as TB failure.

## Evidence

- Raw SQL log: [`lab-h-task-b-ar-vs-receivables-diag.txt`](./lab-h-task-b-ar-vs-receivables-diag.txt)
- Related: [`office-handoff-lab-h-remaining-20260720.md`](./office-handoff-lab-h-remaining-20260720.md), [`admin-self-fix-tb-imbalance.md`](./admin-self-fix-tb-imbalance.md)

## Operator takeaway

**Task B is closed as explained.** Remaining Lab H “AR vs receivables” number can stay non-zero for DIN BRIDAL without implying broken books. Use Party Ledger / contact AR for customer collection truth; use TB / unbalanced JE tools for GL integrity.
