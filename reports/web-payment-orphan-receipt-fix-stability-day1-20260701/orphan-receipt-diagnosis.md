# Orphan receipt diagnosis — RCV-0081 / RCV-0082

**Company:** DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`)  
**Decision:** `SAFE_CANCEL_HIDE_BOTH_ORPHAN_RECEIPTS`

| Ref | Payment ID | JE | Amount | Lines | Allocations | Safe soft-cancel |
|-----|------------|-----|--------|-------|-------------|------------------|
| RCV-0081 | `a7c11a0f-17df-4ade-97f7-f51678f5dbd8` | JE-0209 | 45,000 | 0 | 0 | **YES** |
| RCV-0082 | `485ce156-743a-4988-8889-acfb22ded18c` | JE-0210 | 45,000 | 0 | 0 | **YES** |

Both had `manual_receipt` reference type, zero `journal_entry_lines`, no invoice allocations, no cash/bank GL impact. Cancel Payment failed because reversal requires posted lines.

Raw JSON: `orphan-receipt-diagnosis.json`
