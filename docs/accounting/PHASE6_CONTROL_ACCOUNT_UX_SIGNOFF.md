# Phase 6 — Control account breakdown UX signoff

## Intent

Control accounts (**1100 AR**, **2000 AP**, **2010 worker payable**, **1180 worker advance**, **1195 suspense**) expose a **drawer** with **one engine per metric**: GL, Operational, Reconciliation, or **Pending mapping** (no fake split).

## Implementation map

| Requested bucket | AR (1100) | AP (2000) | Worker payable (2010) | Worker advance (1180) |
|------------------|-----------|-----------|------------------------|------------------------|
| Customer / supplier / worker slice | Customer receivables (sales due, non-studio) | Supplier payables | Unpaid `worker_ledger_entries` + GL ref-type buckets | Advance-specific rows (see service notes) |
| Studio receivables | Studio receivables (invoice heuristic) | — | GL: `studio_production_stage` | — |
| Rental receivables | `rentals.due_amount` | — | — | — |
| Opening | `contacts.opening_balance` (customer/both) | — | — | — |
| Worker payable / advance | — | — | Party net **WP−WA** from RPC | Party note: net vs 1180-only |
| Other payables | — | Courier / other vendor (purchases due, supplier not in supplier/both) | — | — |
| Manual / unmatched | Explicit **Pending mapping** row (operational) | Same + courier bucket may be **Pending mapping** if `otherDue > 0` | GL “Other reference types” **Pending mapping** if non-zero | **Pending mapping** per service |
| Total operational | RPC sum `get_contact_balances_summary` | RPC sum payables | — | — |
| Party GL list | **GL** resolver RPC | **GL** resolver RPC | **GL** worker net | **GL** worker net |
| Residual | Reconciliation: control − party sum | AP net credit − party sum | Reconciliation row **Pending mapping** (by design) | Notes in service |

**Code:** `src/app/services/controlAccountBreakdownService.ts`, UI: `src/app/components/accounting/ControlAccountBreakdownDrawer.tsx`.

## UX signoff (post Phase 6 tighten)

| Check | Pass |
|-------|------|
| Sheet description states GL / Operational / Reconciliation / Pending mapping explicitly | ☐ |
| Subcategory rows each carry a source badge | ☐ |
| `Pending mapping` / `Unavailable` status badges visible when not `ok` | ☐ |
| Party list amounts show **GL** badge next to each figure | ☐ |
| Actions: GL ledger vs Contacts (operational) vs AR/AP center (reconciliation) are distinct | ☐ |
| No single “total” line mixes engines without label | ☐ |

## Known limitations (document, do not hide)

- **Manual / unmatched** operational rows are **intentionally** `pending_mapping` until policy splits them.
- **Studio** split uses invoice prefix heuristic (`STD-`, `ST-`, `STUDIO`) — may **pending_mapping** mis-classify edge cases.
- **Worker advance** per-party 1180-only split is not fully computed in drawer; statement + JEs remain canonical for detail.

## Signoff

- **UX acceptable for AR/AP/worker control drilldown:** ☐  
- **Date / build / commit:**  
- **Reviewer:**  
