# Row delta — DIN CHINA (Phase 3B-E)

**Period:** 2000-01-01 to 2026-06-29  
**Branch observed:** Selected branch  
**Method:** legacy_dom_scrape + unified_rpc_intercept

## Counts

| Bucket | Rows | Cash In | Cash Out |
|--------|------|---------|----------|
| Legacy (DOM) | 323 | — | — |
| Preview (RPC) | 405 | — | — |
| Legacy only | 323 | 104176812 | 67042426 |
| Preview only | 405 | 118313121 | 126854008 |

## Preview-only by reference type

- **transfer:** 169 rows · In 82852241 · Out 58889891
- **expense:** 16 rows · In 0 · Out 1125986
- **payment:** 217 rows · In 22402880 · Out 65916440
- **general:** 1 rows · In 0 · Out 921691
- **manual_receipt:** 2 rows · In 13058000 · Out 0

## Legacy-only by source module

- **Transfers:** 89 rows · In 80852241 · Out 0
- **Expenses:** 16 rows · In 0 · Out 1125986
- **Sales receipts:** 214 rows · In 23324571 · Out 0
- **Purchase payments:** 4 rows · In 0 · Out 65916440

## Sample preview-only rows (first 15)

- 2025-01-06 · transfer · In 500000 Out 0 · Transfer DIN FHD MZ → Al Habib — BANK AL HABIB
- 2025-01-06 · transfer · In 0 Out 500000 · Transfer DIN FHD MZ → Al Habib — BANK AL HABIB
- 2025-01-07 · transfer · In 500000 Out 0 · Transfer DIN FHD MZ → Al Habib — BANK AL HABIB
- 2025-01-07 · transfer · In 0 Out 500000 · Transfer DIN FHD MZ → Al Habib — BANK AL HABIB
- 2025-01-14 · transfer · In 700000 Out 0 · Owner Capital → Al Habib — H.BUKHCHA GUL TR — H.GHUNCHA GUL
- 2025-01-17 · transfer · In 120000 Out 0 · Owner Capital → Al Habib — GUL BAT TR — GUL BAT
- 2025-01-18 · transfer · In 80000 Out 0 · Owner Capital → Al Habib — GUL BAT TR — GUL BAT
- 2025-01-21 · transfer · In 700000 Out 0 · Owner Capital → Al Habib — H.BUKHCHA GUL TR — H.GHUCHA GUL
- 2025-01-22 · transfer · In 250000 Out 0 · Owner Capital → Al Habib — ALMAS TR — ALMAS TR
- 2025-01-23 · transfer · In 100000 Out 0 · Owner Capital → Al Habib — ALMAS TR — ALMAS TR
- 2025-01-28 · transfer · In 700000 Out 0 · Owner Capital → Al Habib — H.BUKHCHA GUL TR — H.GHUCHA GUL
- 2025-01-30 · transfer · In 350000 Out 0 · Owner Capital → Al Habib — ALMAS TR — ALMAS TR
- 2025-02-04 · transfer · In 700000 Out 0 · Owner Capital → Al Habib — H.BUKHCHA GUL TR — H.GHUCHA GUL
- 2025-02-11 · transfer · In 18500000 Out 0 · Owner Equity — FS2 cash to Owner Capital via WALI T/T
- 2025-02-11 · transfer · In 0 Out 1000000 · Transfer ALHABIB DIN → WALI DIN T/T — WALI TT

## Sample legacy-only rows (first 15)

- 06/01/2025 · Transfers · Live · In 500000 Out 0 · JE-0270Transfer DIN FHD MZ → Al Habib — BANK AL HABIB
- 07/01/2025 · Transfers · Live · In 500000 Out 0 · JE-0271Transfer DIN FHD MZ → Al Habib — BANK AL HABIB
- 14/01/2025 · Transfers · Live · In 700000 Out 0 · JE-0272Owner Capital → Al Habib — H.BUKHCHA GUL TR — H.GHUNCHA GUL
- 17/01/2025 · Transfers · Live · In 120000 Out 0 · JE-0273Owner Capital → Al Habib — GUL BAT TR — GUL BAT
- 18/01/2025 · Transfers · Live · In 80000 Out 0 · JE-0274Owner Capital → Al Habib — GUL BAT TR — GUL BAT
- 21/01/2025 · Transfers · Live · In 700000 Out 0 · JE-0275Owner Capital → Al Habib — H.BUKHCHA GUL TR — H.GHUCHA GUL
- 22/01/2025 · Transfers · Live · In 250000 Out 0 · JE-0276Owner Capital → Al Habib — ALMAS TR — ALMAS TR
- 23/01/2025 · Transfers · Live · In 100000 Out 0 · JE-0277Owner Capital → Al Habib — ALMAS TR — ALMAS TR
- 28/01/2025 · Transfers · Live · In 700000 Out 0 · JE-0278Owner Capital → Al Habib — H.BUKHCHA GUL TR — H.GHUCHA GUL
- 30/01/2025 · Transfers · Live · In 350000 Out 0 · JE-0279Owner Capital → Al Habib — ALMAS TR — ALMAS TR
- 04/02/2025 · Transfers · Live · In 700000 Out 0 · JE-0280Owner Capital → Al Habib — H.BUKHCHA GUL TR — H.GHUCHA GUL
- 11/02/2025 · Transfers · Live · In 18500000 Out 0 · JE-0197Owner Equity — FS2 cash to Owner Capital via WALI T/T
- 11/02/2025 · Transfers · Live · In 750000 Out 0 · JE-0200Transfer DIN FHD MZ → WALI DIN T/T — WALI TT
- 11/02/2025 · Transfers · Live · In 1000000 Out 0 · JE-0199Transfer ALHABIB DIN → WALI DIN T/T — WALI TT
- 11/02/2025 · Transfers · Live · In 500000 Out 0 · JE-0203Transfer MCB → WALI DIN T/T — WALI TT

> Row keys use date+reference+amount heuristic — journal line IDs not in legacy DOM; treat as diagnostic not finance golden.
