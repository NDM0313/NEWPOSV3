# Phase 8 — Legacy retirement map (no deletes yet)

## Principles

- **Do not drop tables** or remove read paths until dependents are retired and signoff is recorded.
- **Operational** truth may still legitimately come from **document tables** and RPCs — not “legacy” by definition.
- **GL** truth stays **journal_entries** / **journal_entry_lines** (+ controlled RPCs such as `get_contact_party_gl_balances`).

## Active legacy or dual-path reads (inventory)

| Path / table | Used for | Classification | Retirement |
|--------------|----------|----------------|------------|
| `ledger_master` / `ledger_entries` | Supplier (and some) UI subledgers, courier traces | **legacy_ui_subledger** — not GL TB | Archive UI flows only after journal-first parity; see `accountingCanonicalGuard.NON_GL_LEDGER_TABLES` |
| `chart_accounts` | Old schema / migrations | **legacy** | Safe to archive only if zero runtime reads (verify grep) |
| `sale_items` vs `sales_items` | Line items | **fallback** in reports | Retire when all companies migrated to canonical table |
| `worker_ledger_entries` (studio) | Operational worker balance when journal missing | **operational / fallback** | Retire when 2010/1180 + stage JEs always cover same facts |
| `document_sequences` fallback | Numbering | **fallback** | Retire after `get_next_document_number_global` + settings unified |
| `settings` key `allow_negative_stock` | Stock policy | **legacy bridge** | Retire after `inventory_settings` backfill everywhere |
| `getCustomerLedger` synthetic merge | Customer ledger when journal thin | **hybrid operational + GL** | Keep until open-doc and journal always aligned; then narrow scope |
| Realtime subscriptions | Various | N/A | Not accounting source |
| Integrity Lab “ignored” rules | Noise reduction | **policy** | Not legacy — document only |

## Screens still touching non-GL ledgers (examples)

- **Supplier manual payment** path may sync **ledger_entries** (`AccountingContext` supplier ledger block).
- **Courier** components may resolve via **contact_id** + legacy courier balance (`CourierReportsTab` comments).
- **Studio costs** — journal-first with **fallback** to `worker_ledger_entries` (`studioCostsService.ts`).

## Safe to archive later (conditions)

| Item | Condition |
|------|-----------|
| Duplicate COA table reads | App uses only `accounts` for posting and reports |
| `sale_items` | No rows / no code path selects it in production |
| Supplier **ledger_entries** mirror | Every supplier movement has matching **payment** / **purchase** JE + `payments.contact_id` |
| Legacy negative-stock setting | `inventory_settings` row exists for all companies |

## Blocked by dependency

| Item | Blocker |
|------|---------|
| Remove `ledger_entries` writes | Journal + payments + Contacts operational must replace Roznamcha parity for each workflow |
| Single “ledger” API for customers | `getCustomerLedger` consumers (statement tabs) must accept journal-only or labeled hybrid |
| Retire worker_ledger operational | Studio billing + payment must post to 2010/1180 with worker attribution |

## Still canonical (operational only)

- `get_contact_balances_summary` — Contacts / operational columns.
- `sales` / `purchases` / `rentals` **due** fields — open document engine.
- `payments` — cash movement and link to `journal_entries.payment_id`.

## Suggested retirement order (after Phase 5–7 signoff)

1. **Payment JE linkage** — finish Phase 4 APPLY on all tenants; verify Integrity Lab payment checks.
2. **Supplier ledger mirror** — stop **writing** `ledger_entries` when journal + `payments` cover the same event (feature flag per company).
3. **Customer ledger synthetic** — reduce merge paths; prefer journal lines + explicit operational tab.
4. **Worker ledger fallback** — journal-first studio; shrink `worker_ledger_entries` to pre-GL staging only if needed.
5. **chart_accounts / sale_items** — schema migration + one-time data move.
6. **Legacy settings keys** — remove reads after inventory migration confirmed.

## Signoff gate

- **Phase 5 real party:** complete  
- **Phase 7 worker:** complete  
- **No P0 Integrity Lab regressions** after each cutover step  

**Owner / date:**  
