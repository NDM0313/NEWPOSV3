# Phase F — Controlled Repair Actions

**Status:** Complete (2026-06-06)  
**Scope:** Confirm-gated, audited repairs inside Accounting Developer Center.

---

## Hard rules (enforced)

1. No generic SQL editor.
2. No blind mass updates.
3. No delete of journal entries, payments, rentals, sales, purchases, contacts, or accounts.
4. No debit/credit amount edits on existing JE lines (opening **adjustment** posts a **new** JE only).
5. No GL posting rule or void/reversal logic changes.
6. Every apply: detect → dry-run → before snapshot → after preview → confirm phrase → audit → result.

---

## Repair actions shipped

| Action ID | Risk | Apply roles |
|-----------|------|-------------|
| `numbering.sync_sequence_to_effective_max` | low | super-admin, developer |
| `coa.rename_account` | low | super-admin, developer |
| `coa.update_description` | low | super-admin, developer |
| `coa.toggle_active_if_safe` | low | super-admin, developer |
| `payment.relink_payment_to_journal` | medium | super-admin, developer |
| `payment.fill_payment_account_from_je` | medium | super-admin, developer |
| `payment.sync_branch_from_document` | medium | super-admin, developer |
| `rental.relink_rental_payment_to_journal` | medium | super-admin, developer |
| `opening.create_missing_je` | medium | super-admin, developer |
| `opening.create_adjustment_je` | high | super-admin, developer |
| `opening.orphan_je_review` | low | super-admin, developer (audit note only) |
| `roznamcha.report_duplicate_source` | low | super-admin, developer (info / audit) |

### Intentionally not added

- `coa.update_reporting_group` (no column; deferred per product decision)
- Generic SQL / bulk UPDATE scripts
- JE line amount edits, void, delete
- Fake Roznamcha cash rows (`ensurePaymentsForLiquidityJournal` not exposed)
- Integrity Lab bulk repair services wired directly

---

## UI entry points

| Tab | Behavior |
|-----|----------|
| Repair Queue | Host queue + numbering “Send to queue” |
| COA Health | Queue rename / description / active toggle |
| Roznamcha Trace | Send safe metadata candidates to queue |
| Opening Balance | Send missing JE / adjustment / orphan review to queue |

Admin and accounting_auditor: **dry-run and view only**. Apply requires super-admin or developer.

---

## Files

| Area | Path |
|------|------|
| Registry | `src/app/lib/developerRepairActions.ts` |
| Orchestrator | `src/app/services/developerRepairService.ts` |
| Shared panel | `src/app/components/admin/developer-center/RepairActionPanel.tsx` |
| Queue context | `src/app/components/admin/developer-center/RepairQueueContext.tsx` |
| Audit migration | `migrations/20260606120000_developer_repair_audit.sql` |
| Payment relink RPC | `migrations/20260606130000_developer_repair_relink_payment_je.sql` |

See also [10_REPAIR_ACTION_REGISTRY.md](10_REPAIR_ACTION_REGISTRY.md) and [11_REPAIR_AUDIT_LOG.md](11_REPAIR_AUDIT_LOG.md).
