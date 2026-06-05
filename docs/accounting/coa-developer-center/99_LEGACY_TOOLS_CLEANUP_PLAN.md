# Legacy tools cleanup plan (Phase 11)

**Status:** Planning document — execute only after Phase E repairs are validated in production.  
**Rule:** No file deletion until replacement route exists, imports are zero, and `npm run build` passes.

---

## Keep (business / ops)

| Tool | Path | Action |
|------|------|--------|
| AR/AP Reconciliation Center | `src/app/components/accounting/ArApReconciliationCenterPage.tsx` | **Keep** — ops-facing |
| Numbering Maintenance | `src/app/components/settings/NumberingMaintenanceTable.tsx` | **Keep** — link from Developer Center Repair Queue |
| Settings System Health | `SettingsPageNew.tsx` → System Health | **Keep** |

---

## Improve → fold into Developer Center

| Tool | Path | Replacement tab | Action |
|------|------|-----------------|--------|
| Developer Integrity Lab (read paths) | `DeveloperIntegrityLabPage.tsx` | COA Health, Transaction Trace, Journal Integrity | **Keep writes** in Lab; redirect read-only trace to Developer Center |
| AR/AP Truth Lab | `ArApTruthLabPage.tsx` | Statement Trace, Payment Trace | **Archive route** after parity verified |
| Accounting Integrity Test Lab | `AccountingIntegrityTestLab.tsx` | Journal Integrity browse | Hide dashboard tab link when DC parity confirmed |
| Accounting Edit Trace | `AccountingEditTracePage.tsx` | Transaction Trace | Redirect |

---

## Archive (hide nav, keep routes)

| Tool | Path | Rationale |
|------|------|-----------|
| Accounting Test Bench alias | duplicate of Dev Lab | Redirect to `/admin/accounting-developer-center` |
| Layout/design test pages (19+) | `src/app/components/test/*` | Certification only — remove from Sidebar |
| `accounting/` root prototype (8 files) | unwired | Move to `archive/accounting-prototype/` when imports confirmed zero |
| Accounting Test Page (creates JEs) | high risk | **Disable route** in production builds |

---

## Document only — never UI

| Item | Path |
|------|------|
| ERP mega-repair | `ERP_DATA_REPAIR_SCRIPT.sql` |
| Company reset RPCs | migrations referencing reset |
| One-off SQL fixes | `scripts/oneoff/fix_je_*.sql` |

---

## Deprecation sequence (per tool)

1. Add Developer Center tab with parity checklist (see `05_PHASE_C_IMPLEMENTATION_PLAN.md`).
2. Add redirect banner on legacy page → Developer Center deep link.
3. Remove Sidebar / Settings nav entry.
4. Grep repo for imports; zero remaining callers.
5. Delete or move to `archive/` in a dedicated PR.
6. Update `00_EXISTING_TOOLS_AUDIT.md` verdict to **archived**.

---

## Verification before any deletion

- [ ] `npm run test:unit` pass
- [ ] `npm run build` pass
- [ ] No imports of archived component from `src/app/App.tsx`
- [ ] Developer Center access smoke (`accountingDeveloperCenterAccess.test.ts`)
- [ ] User sign-off on redirect URLs
