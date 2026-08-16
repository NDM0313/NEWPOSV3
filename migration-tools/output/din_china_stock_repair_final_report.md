# DIN CHINA Stock Movement Repair — Final Report

Generated: 2026-06-14T20:49:20.577Z
Company: 30bd8592-3384-4f34-899a-f3907e336485
Apply: SUCCESS
Verification pass: **YES**

## Apply stats
- Movements inserted: 0
- Products track_stock updated: 16

## Preview summary
- Sale lines to insert (planned): 0
- Purchase lines to insert (planned): 0
- Already covered sale lines: 63
- Already covered purchase lines: 17

## Verification checks

- PASS sales with stock movements: expected 34, got 34
- PASS sale item lines covered: expected 63, got 63
- PASS purchase item lines covered: expected 17, got 17
- PASS purchase movement row count: expected 17, got 17
- PASS sale movement row count: expected 63, got 63
- PASS legacy products track_stock: expected 0, got 0

## Confirmations
- Document stock_movements backfilled only (no opening balance stock)
- Existing movement rows not deleted or modified
- Journal entries and payment amounts not modified
- Canonical stock qty = SUM(stock_movements.quantity) per product/branch