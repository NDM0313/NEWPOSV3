# DIN CHINA Legacy Import — Final Report

Generated: 2026-06-14T19:52:17.272Z
Company: 30bd8592-3384-4f34-899a-f3907e336485
Source: legacy_din_china

## Post-apply validation
- Pass: **YES**

### Checks
- PASS sales count: expected 34, got 34
- PASS sale items count: expected 63, got 63
- PASS sale payments count: expected 70, got 70
- PASS sale payments total: expected 8416540, got 8416540
- PASS purchase count: expected 1, got 1
- PASS purchase items count: expected 17, got 17
- PASS purchase payments count: expected 4, got 4
- PASS purchase payments total: expected 65916440, got 65916440
- PASS expenses count: expected 4, got 4
- PASS expenses total: expected 88000, got 88000
- PASS sale JEs Dr1100/Cr4100: expected >=34, got 34
- PASS no 4050 parent posting: expected false, got false
- PASS no 4000 Revenue account: expected false, got false
- PASS no 4000 in sale JEs: expected false, got false
- PASS no branch id 1 in import set: expected DIN CHINA branch only, got BL0002

## Imported counts
- Sales: 34/34
- Sale items: 63/63
- Sale payments: 70/70 (total 8416540)
- Purchase: 1
- Purchase items: 17
- Purchase payments: 4 (total 65916440)
- Expenses: 4/4

## Accounting
- Sale document JEs Dr1100/Cr4100: 34
- Used 4050: false
- Used 4000 in JEs: false
- Account 4000 exists: false

## Excluded (by design)
- account_transactions, fund transfers, opening balances, manual GL, branch id 1, sell_return CN2025/0001, unlinked advances — not part of this import.

## Resume / idempotency
- Safe to resume: true

## Apply stats (from last run)
{
  "pass": true,
  "errors": [],
  "stats": {
    "branchCreated": 0,
    "branchReused": 1,
    "accountsCreated": 0,
    "contactsCreated": 0,
    "productsCreated": 0,
    "variationsCreated": 0,
    "salesCreated": 0,
    "salesSkipped": 34,
    "salesFinalized": 0,
    "saleJournalsCreated": 34,
    "saleJournalsSkipped": 0,
    "saleItemsCreated": 0,
    "saleItemsSkipped": 63,
    "salePaymentsPosted": 0,
    "salePaymentsSkipped": 70,
    "purchasesCreated": 0,
    "purchasesSkipped": 1,
    "purchaseItemsCreated": 0,
    "purchaseItemsSkipped": 17,
    "purchasePaymentsPosted": 0,
    "purchasePaymentsSkipped": 4,
    "expensesCreated": 0,
    "expensesSkipped": 0,
    "expensesPosted": 0,
    "expensesPostSkipped": 0
  },
  "saleJournalStrategy": "createSaleJournalEntry",
  "revenuePostingCode": "4100",
  "arAccountCode": "1100",
  "branchId": "92f4184e-ee9b-4b6c-8e76-10ee1d166f55"
}