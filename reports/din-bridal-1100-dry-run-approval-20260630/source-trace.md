# Source trace — DIN BRIDAL control 1100

**Root cause:** `SALES_AR_MISPOST` / `WRONG_ACCOUNT_1100_CONTROL_USED`

## Exact source of -136,500

| JE | Date | Type | Invoice | Customer | Cr on 1100 |
|----|------|------|---------|----------|------------|
| JE-0155 | 2026-05-31 | sale_reversal | HQ-SL-0001 | Miss NAGHMANA RAJA | 78,750 |
| JE-0157 | 2026-05-31 | sale_reversal | HQ-SL-0002 | ASIM | 57,750 |
| **Total** | | | | | **136,500** |

Cancelled sale reversals credited **control 1100** instead of party AR sub-ledgers (`AR-CUS0056`, `AR-CUS0012`).

## Other 1100 activity (net zero)

- Rental charges/advances JE-0001..0004 on 1100 — **partially corrected** by JV-000203..207 (2026-06-12 `gl_correction` rental-1100-leakage pattern).
- JE-0161 sale reversal (150) — corrected by JV-000203.

## Classification per suspect

| Line | Classification |
|------|----------------|
| JE-0155 | SALES_AR_MISPOST |
| JE-0157 | SALES_AR_MISPOST |
| JE-0001..0004 | LEGACY rental leakage (corrected) |
| JV-000203..207 | MANUAL_JE_EXPECTED (prior repair) |

## Report visibility

- **Trial Balance:** control 1100 shows **-136,500**
- **Party ledger:** Miss NAGHMANA RAJA / ASIM balances unaffected by reversal mis-post
- **Customer sub-ledger:** reversal did not reduce party AR as intended
