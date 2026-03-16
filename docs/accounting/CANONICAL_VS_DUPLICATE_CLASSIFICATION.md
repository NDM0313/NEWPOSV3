# Canonical vs Duplicate Classification (Real Schema)

Company: `eb71d817-b87e-4195-964b-7b5321b480f5`

Schema facts: `accounts.type` (not account_type); `ledger_master.entity_id`, `entity_name` (not contact_id); `payments.contact_id` critical for supplier ledger; courier_ledger / courier_summary / shipment_ledger are VIEWs.

| object_name | actual_role | status | why_it_conflicts_or_not | recommended_action |
|-------------|-------------|--------|--------------------------|--------------------|
| accounts | Live Chart of Accounts; posting target for JEs | CANONICAL | Single source for COA; has `type`, `parent_id` | Keep; use `type` in code |
| chart_accounts | Legacy COA from 16_chart_of_accounts | LEGACY_CANDIDATE | Replaced by `accounts`; not used for posting | Do not use for new posting; freeze |
| account_transactions | Legacy transaction log | LEGACY_CANDIDATE | Not double-entry; not used for live posting | Do not use for new posting; freeze |
| journal_entries | Double-entry headers; link to payments via payment_id | CANONICAL | Core posting | Keep |
| journal_entry_lines | Double-entry lines; account_id -> accounts | CANONICAL | Core posting | Keep |
| payments | Roznamcha source; contact_id for supplier visibility | CANONICAL | Must set contact_id for supplier payments | Keep; enforce contact_id on supplier paths |
| ledger_master | Supplier/User ledger header; entity_id = contact id | CANONICAL | entity_id, entity_name (not contact_id) | Keep |
| ledger_entries | Ledger rows; ledger_id -> ledger_master; reference_id = payment_id or purchase_id | CANONICAL | Supplier ledger read uses these | Keep; sync on supplier payment |
| worker_ledger_entries | Worker jobs + payments | CANONICAL | Studio worker ledger | Keep |
| erp_document_sequences | Document numbering (PAY, JE, etc.) | CANONICAL | Single source for PAY refs | Use for all new payment numbering |
| document_sequences | Legacy numbering | LEGACY_CANDIDATE | Still used by credit notes, refunds | Freeze for PAY; migrate when possible |
| document_sequences_global | Legacy global numbering | LEGACY_CANDIDATE | Prefer erp_document_sequences | Do not use for new PAY |
| couriers | Courier master; one per logical courier | CANONICAL | May have duplicate name rows | Dedupe by normalized name; repoint to canonical |
| courier_shipments | Links to courier + sale | CANONICAL | Uses courier_id | Repoint to canonical courier after dedupe |
| courier_ledger | VIEW | SUPPORTING | Reporting only | Keep as view |
| courier_summary | VIEW | SUPPORTING | Reporting only | Keep as view |
| shipment_ledger | VIEW | SUPPORTING | Reporting only | Keep as view |
