# 2026-09-26 — Complete Delete on Receive / Payment (web + mobile)

## Summary

Extend **Complete Delete** (typed `HARD DELETE`) from manual journals to **Receive** and **Pay** payment transactions on web Accounting Transaction Detail and erp-mobile-app journal/payment detail.

## Eligibility

| Row | Complete Delete |
|-----|-----------------|
| Manual / misc / correction_reversal / voided JE (no bill root) | Yes — JE + lines only |
| Receive / Pay (`payment_id` or payment kind) | Yes — payment + allocations + full JE chain |
| Sale / purchase / rental / studio **bill** (document-total, no payment_id) | No — open source module |

Cancel Payment / Cancel Entry remain the soft void + reversal path (audit preserved).

## Web

- [`src/app/lib/manualJournalHardDeletePolicy.ts`](../../src/app/lib/manualJournalHardDeletePolicy.ts) — payment rows eligible; document roots still blocked
- [`src/app/services/journalHardDeleteService.ts`](../../src/app/services/journalHardDeleteService.ts) — `hardDeletePaymentTransaction` cascade; `hardDeleteJournalEntry` delegates when payment-linked
- [`TransactionDetailModal.tsx`](../../src/app/components/accounting/TransactionDetailModal.tsx) — payment-aware confirm copy

## Mobile

- `erp-mobile-app/src/lib/manualJournalHardDeletePolicy.ts`
- `erp-mobile-app/src/api/journalHardDelete.ts`
- `erp-mobile-app/src/hooks/useJournalCompleteDelete.tsx`
- `JournalEntryDetailPanel` + `reports/TransactionDetailSheet` — Complete Delete button + typed phrase confirm

## Safety

Prefer Cancel for audit. Complete Delete is permanent cleanup and requires typing `HARD DELETE`.
