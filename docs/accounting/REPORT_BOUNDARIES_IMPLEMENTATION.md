# Accounting report boundaries — implementation report (2026-06-03)

## Regression fix (2026-06-04) — HQ-RCV-0006 + Day Book spinner

| File | Change |
|------|--------|
| [`src/app/services/roznamchaDedupe.ts`](../../src/app/services/roznamchaDedupe.ts) | Evidence-gated movement merge (`hasStableEntityId`, `rowsShareMovementEvidence`); no blind date+amount collapse |
| [`src/app/services/roznamchaService.ts`](../../src/app/services/roznamchaService.ts) | Dev-only trace for HQ-RCV-0006 / JE-0012 / Inayat+10000 pre/post dedupe |
| [`src/app/services/roznamchaService.dedupe.test.ts`](../../src/app/services/roznamchaService.dedupe.test.ts) | HQ-RCV-0005/0006, distinct JE/RP ids, entity-priority tests |
| [`src/app/components/reports/DayBookReport.tsx`](../../src/app/components/reports/DayBookReport.tsx) | Stable effect deps, `formatDateTimeUtil`, `finally` loading, `loadError`, `MAX_JE_PAGES` cap |

**HQ-RCV-0006 root cause:** pass-2 movement-key dedupe merged rows sharing `date|direction|amount|paymentAccountId` even when `sourceJournalEntryId` / `sourcePaymentId` differed — HQ-RCV-0005 won over HQ-RCV-0006.

**Day Book root cause:** `formatDateTime` from `useFormatDate` is a new function each render; including it in `useEffect` deps caused infinite refetch → perpetual `loading`.

**Constraints honored:** no GL posting, payment amount, void/delete, RCV/PAY/EXP numbering, or JE-0188/0189 repair changes.

## Files changed (boundaries pass)

| File | Change |
|------|--------|
| [`src/app/services/roznamchaDedupe.ts`](../../src/app/services/roznamchaDedupe.ts) | **New** — entity dedupe + evidence-gated movement merge |
| [`src/app/services/roznamchaService.ts`](../../src/app/services/roznamchaService.ts) | `sourcePaymentId`, orphan recovery guards, rental skip/date rules |
| [`src/app/services/customerLedgerApi.ts`](../../src/app/services/customerLedgerApi.ts) | `fetchCustomerReceivedPaymentsForRange` |
| [`src/app/services/accountingService.ts`](../../src/app/services/accountingService.ts) | Advance payments, RCV refs, `resolvePartyLedgerReference` |
| [`src/app/lib/partyLedgerReference.ts`](../../src/app/lib/partyLedgerReference.ts) | **New** — statement ref + advance description |
| [`src/app/components/reports/DayBookReport.tsx`](../../src/app/components/reports/DayBookReport.tsx) | No rounding mask, chunked JE load, void filter, voucher panel |
| [`src/app/services/roznamchaService.dedupe.test.ts`](../../src/app/services/roznamchaService.dedupe.test.ts) | Unit tests |
| [`src/app/lib/partyLedgerReference.test.ts`](../../src/app/lib/partyLedgerReference.test.ts) | Unit tests |
| [`package.json`](../../package.json) | `npm run test:unit` |
| [`docs/infra/ROZNAMCHA_CASH_BOOK.md`](../infra/ROZNAMCHA_CASH_BOOK.md) | Loose dedupe removed |
| [`docs/accounting/REPORT_BOUNDARIES_BASELINE.md`](REPORT_BOUNDARIES_BASELINE.md) | Baseline SQL |

## Root causes

1. **Roznamcha duplicates / missing rows:** loose `date|direction|amount` dedupe; payment rows lacked `pay:{id}` entity key; orphan recovery used movement key only; rental skip required both payment mirrors.
2. **Missing advance on statement:** `get_customer_ledger_payments` scoped to **final** `saleIds` only — non-final order payments excluded.
3. **Wrong REN on receipt rows:** synthetic merge used `booking_no + '-PAY'`; dedupe merge preferred `-PAY` suffix over RCV.
4. **Day Book misleading balance:** display-only rounding row masked real Σ debit ≠ Σ credit.

## SQL baseline / after

See [`REPORT_BOUNDARIES_BASELINE.md`](REPORT_BOUNDARIES_BASELINE.md).

- **Duplicate same-day received payments:** 0 rows (before and after — no data fix needed).
- **JE-0188 / JE-0189:** unchanged in DB (diagnosis only; no auto-repair).
- **Advance payments:** query in baseline doc — statement now loads via `fetchCustomerReceivedPaymentsForRange` (any sale status).

## Confirmations

| Rule | Status |
|------|--------|
| Roznamcha liquidity-only | Yes — non-liquidity `payment_account_id` still filtered; dedupe tightened |
| Customer advance before final sale | Yes — explicit received-payment fetch |
| Non-final sale debit hidden | Yes — `fetchCustomerLedgerSalesForRange` still final-only for invoice debits |
| Day Book journal-line only | Yes — no Roznamcha merge; raw footer totals |
| GL posting unchanged | Yes — no migration / trigger edits |

## Verification

- `npm run test:unit` — 11/11 pass (8 roznamcha dedupe + 3 party ledger)
- `npm run build` — pass
- **Manual Roznamcha:** range 2015-12-31 → 2026-06-05, All Branches, All liquidity — HQ-RCV-0005 and HQ-RCV-0006 both visible (Cash G140, Rs 10,000 each); search JE-0012 / Inayat / 10000
- **Manual Day Book:** loads in effective + audit modes; no infinite spinner; unbalanced voucher panel intact

**Client:** hard refresh ERP (Accounting → Roznamcha, Account Statement, Day Book).
