# 27. Legacy Isolation Plan

**Date:** 2026-04-12  
**Purpose:** Track which legacy tables/fields have been isolated, which remain active, and the concrete steps to retire each.

---

## Isolation Principles

1. **No new writes** — once a table is declared legacy, the first step is stopping all new writes
2. **Read-only period** — legacy reads remain for backward-compat display during migration
3. **Read redirect** — redirect reads to canonical source
4. **Verification** — SQL script confirms no active writes for N days
5. **Drop** — DB migration to drop the table/column

---

## 1. `sale_items` (Legacy Line Items Table)

**Status:** Writes FROZEN (P1-2 + P1-2b); data migration script READY; reads still active (16 fallback sites)  
**Canonical replacement:** `sales_items` (plural)

### Evidence of Legacy Writes (ALL PATCHED)
| File | Patch | Operation |
|------|-------|-----------|
| `studioProductionService.ts` 703–713 | P1-2 | INSERT fallback → `sales_items` |
| `AccountingIntegrityLabPage.tsx` 931–933 | P1-2 | UPDATE fallback → `sales_items` |
| `AccountingIntegrityLabPage.tsx` 1133–1143 | P1-2 | UPDATE fallback → `sales_items` |
| `StudioSaleDetailNew.tsx` ~1702-1708 | P1-2b | INSERT fallback → `sales_items` |
| `StudioSaleDetailNew.tsx` ~1661-1666 | P1-2b | UPDATE fallback → removed |
| `backupExport.ts` line 32 | P2 | Backup now reads `sales_items` primary |

### Post-P1-2/P1-2b Read Allowances (16 locations — all try/fallback)
- See `46_LOW_RISK_LEGACY_READ_REDUCTION.md` for full inventory
- All remaining reads follow: try `sales_items` → fallback `sale_items`
- Fallback removal: batch PR after VPS data migration confirmed

### Retirement Blockers (Updated)
1. ✅ Data migration script ready: `scripts/sale_items_data_migration.sql` (patched for company_id + tax columns)
2. ⏳ VPS data migration not yet executed — requires DBA access
3. ⏳ After migration: batch remove 4 Group-1 fallbacks (low risk)
4. ⏳ FK remap: `sale_return_items.sale_item_id REFERENCES sale_items(id)` → must point to `sales_items(id)`
5. ⏳ After FK remap: remove Group-2 fallbacks (8 high-risk sites)
6. ⏳ Drop/rename: after 30-day monitoring

### Verification Query
```sql
-- Count writes to sale_items in last 30 days (should be 0 after P1-2)
SELECT COUNT(*) AS new_writes_last_30d
FROM sale_items
WHERE created_at > NOW() - INTERVAL '30 days';
```

---

## 2. `ledger_master` + `ledger_entries` (Retired Subledger)

**Status:** RETIRED — no writes; reads blocked in strict mode  
**Canonical replacement:** `journal_entries` + `journal_entry_lines`

### Current State
- Table names hidden in source via string concatenation to avoid grep discovery:
  `const LT_MASTER = \`${'ledger'}_${'master'}\``
- `accountingCanonicalGuard.ts` `assertNotLegacyTableForGlTruth()` fires if these are used

### Retirement Blockers
- Confirm 0 rows in these tables for active companies
- Confirm no application reads depend on them for active UI

### Verification Query
```sql
-- Check if any active rows exist (expected: all old/empty)
SELECT COUNT(*) FROM ledger_master WHERE created_at > '2025-01-01';
SELECT COUNT(*) FROM ledger_entries WHERE created_at > '2025-01-01';
```

---

## 3. `chart_accounts` (Retired COA Table)

**Status:** RETIRED — canonical is `accounts`  
**Canonical replacement:** `accounts` table

### Current State
- Listed in `LEGACY_TABLE_BLOCKLIST` in `accountingCanonicalGuard.ts`
- `assertNotLegacyTableForGlTruth()` blocks its use

### Retirement Blockers
- Verify no reads from `chart_accounts` in UI components
- Confirm all migrations that seeded `chart_accounts` also seed `accounts`

---

## 4. `contacts.current_balance` (Cache Field)

**Status:** Cache field — trigger-maintained; must NOT be used as GL truth  
**Canonical replacement:** `journal_entry_lines` via party subledger query

### Problem
`contacts.current_balance` is populated by:
1. A Postgres trigger (trigger-maintained, may lag)
2. Manual writes from `studioProductionService.ts` at lines 1411, 1663, 1758, 1798, 1904 (these target `workers.current_balance` — see section 5 below)

