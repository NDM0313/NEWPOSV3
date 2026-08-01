# Management summary — Phase 3B-J Cash Flow residual delta bridge

**For:** Finance and operator  
**Date:** 2026-06-29

## In plain language

1. **Official Cash Flow is still the legacy report** — nothing changed for day-to-day users.
2. **The preview panel now follows finance rules** you already approved (Q4=A, Q5=C, Q7=B).
3. **DIN CHINA and DIN BRIDAL still show large differences** between legacy and aligned preview — this is **expected**, not a surprise bug. Legacy still counts internal transfers and opening balances the way it always has; the aligned preview follows the new rules and excludes them from normal totals.
4. **DIN COUTURE matches perfectly** — a good sign the aligned logic works when the data is straightforward.
5. **No data was changed** in this phase. This is documentation and a decision pack only.

## What finance needs to decide

Choose one path (written approval required):

| Option | Summary |
|--------|---------|
| **A** | Keep legacy official forever; preview stays diagnostic |
| **B** *(recommended)* | Accept aligned preview as the finance basis candidate; proceed to a separate sign-off pack; **no loader swap yet** |
| **C** | More investigation before any sign-off |
| **D** | Plan to change legacy official behavior later (controlled, with rollback) |

## Company snapshot

| Company | Legacy closing | Aligned preview closing | Match? | Why they differ |
|---------|----------------|-------------------------|--------|-----------------|
| DIN CHINA | PKR 37.1M | PKR -32.5M | No | Transfers excluded from preview (Q5); legacy still shows them |
| DIN BRIDAL | PKR 918,570 | PKR 60,720 | No | Opening rows excluded from preview (Q4); legacy still counts as cash-in |
| DIN COUTURE | PKR 50,500 | PKR 50,500 | **Yes** | Simple dataset; rules don't change totals |

## Bottom line

The gap is a **business/finance basis choice**, not an unexplained technical failure. Until you pick Option A/B/C/D in writing, Cash Flow finance stays **PENDING** and loader swap stays **NOT APPROVED**.

Full detail: [`residual-delta-bridge.md`](residual-delta-bridge.md) · [`finance-basis-decision-pack.md`](finance-basis-decision-pack.md)
