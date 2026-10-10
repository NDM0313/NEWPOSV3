# Phase 5 partial — Flutter ERP mobile

**Status:** Edit flows, returns/cancels, offline awareness (banner).

## Added

| Feature | Route / UI |
|---------|------------|
| Contact edit | `/contacts/:id/edit` |
| Product edit | `/products/:id/edit` |
| Sale return | `/sales/:id/return` → `finalize_sale_return` |
| Purchase cancel | Purchase detail → `cancel_purchase_full_void` |
| Offline banner | All `ModuleScaffold` screens via `connectivity_plus` |

## Dependencies

- `connectivity_plus` — network status stream (full Drift outbox still future)

## Still future (Phase 5–6)

- Drift local DB + mutation outbox + sync engine parity
- List read-through cache offline
- Printing, barcode scan, studio/rental writes
