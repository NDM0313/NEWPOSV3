# Final Duplicate Classification (Real Schema)

Company: `eb71d817-b87e-4195-964b-7b5321b480f5`

Schema facts: `accounts.type`; `ledger_master.entity_id`, `entity_name`; `payments.contact_id` for supplier visibility; `ledger_entries.reference_id` = payment_id or purchase_id; courier_ledger/shipment_ledger are VIEWs; erp_document_sequences is canonical for numbering.

| object_name | actual_role | status | real_problem | recommended_action |
|-------------|-------------|--------|--------------|---------------------|
| accounts | Live Chart of Accounts; posting target | CANONICAL | Duplicate normalized names (AR, Bank) existed | Applied: canonical chosen, jel repointed, duplicates marked inactive |
| chart_accounts | Legacy COA | LEGACY_CANDIDATE | Replaced by accounts; not used for posting | Do not use for new posting; freeze |
| account_transactions | Legacy transaction log | LEGACY_CANDIDATE | Not double-entry; not used for live posting | Freeze; do not use for new posting |
| journal_entries | Double-entry headers | CANONICAL | — | Keep |
| journal_entry_lines | Double-entry lines; account_id → accounts | CANONICAL | — | Keep |
| payments | Roznamcha; contact_id for supplier ledger | CANONICAL | Historical NULL contact_id for some supplier payments | Backfill from purchase/ledger; read adapter accepts ledger payment refs |
| ledger_master | Supplier/user ledger header; entity_id = contact id | CANONICAL | — | Keep; use entity_id only |
| ledger_entries | Ledger rows; reference_id = payment_id or purchase_id | CANONICAL | — | Keep |
| worker_ledger_entries | Worker jobs + payments | CANONICAL | — | Keep |
| erp_document_sequences | Document numbering (PAY, JE, etc.) | CANONICAL | — | Use for all new PAY; generate_document_number RPC |
| document_sequences | Legacy numbering | LEGACY_CANDIDATE | Still used by credit notes, refunds, returns | Freeze for PAY; do not use for new payment flows |
| document_sequences_global | Legacy global numbering | LEGACY_CANDIDATE | — | Do not use for new PAY |
| couriers | Courier master | CANONICAL | 0 duplicate names for this company | Keep; dedupe script available for other companies |
| courier_shipments | Links shipment to courier | CANONICAL | — | Keep |
| courier_ledger | VIEW | SUPPORTING | Reporting only | Keep as view |
| courier_summary | VIEW | SUPPORTING | Reporting only | Keep as view |
| shipment_ledger | VIEW | SUPPORTING | Reporting only | Keep as view |

## Actual duplicate data (audit results)

- **accounts:** 2 groups — "accounts receivable" (2), "bank" (2). **Handled:** canonical chosen (prefer code 1100/1010), journal_entry_lines repointed, duplicate accounts set is_active = false. Remaining duplicate name groups (active): 0.
- **couriers:** 0 duplicate normalized names.
- **Supplier payments with NULL contact_id:** 0 (posting sets it; backfill from purchase run). Ledger entries with payment missing contact_id: 2 (read path includes them via ledger payment refs).
- **Ledger linkage:** reference_id may be payment_id or purchase_id; adapter supports both and includes payment refs present in this ledger.
