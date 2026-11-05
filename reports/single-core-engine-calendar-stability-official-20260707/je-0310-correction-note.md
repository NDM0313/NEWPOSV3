# JE-0310 operator correction — DIN CHINA

**Date:** 2026-07-07  
**Company:** DIN CHINA  
**Issue:** Orphan one-sided `purchase_reversal` from mistaken PUR-0004 cancel (mobile RPC path)

| Item | Value |
|------|--------|
| Journal | JE-0310 |
| Purchase | PUR-0004 (190 PKR, unpaid, cancelled) |
| Problem | Single line AP debit 190 — no offsetting credit; no original `purchase` JE |
| TB impact | +190 PKR debit imbalance |

## Action taken

Voided JE-0310 on production (`is_void = true`, reason: mistaken purchase cancel orphan reversal).

Post-void company TB: debit = credit = **412,957,272.02** (delta **0**).

## Forward fix (code — separate track)

Align mobile `cancel_purchase_full_void` RPC with web `reversePurchaseDocumentJournalEntry` mirror path — do not post reversal when no canonical purchase JE exists.
