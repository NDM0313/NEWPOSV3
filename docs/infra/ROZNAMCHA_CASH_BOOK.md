# Roznamcha (Daily Cash Book)

Roznamcha shows **actual cash / bank / mobile wallet movements** — receive and pay only. It is **not** the full general ledger (use **Day Book** for journal debit/credit).

## What appears

| Source | When shown |
|--------|------------|
| `payments` table | Customer receipt, supplier payment, expense paid, sale/purchase payment — amount = **payment received/paid**, not invoice total |
| `rental_payments` | Rental customer collections **only when** no matching `payments` row (`reference_type = rental`) exists |
| Journal (no `payment_id`) | General entry, internal transfer, pure manual journal touching cash/bank/wallet only |

## What is excluded

- Journal entries for **rental, sale, purchase, expense, worker, courier, studio** — these already post a `payments` or `rental_payments` row for the cash leg
- Duplicate rental JE cash legs linked via `rental_payments.journal_entry_id`
- Non-liquidity accounts (AR, AP, income, expense GL without cash movement)

## Dedupe rule

**One cash movement → one row.** Three-pass dedupe in [`roznamchaService.ts`](../../src/app/services/roznamchaService.ts):

1. **Entity key:** `rp:{rental_payment_id}` or `je:{journal_entry_id}` — collapses the same rental payment or JE from multiple sources
2. **Strict key:** `date|direction|amount|payment_account_id`
3. **Strict movement key only** — loose `date|direction|amount` merge removed (was hiding two real same-day same-amount receipts)

Priority when keys collide:

1. `payments` (canonical) — RCV / PAY refs survive
2. `rental_payments` — REN booking no survives over JE
3. Journal liquidity line — JE-* only when no operational document ref exists

## Display rules (read-path)

| Column | Rule |
|--------|------|
| **Ref** | Primary = operational document: `RCV-*`, `PAY-*`, `REN-*`, `EXP-*`. `JE-*` only as fallback. Journal voucher shown as subtitle when different from ref — never duplicated. |
| **Details** | Party name (customer, supplier, vendor) — not generic "Cash Received" / "Payment Made". |
| **Account** | Exact sub-account from `payment_account_id` / COA name (e.g. "Counter Cash", "Meezan Bank") — not generic "Cash" / "Bank". |

Implementation: `resolveCanonicalRoznamchaRef`, `roznamchaRefDisplay`, `dedupeRoznamchaRows`, `ROZNAMCHA_DOCUMENT_JE_TYPES`.

## Examples

- Customer bill Rs 50,000, payment Rs 25,000 → Roznamcha shows **Rs 25,000** (Customer Payment), not Rs 50,000
- Rental receive Rs 10,000 → **one** Cash In line (not Rental + Journal duplicate)

## Deep-dive (data sources, duplicates, diagnostics)

For production issues (duplicate rows, missing rental receipts, orphan JE recovery, SQL checks), see **[`docs/accounting/ROZNAMCHA_DATA_SOURCES_AND_DUPLICATES.md`](../accounting/ROZNAMCHA_DATA_SOURCES_AND_DUPLICATES.md)** and the **[accounting reports index](../accounting/ACCOUNTING_REPORTS_INDEX.md)**.

## Related

- Day Book: [`DayBookReport.tsx`](../../src/app/components/reports/DayBookReport.tsx) — full GL journal lines
- Settings: Reports tab does **not** control Roznamcha (Accounting → Roznamcha tab)
