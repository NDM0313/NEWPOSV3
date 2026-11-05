# Row delta — DIN BRIDAL (Phase 3B-E)

**Period:** 2000-01-01 to 2026-06-29  
**Branch observed:** Selected branch  
**Method:** legacy_dom_scrape + unified_rpc_intercept

## Counts

| Bucket | Rows | Cash In | Cash Out |
|--------|------|---------|----------|
| Legacy (DOM) | 51 | — | — |
| Preview (RPC) | 53 | — | — |
| Legacy only | 51 | 1836350 | 917780 |
| Preview only | 53 | 1916350 | 942780 |

## Preview-only by reference type

- **opening_balance_account:** 2 rows · In 912850 · Out 0
- **journal:** 3 rows · In 363000 · Out 2800
- **payment:** 17 rows · In 379000 · Out 25000
- **general:** 3 rows · In 0 · Out 704500
- **rental:** 7 rows · In 141500 · Out 0
- **manual_receipt:** 2 rows · In 120000 · Out 0
- **expense:** 18 rows · In 0 · Out 185480
- **purchase:** 1 rows · In 0 · Out 25000

## Legacy-only by source module

- **Manual JE:** 8 rows · In 1275850 · Out 707300
- **Sales receipts:** 18 rows · In 419000 · Out 25000
- **Rentals:** 7 rows · In 141500 · Out 0
- **Expenses:** 18 rows · In 0 · Out 185480

## Sample preview-only rows (first 15)

- 2026-05-25 · opening_balance_account · In 830000 Out 0 · Opening balance — account 1003 — Cash in NDM
- 2026-05-26 · journal · In 58000 Out 0 · OPENING BALANCE
- 2026-05-27 · journal · In 305000 Out 0 · OPENING BALANACE
- 2026-05-27 · opening_balance_account · In 82850 Out 0 · Opening balance — account 1021 — NDM EASY
- 2026-05-31 · payment · In 25000 Out 0 · Receipt SL-0005 (Patras) - Cash
- 2026-05-31 · general · In 0 Out 200000 · Journal entry · From-Dr NDM MZ (1011) · To-Cr Noor Khan Committee (1171) · By Na
- 2026-05-31 · rental · In 3000 Out 0 · Rental booking advance — REN-0004 (Saqib)
- 2026-06-01 · rental · In 50000 Out 0 · Rental booking advance — REN-0001 (Haseeb N38)
- 2026-06-01 · payment · In 15000 Out 0 · Receipt SL-0012 (MAHVISH IQBAL) - Receipt SL-0012 (MAHVISH IQBAL)
- 2026-06-01 · manual_receipt · In 40000 Out 0 · Customer receipt from Walk-in Customer. N32
- 2026-06-01 · expense · In 0 Out 17415 · Expense #EXP-0003 - ELECTRIC G140 9432+7983 [Edited 03/06/2026, 11:53 am: Accoun
- 2026-06-01 · expense · In 0 Out 8965 · Expense #EXP-0004 - Electric N105
- 2026-06-01 · general · In 0 Out 500000 · Journal entry · From-Dr NDM MZ (1011) · To-Cr M. Ullah Committee (1172) · By Nad
- 2026-06-02 · payment · In 5000 Out 0 · Receipt RCV-0005 (Walk-in Customer old) - N32 | Bank Trace ID: 051708
- 2026-06-03 · payment · In 40000 Out 0 · Receipt SL-0013 (Walk-in Customer) - Receipt SL-0013 (Walk-in Customer)

## Sample legacy-only rows (first 15)

- 25/05/2026 · Manual JE · Live · In 830000 Out 0 · JE-0193Opening balance — account 1003 — Cash in NDM
- 26/05/2026 · Manual JE · Live · In 58000 Out 0 · JV-000001Customer Receipt
- 27/05/2026 · Manual JE · Live · In 305000 Out 0 · JV-000002Customer Receipt
- 27/05/2026 · Manual JE · Live · In 82850 Out 0 · JE-0171Opening balance — account 1021 — NDM EASY
- 31/05/2026 · Sales receipts · Live · In 25000 Out 0 · RCV-0002Patras
- 31/05/2026 · Rentals · Live · In 3000 Out 0 · HQ-RCV-0001JE-0010Saqib
- 31/05/2026 · Manual JE · Live · In 0 Out 200000 · JE-0005Noor Khan Committee (1171)
- 01/06/2026 · Sales receipts · Live · In 15000 Out 0 · RCV-0003MAHVISH IQBAL
- 01/06/2026 · Sales receipts · Live · In 40000 Out 0 · RCV-0004JE-0170Walk-in Customer old
- 01/06/2026 · Expenses · Live · In 0 Out 17415 · EXP-0003SHOP EXP › Utilities
- 01/06/2026 · Expenses · Live · In 0 Out 8965 · EXP-0004SHOP EXP › Utilities
- 01/06/2026 · Manual JE · Live · In 0 Out 500000 · JE-0006M. Ullah Committee (1172)
- 01/06/2026, 09:34 pm · Rentals · Live · In 50000 Out 0 · HQ-RCV-0002JE-0002Haseeb N38
- 02/06/2026, 02:28 pm · Rentals · Live · In 50000 Out 0 · HQ-RCV-0003JE-0004Inayat
- 02/06/2026, 08:10 pm · Sales receipts · Live · In 5000 Out 0 · RCV-0005Walk-in Customer old

> Row keys use date+reference+amount heuristic — journal line IDs not in legacy DOM; treat as diagnostic not finance golden.
