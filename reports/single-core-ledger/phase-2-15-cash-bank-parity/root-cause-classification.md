# Phase 2.15 — Root cause classification

| Bucket | Approx impact (wide range) | Classification |
|--------|---------------------------|----------------|
| Payment-posted GL legs (`payment_id` set) | +68.5M unified cash_out | unified includes GL row not treated as roznamcha cash/bank |
| Document expense GL credits | +1.1M unified cash_out | legacy includes non-GL payment row |
| Journal transfer both legs vs JE dedupe | +58M net cash_out inflation | transfer double-count (unified) vs JE-level dedupe (legacy) |
| Payment vs entry_date | +421K cash_in delta | date mismatch (minor vs payment path) |
| Opening scope | unified RPC opening 0 in wide window | opening balance basis mismatch (display; closing identity holds) |
| manual_receipt GL | compare supplement only | manual journal inclusion mismatch (compare path) |

**Primary root cause:** Phase 2.14 mapped raw `get_unified_cash_bank_ledger` rows directly to Roznamcha. Roznamcha is a **payment+journal composite** with JE-level dedupe, not a GL cashbook.

**Fix:** `assembleRoznamchaUnifiedParityMain` uses `getRoznamcha` for displayed totals/rows; unified RPC retained for preview metadata only.

**Migration required:** No.
