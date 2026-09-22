# Developer Repair Audit Log

Permanent audit trail for Phase F controlled repairs.

---

## Table: `developer_repair_audit`

Migration: [`migrations/20260606120000_developer_repair_audit.sql`](../../../migrations/20260606120000_developer_repair_audit.sql)

| Column | Purpose |
|--------|---------|
| `company_id` | Tenant scope |
| `user_id` | Actor (auth uid when available) |
| `action_id` | Registry action id |
| `risk_level` | low / medium / high |
| `target_table` | Primary table touched |
| `target_id` | Row id or logical key |
| `before_json` | Snapshot before apply |
| `after_json` | Preview or post-apply snapshot |
| `dry_run_hash` | Hash from dry-run |
| `confirm_phrase` | Typed phrase (logged) |
| `status` | `success` or `failed` |
| `error_message` | Failure reason when status=failed |

Every apply attempt writes a row (success or failure). No repair without audit.

---

## Read path

Developer Center **Audit Log** tab unions:

1. `party_repair_audit` (legacy row-level party fixes)
2. `developer_repair_audit` (Phase F repairs) — source `developer_repair`
3. Resolved `integrity_lab_issues`

Mapper: [`mapDeveloperRepairAuditRow`](../../../src/app/lib/developerCenterAuditLog.ts)

---

## Rollback notes

Repairs are metadata-only where possible. Rollback = manual revert using `before_json`:

- Sequence sync: restore `sequenceLast` on `erp_document_sequences`
- COA display fields: `accountService.updateAccount` from `before_json`
- Payment link: clear or restore `payment_id` / `journal_entry_id` from `before_json`
- Opening adjustment: void mistaken adjustment JE via Integrity Lab (no auto-delete in Developer Center)

No automated rollback runner in Phase F — audit is the source of truth for manual revert.
