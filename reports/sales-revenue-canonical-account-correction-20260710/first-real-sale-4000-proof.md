# First Real Sale 4000 Proof (post-correction)

**Status:** `PASS_4000_POSTING_CONFIRMED`

**Checked:** 2026-07-10T19:40:00Z (read-only production SQL)  
**Cutoff:** `2026-07-10T18:21:44Z` (deploy of `8adf5ff2` — 4000 canonical correction)  
**Latest baseline commit:** `980586a0`  
**Supersedes:** `first-real-sale-4100-proof.md` (4100-first policy reversed)

First finalized sale journal entry after the 4000-correction deploy cutoff **confirmed revenue on 4000**.

## Result

| Outcome | Status |
|---------|--------|
| Revenue credits **4000** | **PASS** |
| Revenue credits **4100** while **4000** exists | n/a (no 4100 on this sale) |

- Post-cutoff sale document JEs: **1**
- New **4000** revenue after cutoff: **Rs. 500.00**
- New **4100** revenue after cutoff: **0**
- Post-cutoff sale_return JEs: **0**

## Sale detail

| Field | Value |
|-------|-------|
| Company | DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`) |
| Branch | DIN CHINA / BL0002 (`92f4184e-ee9b-4b6c-8e76-10ee1d166f55`) |
| Sale reference | `SL-0010` (`0d2192d8-5bd9-4fa1-9f1b-140c5266ecea`) |
| Sale total | Rs. 500.00 |
| Sale created | `2026-07-10T19:34:27Z` |
| JE id | `a47c39e9-0359-451e-929e-811efef13b8a` |
| JE entry_no | `JE-0316` |
| JE created | `2026-07-10T19:34:36Z` |
| JE balanced | **YES** (Dr 830 = Cr 830) |
| Revenue account | **4000** Sales Revenue — credit **500.00** |

## Journal entry lines (JE-0316)

| Code | Account | Debit | Credit |
|------|---------|------:|-------:|
| AR-7C5754 | Receivable — Walk-in Customer | 500.00 | 0.00 |
| 5010 | COGS - Inventory | 330.00 | 0.00 |
| 4000 | Sales Revenue | 0.00 | **500.00** |
| 1200 | Inventory | 0.00 | 330.00 |

## Operator context

- Operator approved test sale save: **SALE SAVE ON 4000 APPROVE**
- Sale finalized on localhost:5173 (production Supabase backend)
- Customer: Walk-in Customer; prior stock block on COTTON WHITE resolved for this save

## Prior context

- `b7fa557d` 4100-first deploy had **zero** post-cutoff sales before correction
- No incorrect live postings from brief 4100-first window
- Observation window closed for canonical **4000** future posting

## Safety

- DB migrations run: no
- Transfer JE run: no
- Repairs run: no
- Production mutation by diagnostic: no
- Artificial sale: **operator-approved** test sale only (SL-0010)
