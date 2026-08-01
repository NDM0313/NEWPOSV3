# Phase D + E — Developer Center completion (2026-06-06)

**Status:** Complete locally  
**Route:** `/admin/accounting-developer-center`

---

## Tab matrix (all implemented)

| Tab | Slug | Phase | Write? |
|-----|------|-------|--------|
| COA Health | `coa` | B | No |
| Transaction Trace | `trace` | B | No |
| Roznamcha Trace | `roznamcha` | C2 | No |
| Statement Trace | `statement` | C3 | No |
| Day Book | `daybook` | C4 | No |
| Payment Trace | `payment` | C5 | No |
| Journal Integrity | `journal` | C6 | No (browse-only) |
| **Repair Queue** | `repair` | **D** | Dry-run + **one gated sequence sync** |
| **Opening Balance** | `opening` | **E** | **Preview only** |
| **Audit Log** | `audit` | **E** | **Read-only** |

---

## Phase D — Repair Queue

- Integrity Lab issue dry-run previews
- Numbering `analyze` dry-run table
- **Apply (Phase E gate in UI):** `syncToEffectiveMax` on `erp_document_sequences` only
- Confirm phrase: `SYNC-SEQUENCE-TO-EFFECTIVE-MAX`
- Roles: super-admin / developer

See [07_PHASE_D_COMPLETION.md](./07_PHASE_D_COMPLETION.md).

---

## Phase E — Opening Balance + Audit Log

### Opening Balance Tools (`?tab=opening&q=`)

- Scans contacts for AR/AP opening legs
- Compares operational `opening_balance` / `supplier_opening_balance` vs active opening JE
- Status: `synced` | `missing_je` | `amount_mismatch` | `orphan_je`
- **No apply button** — sync via Developer Integrity Lab / `openingBalanceJournalService`

### Audit Log (`?tab=audit`)

- Reads `party_repair_audit` (if migration applied)
- Merges resolved `integrity_lab_issues` rows
- Date range filter, read-only table

---

## Verification

```bash
npm run test:unit   # 48/48 pass (after Phase D+E)
npm run build
```

Deep links:

```
?tab=repair
?tab=opening&q=Customer
?tab=audit
```

---

## Out of scope (by design)

- OB sync apply from Developer Center
- Void / JE amount edits / mass reference rewrite
- `developer_repair_plans` migration
- Unified `v_developer_center_audit_log` RPC (client-side union for now)
- Safe COA inline edit in COA Health tab

---

## Related

- [06_PHASE_C_COMPLETION.md](./06_PHASE_C_COMPLETION.md)
- [07_PHASE_D_COMPLETION.md](./07_PHASE_D_COMPLETION.md)
- [03_DEVELOPER_CENTER_SPEC.md](./03_DEVELOPER_CENTER_SPEC.md)
