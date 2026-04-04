# Accounting workbench — click / drill-down matrix

**Date:** 2026-04-05  
**Scope:** What row actions open which surfaces (runtime, canonical data).

---

## 1. Global event

| Event | Payload | Handler |
|-------|---------|---------|
| `openTransactionDetail` | `{ referenceNumber, autoLaunchUnifiedEdit? }` | `AccountingDashboard` → `TransactionDetailModal` |

`referenceNumber` may be **UUID** (`journal_entries.id`), **entry_no** (`JE-…`), or other reference string per `TransactionDetailModal` load order.

---

## 2. Account Statements (`AccountLedgerReportPage`)

| Control | Behavior |
|---------|----------|
| **Reference** (link) | View — `openTransactionDetail` with `entry_no` if present else `journal_entry_id`, **no** auto-edit |
| **View** | Same as reference link |
| **Edit** | `openTransactionDetail` with `journal_entry_id`, `autoLaunchUnifiedEdit: true` |
| Opening / synthetic rows (no `journal_entry_id`) | Actions show **—** |

**Not wired in this pass:** direct “Open sale / purchase / payment document” from statement row (use Transaction Detail links inside modal where available).

---

## 3. Journal Entries table (`AccountingDashboard`)

| Control | Behavior |
|---------|----------|
| **Row click** | Opens detail with `referenceNo` (or fallback), grouped entries when grouped mode |
| **Reference** button | Same |
| **View** (actions) | Detail open, **no** auto-edit; grouped entries preserved when grouped |
| **Edit** | Detail + unified editor; uses `entry.id` (UUID) |
| **Reverse** | `createReversalEntry` |

---

## 4. COA hierarchy (`AccountsHierarchyList`)

| Element | Behavior |
|---------|----------|
| Row menus / drawers | Per `AccountingDashboardAccountRowMenu` / account edit flows |
| Balance footnote (parent rows) | Explains **roll-up** (own GL + children) — see `COA_WORKING_SIGNOFF` / gap analysis |

---

## 5. Party ledger hub (`LedgerHub` / `GenericLedgerView`)

Existing behavior unchanged in this pass; worker path may use **`worker_ledger_entries`** for operational subledger — distinct from **Worker Statement** (WP/WA GL) in `AccountLedgerReportPage`.

---

## 6. Remaining / follow-ups

- Unified **“Open source document”** from statement rows (sale_id, purchase_id, payment_id) — product priority.  
- **Payment-only** drill from GL line without loading full JE — optional.  

**Batch 5:** NOT APPROVED.
