# ERP Legacy Structure Notes

**Date:** 2026-03-13  
**Purpose:** Document legacy structures so future work and AI prompts avoid confusion. **Do not drop or remove these tables** in this phase.

---

## Tables marked as legacy (documentation)

### sale_items

- **Role:** Legacy / fallback sale line table.
- **Canonical alternative:** `sales_items` (app writes and prefers reads here).
- **Why keep:** Triggers (`trigger_calculate_sale_totals`) and RLS exist on `sale_items`; some deployments may still have data or FKs (e.g. `sale_return_items.sale_item_id`) pointing here. Reporting and app code use **sales_items first, sale_items fallback**.
- **Action:** None. Do not drop. Prefer `sales_items` in new code.

### chart_accounts

- **Role:** Legacy chart of accounts (posting path).
- **Canonical alternative:** `accounts` (used by `journal_entry_lines`, accountingService, chartAccountService via accountService).
- **Why keep:** May exist from older migrations (e.g. 16_chart_of_accounts); no application code posts to it. Kept to avoid breaking any unknown consumers or future reference.
- **Action:** None. Do not drop. All posting uses `accounts` + `journal_entries` + `journal_entry_lines`.

### document_sequences

- **Role:** Legacy document numbering.
- **Canonical alternative:** `erp_document_sequences` (company/branch scoped; used by Settings and numbering maintenance).
- **Why keep:** Still used by creditNoteService, refundService, purchaseReturnService, saleReturnService until those are migrated to `erp_document_sequences`.
- **Action:** None. Do not drop. New numbering should use `erp_document_sequences`; migrate legacy callers when ready.

---

## Structures to keep active (not legacy)

- **ledger_master** / **ledger_entries** — Subsidiary ledgers for supplier/user. Not a duplicate of journal; keep.
- **worker_ledger_entries** — Studio worker ledger; keep.
- **studio_production_orders_v2**, **studio_production_stages_v2**, **studio_stage_assignments_v2**, **studio_stage_receipts_v2** — Optional (feature-flag); keep.
- **studio_production_orders_v3**, **studio_production_stages_v3**, **studio_production_cost_breakdown_v3** — Optional (feature-flag); keep.

---

## Optional DB comments (safe to run)

To mark legacy tables in the database (optional, run only if desired):

```sql
COMMENT ON TABLE sale_items IS 'LEGACY: Prefer sales_items for new code. Fallback for reads; triggers/RLS here. Do not drop.';
COMMENT ON TABLE chart_accounts IS 'LEGACY: Posting uses accounts + journal_entries + journal_entry_lines. Not used by app. Do not drop.';
COMMENT ON TABLE document_sequences IS 'LEGACY: Prefer erp_document_sequences. Still used by credit notes, refunds, returns until migrated. Do not drop.';
```

These are documentation only; they do not change behavior.
