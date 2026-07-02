# Root cause — orphan web customer receipts

## Summary

Web customer receipt posting was **not atomic**: `payments` row inserted first, then `accountingService.createEntry`. On line-insert failure or retry after UI error, payment + JE shell remained with **zero lines** while list UI derived amount from JE lines (Rs 0.00).

## Code paths

1. **Add Entry V2** — `addEntryV2Service.createCustomerReceiptEntry` (primary web path)
2. **Legacy manual receipt** — `AccountingContext.tsx` manual receipt handler (same payment-first pattern)
3. **JE creation** — `accountingService.createEntry` inserted header before lines

## Why each symptom occurred

| Symptom | Cause |
|---------|-------|
| Payment Rs 45,000 but grid Rs 0.00 | List amount from JE lines; orphans have 0 lines |
| JE marked posted with 0 lines | Header created; line insert failed or never ran |
| Retry created duplicate | No duplicate guard on customer/amount/date/account |
| Cancel Payment errors | Reversal path requires posted lines |
| `manual_receipt` badge | Correct `reference_type` on payment/JE |

## Fix (this run)

- Rollback on JE failure (`rollbackFailedCustomerReceiptAttempt`)
- Duplicate guard (`findRecentDuplicateManualReceipt`, 5-minute window)
- `createEntry` voids JE header if line insert fails; requires ≥2 lines
- Orphan detection UI + soft hide (`cancelOrphanManualReceipt`)
- Display linked payment amount with orphan warning
