# DIN CHINA Legacy Import — Final Report

Generated: 2026-06-15T07:07:56.525Z
Company: DIN CHINA (30bd8592-3384-4f34-899a-f3907e336485)

## Apply path
- Implemented: yes
- Live import applied: no (dry-run only)
- Sale journal strategy: createSaleJournalEntry
- Revenue posting code: 4100
- AR account: 1100

## Duplicate protection
- Deterministic UUIDs (`dinChinaUuid`) for branch, accounts, contacts, products, variations, sales, purchases, expenses, sale/purchase line items
- `findExistingLegacySale/Purchase/Expense/Payment` — match by deterministic id or notes/description marker
- Sale document JE fingerprint `sale_document:{companyId}:{saleId}` + skip if active canonical JE exists
- Payment/expense RPCs skipped when legacy payment/expense markers already present

## Dry-run
- Pass: YES
- Blocking errors: 0


## Warnings
- Import uses createSaleJournalEntry (ensureRevenueAccount name/code fallback), not record_sale RPC
- Revenue 4050 confirmed as parent/group — posting will use detail child 4100, not 4050