# Roznamcha +122,000 Cash In contributors

**Golden Cash In:** 1,836,350 → **Actual (12:43):** 1,958,350 (+122,000)  
**Golden Closing:** 918,570 → **Actual (12:43):** 1,040,570 (+122,000)

Cash Out unchanged at 917,780 — consistent with net cash **inflows** only.

## Contributors (exact sum +122,000)

| Ref | Payment ID | Amount | Account | Party / description | Created (UTC) |
|-----|------------|--------|---------|---------------------|---------------|
| **RCV-0075** | `54243a50-…` | 80,000 | 1061 NDM FSY (bank) | Walk-in Customer — N331 reaming Balance | 11:56:02 |
| **RCV-0076** | `f918811d-…` | 42,000 | 1002 CASH G140 | MAHVISH IQBAL — Receipt SL-0018 | 12:42:24 |

**JE-0205** (sale SL-0018 finalize) adds **+79,325 to TB only** — no cash/bank leg, so **no roznamcha Cash In impact** (correct behavior).

## TB cross-check

Same receipts contribute +80,000 and +42,000 to TB totals; JE-0205 adds the remaining +79,325 TB delta.

## Visibility rules

Unified roznamcha loader includes payment-posted liquidity debits. No evidence of void/correction visibility bug.

## Post–12:43

**RCV-0077** (+20,000 cash, HARIS N219 / SL-0019) would add further Cash In if monitoring re-run after 13:07 UTC.
