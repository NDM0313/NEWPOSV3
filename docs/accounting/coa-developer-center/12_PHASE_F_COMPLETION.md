# Phase F — Controlled Repair Actions (completion)

**Status:** Complete (2026-06-06)  
**Commit:** `feat(accounting): add controlled developer repair actions`

---

## Summary

Phase F adds a **repair action registry**, **confirm-gated apply flow**, **developer_repair_audit** table, and **Repair Queue** integration across safe Developer Center tabs.

| Step | Deliverable | Status |
|------|-------------|--------|
| F1 | Registry + audit migration + sequence sync in registry | Done |
| F2 | COA safe display edits (rename, description, toggle active) | Done |
| F3 | Payment/JE metadata repairs + relink RPC | Done |
| F4 | Roznamcha repair candidates → queue | Done |
| F5 | Opening balance apply (missing JE, adjustment, orphan review) | Done |
| F7 | Trace tab queue wiring (COA, Roznamcha, OB, Payment, Transaction, Repair Queue) | Done |
| F9 | Unit tests (62+ cases) | Done |
| F10 | Docs 09–11 + README | Done |

---

## Repair actions (12)

See [09_CONTROLLED_REPAIR_ACTIONS.md](09_CONTROLLED_REPAIR_ACTIONS.md) for full catalog.

---

## Apply gate

- **Dry-run required** before every apply
- **Confirm phrase** exact match
- **Roles:** super-admin / developer only (`canApplyDeveloperRepair`)
- **Audit:** success and failure rows in `developer_repair_audit`

---

## Migrations (apply on Supabase before production apply)

1. `migrations/20260606120000_developer_repair_audit.sql`
2. `migrations/20260606130000_developer_repair_relink_payment_je.sql`

---

## Safety confirmations

- No GL posting rule changes
- No generic SQL editor
- No blind mass updates
- No delete/void/existing JE amount edit actions
- No fake Roznamcha cash movement from Developer Center

---

## Manual checklist

1. Apply both migrations on target Supabase project
2. Repair Queue → numbering out-of-sync → dry-run → phrase → apply
3. COA Health → account usage → queue rename → dry-run → apply
4. Transaction / Payment Trace → repair candidates → Send to queue → dry-run
5. Roznamcha Trace → missing payment_account_id candidate → queue
6. Opening Balance → missing_je → queue with effective date
7. Audit Log → verify `developer_repair` source rows after apply
