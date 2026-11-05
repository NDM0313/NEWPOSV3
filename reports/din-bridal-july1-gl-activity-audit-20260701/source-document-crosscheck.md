# Source document cross-check

| Source | Ref | Amount | Party | Status | Audit window | Normal? |
|--------|-----|--------|-------|--------|--------------|---------|
| Payment | RCV-0075 | 80,000 | Walk-in Customer (N331 balance) | Posted JE 11:56 UTC | Yes | Yes |
| Sale | SL-0018 | 79,325 JE total | MAHVISH IQBAL | Finalized 12:32 UTC | Yes | Yes |
| Payment | RCV-0076 | 42,000 | MAHVISH IQBAL (SL-0018 receipt) | Posted JE 12:42 UTC | Yes | Yes |
| Payment | RCV-0077 | 20,000 | HARIS N219 (SL-0019 receipt) | Posted JE 13:07 UTC | Yes (post-artifact) | Yes |

No `party_discount` JE, no voids/reversals/corrections in the audit window.

Receipts use backdated `entry_date` (June/May) with `created_at` on 2026-07-01 — typical for operational receipt entry during live shop day.

**Operator pattern:** Payment receipts share `created_by` `50512623-…`; sale finalize `8d3f329e-…` — consistent with live staff posting, not automation bug.
