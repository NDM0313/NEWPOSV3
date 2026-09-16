# Phase 2.15 — Legacy vs unified basis map

| Dimension | Legacy `getRoznamcha` | Raw `get_unified_cash_bank_ledger` | Phase 2.15 unified loader |
|-----------|----------------------|-----------------------------------|---------------------------|
| Primary source | `payments` + `rental_payments` | `journal_entry_lines` on liquidity accounts | Same as legacy (`getRoznamcha`) |
| Document JEs (sale/purchase/expense) | Excluded — payment path | **Included** (payment_id JEs) | Excluded (via composite) |
| Journal-only (transfer/general/manual) | Included | Included | Included |
| Date basis | `payment_date` / `entry_date` | `entry_date` | Legacy composite dates |
| Dedupe | `dedupeRoznamchaRows` (JE entity key) | None — all GL legs | Legacy dedupe |
| Opening balance | Payment + rental + journal opening | GL sum before start | Legacy opening |
| Void filter | `voided_at` + JE void | `is_void` + basis filter | Legacy void rules |
| Basis lens | N/A (economic view) | `official_gl` / `effective_party` | Legacy economic view |

## DIN CHINA wide-range identity (SQL proven)

```
legacy cash_in  = payments cash_in (55,305,771) + journal-only dr (80,852,241) = 136,158,012
legacy cash_out = payments cash_out only        = 67,042,426
legacy closing  = 69,115,586
```

Raw unified RPC: cash_in 135,736,321 / cash_out 126,854,008 / closing 8,882,313.
