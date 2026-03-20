# Posting + stock + COA certification phase

## Root cause: `DRAFT-0002` + document JE

`createSaleJournalEntry` logged success when **`sales.status` was `final`** but **`invoice_no` stayed on a draft/quotation/order series** (e.g. `DRAFT-0002`). That happens when status is advanced to Final without allocating a new **SL-** number.

## Fixes (app)

- **Hard gate** (`postingStatusGate` + `assertSaleEligibleForDocumentJournal`): block canonical document JEs if invoice matches non-posted series: `DRAFT-`, `QT-`, `SO-`, `SDR-`, `SQT-`, `SOR-`.
- **Purchase**: block canonical document JE if `po_no` is `PDR-` or `POR-` when status is posted (must use **PUR-** for posted docs).
- **Sales create**: `status` aligned to `docType` so draft/quotation/order rows are not mixed with `final` via `type` fallback.
- **Numbering**: drafts use **SDR/SQT/SOR** global sequences; purchases use **PDR/POR/PUR** (not `generate_document_number('purchase')` alone).
- **Negative stock**: `getAllowNegativeStock` no longer defaults to “allow” when no settings row; default **`false`**. `ensureDefaultInventorySettings` + migration backfill `inventory_settings`.
- **Payments**: `recordSalePayment` and `updateSale` payment sync skip non-final; `saleService.recordPayment` already enforced.

## SQL

- `migrations/20260322_certification_phase_numbering_inventory_gate.sql` — `get_next_document_number_global` prefixes + default `inventory_settings`.

## Integrity Lab

- **Fresh posting gate**: fails if posted sale/purchase uses wrong invoice/PO series.
- **Section 2 — Module certification**: stock / COA balance / payment isolation (+ worker/studio placeholder).

Company-wide reconciliation remains **secondary** (legacy-aware).
