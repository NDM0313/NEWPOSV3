# Phase D — Repair Queue (dry-run + confirm-gated sequence sync)

**Status:** Complete (2026-06-06)  
**Scope:** Developer Center Repair Queue tab — previews only for Integrity Lab issues; one gated write path for document sequence sync.

---

## Summary

Phase D adds the **Repair Queue** tab to Accounting Developer Center (`?tab=repair`).

| Layer | Deliverable |
|-------|-------------|
| **D — Dry-run** | Integrity Lab issue previews + numbering sequence analysis |
| **E — Gated apply** | Single action: sync `erp_document_sequences` to effective max (never decreases) |

All other repairs remain in **Developer Integrity Lab**. No void, OB sync, GL amount changes, or blind reference rewrites.

---

## Files added / updated

| File | Purpose |
|------|---------|
| `src/app/lib/repairQueueDryRun.ts` | Dry-run preview helpers + confirm phrase gate |
| `src/app/lib/repairQueueDryRun.test.ts` | Unit tests |
| `src/app/components/admin/developer-center/RepairQueueTab.tsx` | UI: issue previews, numbering table, Phase E sync panel |
| `src/app/services/accountingDeveloperCenterService.ts` | `loadRepairQueueSnapshot`, `applySafeSequenceSync` |
| `src/app/services/numberingMaintenanceService.ts` | `effective_max` on analyze rows; `syncToEffectiveMax()` |
| `src/app/lib/accountingDeveloperCenterTabs.ts` | `repair` tab slug; Repair Queue removed from disabled list |
| `src/app/components/admin/AccountingDeveloperCenterPage.tsx` | Repair Queue tab wired |

---

## Safety boundaries

### Allowed in Phase D/E

- Read `integrity_lab_issues` via `listIntegrityIssues` (preview mapping only)
- Read numbering analysis via `numberingMaintenanceService.analyze`
- **Apply:** `syncToEffectiveMax` → updates `erp_document_sequences.last_number` only when DB max > counter

### Not imported / not exposed

- `integrityRepairService`
- `postingDuplicateRepairService`
- `liveDataRepairService` apply paths
- Void, OB sync, journal delete, amount edits

### Apply gate (Phase E in UI)

1. Role: super-admin, superadmin, super_admin, or developer
2. User selects an **out_of_sync** document type row
3. Typed confirm phrase: `SYNC-SEQUENCE-TO-EFFECTIVE-MAX`
4. Button: **Apply sequence sync**

---

## Verification

```bash
npm run test:unit   # includes repairQueueDryRun.test.ts
npm run build
```

Manual:

1. Open Developer Center → **Repair Queue**
2. Confirm Integrity Lab issues show as read-only previews (no apply per issue)
3. Confirm numbering table shows ok / out_of_sync
4. Select out-of-sync row → enter confirm phrase → apply (super-admin only)

---

## Related docs

- [03_DEVELOPER_CENTER_SPEC.md](./03_DEVELOPER_CENTER_SPEC.md) — Tab 9 Repair Queue spec
- [06_PHASE_C_COMPLETION.md](./06_PHASE_C_COMPLETION.md) — Phase C baseline
