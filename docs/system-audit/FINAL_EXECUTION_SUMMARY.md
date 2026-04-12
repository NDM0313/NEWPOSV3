# FINAL EXECUTION SUMMARY — HARD VERSION Architecture Enforcement

**Date:** 2026-04-12  
**Build status:** ✅ `npm run build` — 0 TypeScript errors  
**Total files changed:** 5 source files, 1 config file  
**Total docs created:** 13 markdown files (docs 25–34 + this summary)  
**Total SQL scripts created:** 1 repair script

---

## Phase 1 — Architecture Freeze Docs ✅

| Doc | File | Status |
|-----|------|--------|
| 25 | `docs/system-audit/25_ACCOUNTING_ARCHITECTURE_FREEZE.md` | Created — locked canonical vs legacy table registry |
| 26 | `docs/system-audit/26_CANONICAL_WRITE_PATHS.md` | Created — per-domain service→table→fingerprint map |
| 27 | `docs/system-audit/27_LEGACY_ISOLATION_PLAN.md` | Created — retirement schedule for all legacy tables |

---

## Phase 2 — P1 Code Patches ✅

### P1-1: Purchase Return GL Gap (CRITICAL) ✅

**Files changed:**
- `src/app/services/purchaseReturnService.ts`

**Changes:**
1. Added import: `resolvePayablePostingAccountId` from `partySubledgerAccountService`
2. Added import: `documentNumberService` from `documentNumberService`
3. Added JE posting block inside `finalizePurchaseReturn()` try block, after stock movements loop:
   - Fingerprint: `purchase_return_settlement:{companyId}:{returnId}`
   - Dr AP subledger (resolved via `resolvePayablePostingAccountId`) or code 2000 fallback
   - Cr Inventory (code 1200 or 1500)
   - Idempotency: checks fingerprint before inserting

**Void path:** No change needed — `voidPurchaseReturn()` already queries and reverses all `reference_type='purchase_return'` JEs.

**SQL repair:** `scripts/repair_purchase_return_missing_journal_entries.sql` — 3-block template to post historical JEs + verify discrepancy = 0.

**Doc:** `docs/system-audit/28_P1_PURCHASE_RETURN_GL_GAP_FIX.md`

---

### P1-2: Eliminate `sale_items` Writes ✅

**Files changed:**
- `src/app/services/studioProductionService.ts`
- `src/app/components/admin/AccountingIntegrityLabPage.tsx`

**Changes in `studioProductionService.ts`:**
- Fallback at lines 703–713: changed from writing to `sale_items` to writing to `sales_items` (canonical)
- Fallback payload normalized: `unit_price` instead of `price`; `is_studio_product` dropped (column mismatch was root cause of original fallback)
- Log message updated: `'studio line added (sales_items fallback)'`

**Changes in `AccountingIntegrityLabPage.tsx`:**
- 2 locations (debug tool): removed `sale_items` fallback reads + writes; canonical `sales_items` only

**Remaining read-only allowance:** `studioProductionService.ts` line 380 — READ from `sale_items` for backward compat with old records. Acceptable until data migration.

**Doc:** `docs/system-audit/29_P1_SALE_ITEMS_LEGACY_ELIMINATION.md`

---

### P1-3: Remove `workers.current_balance` Manual Writes ✅

**File changed:** `src/app/services/studioProductionService.ts`

**5 write sites removed:**

| Former line | Function | Removed |
|-------------|----------|---------|
| ~1404–1406 | `ensureWorkerLedgerEntry()` | `current_balance + cost` write |
| ~1658–1660 | Stage reassignment loop | `bal - cost` write |
| ~1753–1755 | `updateStageWithCost()` | `bal + diff` write |
| ~1793–1796 | `markWorkerLedgerEntryPaid()` | `currentBalance - amount` write |
| ~1899–1902 | `addWorkerLedgerEntryForPayment()` | `currentBalance - amount` write |

Each replaced with: `// P1-3: balance is derived from GL — do not write workers.current_balance`

**Note:** Audit found writes on `workers.current_balance`, not `contacts.current_balance`. Plan corrected in doc 30.

**Doc:** `docs/system-audit/30_P1_CONTACTS_BALANCE_CACHE_CLEANUP.md`

---

### P1-4: Document Numbering Unification ✅

**File changed:** `src/app/services/purchaseReturnService.ts`

**Change:** `generateReturnNumber()` redirected from `document_sequences` (legacy, non-atomic) to `documentNumberService.getNextDocumentNumber()` (canonical, atomic RPC).

```typescript
// Before: read/increment document_sequences in two round trips
// After:  single atomic call to generate_document_number RPC
return await documentNumberService.getNextDocumentNumber(companyId, branchId, 'purchase');
```

**Doc:** `docs/system-audit/31_P1_DOCUMENT_NUMBERING_UNIFICATION.md`

---

### P1-5: Studio V3 Accounting Hard Block ✅

**File changed:** `src/app/services/studioProductionV3Service.ts`

**Change:** `completeStage()` now throws unconditionally:
```typescript
throw new Error('[Studio V3] Cannot complete stage: accounting journal entry layer not yet implemented. Use Studio V1 workflow.');
```

Parameters renamed to `_stageId` / `_actualCost` (TypeScript unused-variable safety).

**Unblock condition:** Implement JE posting in V3 completeStage(). See doc 32.

**Doc:** `docs/system-audit/32_P1_STUDIO_V3_ACCOUNTING_HARD_BLOCK.md`

---

## Phase 3 — Hard Guards Enforcement ✅

**File changed:** `src/app/services/accountingCanonicalGuard.ts`  
**File changed:** `.env.example`

**Change:** `failLegacyReadInDev()` now throws by default in all non-production environments. Before: required `VITE_ACCOUNTING_LEGACY_HARD_FAIL=true`. After: throws unless `MODE=production` or `VITE_ACCOUNTING_LEGACY_HARD_FAIL=false`.

**`.env.example`:** Added documentation block explaining the guard flags.

**Doc:** `docs/system-audit/33_HARD_GUARDS_ENFORCEMENT.md`

---

## Phase 4 — Studio Version Strategy ✅

**Doc:** `docs/system-audit/34_STUDIO_VERSION_STRATEGY_FINAL.md`

| Version | Decision |
|---------|----------|
| V1 | PRODUCTION BASELINE — keep |
| V2 | FROZEN — sunset Q3 2026 |
| V3 | BLOCKED until JE layer implemented |

---

## Build Verification ✅

```
npm run build
✓ built in 15.97s
0 TypeScript errors
0 errors (chunk size warnings are pre-existing, not related to these patches)
```

---

## Architecture State After This Session

### Canonical sources (enforced)
- GL truth: `journal_entries` + `journal_entry_lines`
- Stock: `stock_movements`
- Sale lines: `sales_items` (no new writes to `sale_items`)
- Document numbers: `erp_document_sequences` (purchase returns migrated)

### Patched gaps
- Purchase return: JE now posted on finalize ✅
- `sale_items` fallback writes: eliminated ✅
- `workers.current_balance` manual writes: eliminated ✅
- Studio V3 stage completion: hard-blocked ✅

### Guards enforced
- `failLegacyReadInDev()`: throws in dev by default ✅

### Remaining P2/P3 work
- `document_sequences_global` consumers: migrate per prefix
- `sale_items` table: data migration + drop
- `ledger_master` / `ledger_entries`: confirm 0 reads + drop
- V3 accounting JE layer: implement to unblock V3
- Worker balance display: switch from `workers.current_balance` to GL subledger sum in UI
- V2 sunset: delete dead code (`studioCustomerInvoiceService.ts`)
