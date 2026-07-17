# CLIENT_ACCOUNTING_HELPERS.md

| Helper | Purpose | Callers | Creates/Patches | Web parity | Risk | Action |
|--------|---------|---------|-----------------|------------|------|--------|
| `createJournalEntry` | Direct JE insert + invalidate | GeneralEntry, Transfer, rental, studio stages, sync | Create | Similar data model | Duplicate without fingerprint | **Keep** |
| `rentalBookingAccounting` | Rental AR/advance/penalty | `rentals.ts` | Create (+ devaluation RPC) | Strong fingerprint parity | Medium code drift (4200/2020) | **Keep** |
| `saleEditAccounting` | In-place sale JE sync | SalesHome | Patch | Partial (missing 4120 / shared compute) | High COA hard-code (4000/4100) | **Keep**; document; later align |
| `purchaseEditAccounting` | In-place purchase JE rebuild | PurchaseModule | Patch | Partial (no tax/clearance) | Medium (2000/2100) | **Keep**; document |
| `studioFinalizeAfterInvoice` | Stage cost + sale GL RPC | studioInvoiceLine, studio.ts | Create + RPC | Mostly aligned | Medium duplicate finalize race | **Keep** |
| `shipmentAccounting` | Wrapper for `post_sale_shipment_journal` | ShipmentModal, sync | Create (RPC) | Divergent (RPC 1100 vs web sub-ledger) | Low on mobile | **Keep**; document gap |
| `expenseAccountingPatch` | Expense JE patch | expenses.ts | Patch | Claimed ExpenseContext parity | Low | **Keep** |

## Account codes (requested)

| Code | In helpers? | Notes |
|------|-------------|-------|
| 1100 | Yes | Sale edit AR control; shipment RPC; rental guard |
| 1180 | No (helpers) | Worker GL paths elsewhere |
| 2000 | Yes | Purchase AP primary |
| 2010 | Yes | Studio worker payable |
| 2100 | Yes | Purchase AP fallback |
| 4000 | Yes | Sale merchandise revenue primary |
| 4100 | Yes | Sale merchandise revenue fallback — **not reclassified** |

## Obsolete

- `resolveRentalExpenseAccountId` — zero callers; **document only**; do **not** delete (R8-R2 gated).