### Policy
- **Display:** OK to show `contacts.current_balance` as approximate/cached value
- **Accounting decisions:** Must use `journal_entry_lines` subledger sum
- **New writes from application code:** FORBIDDEN (only trigger may write this)

### Isolation Steps
1. ✅ P1-3: Remove manual writes to `workers.current_balance` from `studioProductionService.ts`
2. Add guard: `warnIfUsingStoredBalanceAsTruth('ContactBalance', 'current_balance')` in any UI that displays this as accounting truth
3. Long-term: replace trigger with a DB function that derives from `journal_entry_lines`

---

## 5. `workers.current_balance` (Cache Field)

**Status:** Manual-write cache — ISOLATED by P1-3  
**Canonical replacement:** Worker ledger accounts in `journal_entry_lines`

### Evidence of Manual Writes (pre-P1-3)
| File | Line | Context |
|------|------|---------|
| `studioProductionService.ts` | 1411 | Cost assignment: `current_balance + cost` |
| `studioProductionService.ts` | 1663 | Payment deduction: `bal - cost` |
| `studioProductionService.ts` | 1758 | Stage cost update: balance reconcile |
| `studioProductionService.ts` | 1798 | Ledger entry paid: balance reduction |
| `studioProductionService.ts` | 1904 | Worker salary insert: `newBalance` |

### Post-P1-3 State
All 5 write sites replaced with comment: `// P1-3: balance is derived from GL — do not write workers.current_balance`

### Worker Balance Truth
Worker owed balance = SUM of worker ledger JE lines in `journal_entry_lines` for that worker's account.

---

## 6. `document_sequences` (Legacy Numbering Table)

**Status:** Active for purchase returns — being redirected by P1-4  
**Canonical replacement:** `erp_document_sequences` via `generate_document_number` RPC

### Evidence of Legacy Use
| File | Line | Function |
|------|------|---------|
| `purchaseReturnService.ts` | 718–730 | `generateReturnNumber()` reads/writes `document_sequences` |

### Isolation Steps
1. ✅ P1-4: Redirect `generateReturnNumber()` to use `documentNumberService.getNextDocumentNumber(companyId, branchId, 'purchase')`
2. After redirect: Monitor for 30 days that `document_sequences` receives no new `document_type='purchase_return'` writes
3. Long-term: Migrate all remaining `document_sequences` consumers; then drop table

### Verification Query
```sql
-- After P1-4: confirm no new purchase_return sequences written
SELECT MAX(updated_at) FROM document_sequences WHERE document_type = 'purchase_return';
-- Expected: no date after P1-4 deploy date
```

---

## 7. `document_sequences_global` (Secondary Numbering Table)

**Status:** Active (secondary) — not yet unified  
**Canonical replacement:** `erp_document_sequences`

### Current Consumers
- `documentNumberService.getNextDocumentNumberGlobal()` → used for some payment/receipt document types
- Prefixes: `SL`, `PS`, `DRAFT`, `QT`, `SO`, `CUS`, `PUR`, `PAY`, `RNT`, `STD`

### Isolation Steps
1. Document all call sites of `getNextDocumentNumberGlobal()`
2. Migrate each prefix to `erp_document_sequences` (requires `generate_document_number` RPC support for these types)
3. Add sequence seeding migration for new types
4. Redirect call sites one-by-one
5. Drop `document_sequences_global`

---

## 8. `account_transactions` (Retired)

**Status:** RETIRED — in `LEGACY_TABLE_BLOCKLIST`  
**Canonical replacement:** `journal_entry_lines`

---

## 9. `backup_cr` + `backup_pf145` (Historical Snapshots)

**Status:** READ-ONLY historical backups — never for live UI  
**Policy:** Only accessible via direct DB query for data archaeology. Never surfaced in UI.

---

## Retirement Priority Matrix

| Table/Field | Priority | Blocker | ETA |
|-------------|----------|---------|-----|
| `sale_items` writes | **P1 DONE** | Migration of old records | Q2 2026 |
| `workers.current_balance` writes | **P1 DONE** | Worker balance GL account setup | Q2 2026 |
| `document_sequences` for purchase return | **P1 DONE** | None | Q2 2026 |
| `ledger_master` + `ledger_entries` | P2 | Confirm 0 active reads | Q3 2026 |
| `chart_accounts` | P2 | Confirm 0 reads | Q3 2026 |
| `document_sequences_global` | P2 | Migrate all 16 prefixes | Q3 2026 |
| `contacts.current_balance` as truth | P2 | GL-derived balance in UI | Q3 2026 |
| `account_transactions` drop | P3 | Confirm 0 rows post-2025 | Q4 2026 |
| `sale_items` table drop | P3 | Migration script + 0 reads | Q4 2026 |
