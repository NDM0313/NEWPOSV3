# OCR on payment / journal attachments

**Status:** Phase 1 + **Scan Receipt hub** (standard method).

## Primary workflow (recommended)

Accounts dashboard → **Scan Receipt**:

1. Camera / gallery screenshot  
2. Editable OCR sheet (amount, date, reference, notes, raw text)  
3. User picks transaction type: Client / Supplier / Worker / Courier / Expense / Account Transfer / General Entry  
4. Existing flow opens with seeded fields + attachment; party/COA still picked manually  

## Secondary workflow (unchanged)

Inside General Entry, Account Transfer, or any `MobilePaymentSheet`: attach image → OCR review → Confirm apply into that form only.

## Why not on the Account Transfer tile alone

OCR is not the tile itself. Use **Scan Receipt**, or open Transfer and attach a screenshot on the details step.

## Meezan sample mapping

| Receipt text | Draft field |
|--------------|-------------|
| PKR 200,000 | Amount |
| Jul 13, 2026 | Date |
| Reference Number: 569823 | Reference |
| From / To account names | Description add-on (text only) |
| Handwritten FAROOQ BNRS | User still picks ERP supplier manually |

## Engine

- `tesseract.js` (`eng`), lazy-loaded  
- Parser: `src/lib/ocr/parsePakBankReceipt.ts`  
- Hub: `ReceiptScanFlow` + `receiptOcrRouteSeed.ts`
