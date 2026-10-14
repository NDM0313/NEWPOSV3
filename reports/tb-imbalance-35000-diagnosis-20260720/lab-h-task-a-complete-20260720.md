# Lab H Task A complete — account balance sync (2026-07-20)

**Company:** DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)  
**Office pull HEAD:** `2ead7210`  
**VPS frontend:** already `VITE_BUILD_COMMIT=2ead7210` (healthy)

## Task A result

| Check | Result |
|-------|--------|
| Pre account mismatches | **15** (handoff noted 2 at home; live prod had more cached drift) |
| Updated `accounts.balance` | **15** rows (set to journal Dr−Cr, voided JEs excluded) |
| Post account mismatches | **0** |
| TB Σ(Dr−Cr) non-void | **0.00** (unchanged) |
| Journal entries created | **none** |
| Migrations | **none** |

Includes the handoff Inventory **1200** Δ **105350** row among others.

Raw apply log: [`lab-h-task-a-account-balance-sync.txt`](./lab-h-task-a-account-balance-sync.txt)

## Task B — still open (do not auto-fix)

**AR vs receivables** gap remains a **separate** reconciliation (document due vs AR journal).  
Sync button / this Task A run does **not** clear that metric.

## Safety

- Only cached `accounts.balance` updated
- No JE void/repost, no GL line edits, no suspense balancing JE
