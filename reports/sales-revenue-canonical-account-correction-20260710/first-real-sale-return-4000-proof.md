# First Real Sale Return 4000 Proof (post-correction)

**Status:** `PASS_4000_RETURN_REVERSAL_CONFIRMED`

**Checked:** 2026-07-10T20:10:00Z (read-only production SQL)  
**Cutoff:** `2026-07-10T18:21:44Z` (deploy of `8adf5ff2` — 4000 canonical correction)  
**Operator approval:** sale return create approved

First finalized sale return journal entry after the 4000-correction deploy cutoff **confirmed revenue reversal on 4000**.

## Result

| Outcome | Status |
|---------|--------|
| Revenue debits **4000** (reversal) | **PASS** |
| Revenue debits **4100** while **4000** exists | n/a (no 4100 on this return) |

- Post-cutoff sale_return JEs: **2** (COGS/stock + revenue/AR)
- New **4000** revenue reversal after cutoff: **Rs. 500.00** (debit)
- New **4100** revenue reversal after cutoff: **0**

## Return detail

| Field | Value |
|-------|-------|
| Company | DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`) |
| Return reference | `RET-20260711-3835` (`4cae9585-4f93-4a9c-b4ca-07e9dad64d90`) |
| Original sale | `SL-0010` |
| Return total | Rs. 500.00 |
| Return finalized | `2026-07-10T20:04:54Z` |
| Return item | COTTON WHITE (SKU 0018) qty 1 @ 500 |

## Journal entries

### JE-0318 — Revenue / AR reversal

| Field | Value |
|-------|-------|
| JE id | `8d17f484-3a79-409e-8fbf-fb6b0c2c7aec` |
| JE created | `2026-07-10T20:05:04Z` |
| JE balanced | **YES** |

| Code | Account | Debit | Credit |
|------|---------|------:|-------:|
| 4000 | Sales Revenue | **500.00** | 0.00 |
| AR-7C5754 | Receivable — Walk-in Customer | 0.00 | 500.00 |

### JE-0317 — COGS / Inventory reversal

| Field | Value |
|-------|-------|
| JE id | `3898d2d5-39a6-40fb-bf10-efb0769fd33c` |
| JE created | `2026-07-10T20:05:00Z` |
| JE balanced | **YES** |

| Code | Account | Debit | Credit |
|------|---------|------:|-------:|
| 1200 | Inventory | 330.00 | 0.00 |
| 5010 | COGS - Inventory | 0.00 | 330.00 |

## Pairing with sale proof

| Document | Invoice / Return | Revenue side | Amount |
|----------|------------------|--------------|-------:|
| Sale JE-0316 | SL-0010 | 4000 **credit** | 500.00 |
| Return JE-0318 | RET-20260711-3835 | 4000 **debit** | 500.00 |

Sale and return both use **4000** — canonical correction verified for both directions.

## Safety

- DB migrations run: no
- Transfer JE run: no
- Repairs run: no
- Production mutation by diagnostic: no
- Operator-approved test return only
