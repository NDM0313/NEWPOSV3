# Shipment / Courier Accounting Classification

**Company:** eb71d817-b87e-4195-964b-7b5321b480f5  
**Purpose:** Classify courier/shipment tables and accounts. No destructive changes; canonicalize and mark legacy.

## Canonical structure

- **Courier Payable Control:** Parent account (e.g. code 2030). One canonical parent per company.
- **Child courier accounts:** DHL, TCS, etc. under parent (e.g. 2031, 2032, …). Used for posting; should not clutter top-level Chart of Accounts (handled by "Professional" view with "Show sub-accounts" off by default).
- **Posting/reporting:** Use `accounts` (parent + children) and journal_entry_lines. Shipment/courier payment flow uses `shipmentAccountingService` / courier_payment reference_type where applicable.

## Tables / objects (classification)

| Object | Role | Classification |
|--------|------|-----------------|
| `accounts` (parent 2030, children 2031…) | Chart of Accounts; courier payable hierarchy | **CANONICAL** |
| `journal_entries` / `journal_entry_lines` | All posting including courier | **CANONICAL** |
| `payments` (reference_type courier_payment / shipment) | Payment records | **CANONICAL** |
| `shipmentAccountingService` | Courier payment posting | **CANONICAL** (service) |
| Any `*_shipment*` / `*_courier*` tables in DB | Audit via `docs/audit/shipment_courier_overlap_audit.sql` | **SUPPORTING** or **LEGACY_CANDIDATE** – do not drop; identify and freeze if duplicate |

## Chart of Accounts behavior

- **Professional view:** Shows only top-level accounts by default (no child courier clutter).
- **Show sub-accounts:** Checkbox to include child accounts (e.g. DHL, TCS) for posting/ledger.
- Courier child accounts remain available for posting and reporting; they are grouped under parent 2030 in hierarchy.

## Next steps (if needed)

- Run `docs/audit/shipment_courier_overlap_audit.sql` to list tables with shipment/courier in name.
- Mark any duplicate/legacy tables as LEGACY_CANDIDATE in this doc after audit.
- Do not drop tables in this phase.
