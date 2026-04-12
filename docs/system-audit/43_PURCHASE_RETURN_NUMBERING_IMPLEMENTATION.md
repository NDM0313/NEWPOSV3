# 43. Purchase Return Numbering — Implementation Complete

**Date:** 2026-04-12  
**Decision source:** `39_PURCHASE_RETURN_NUMBERING_DECISION.md`  
**Status:** Code deployed; VPS migration pending

---

## What Was Changed

### TypeScript Changes

**`src/app/services/documentNumberService.ts`**  
Added `'purchase_return'` to the `ErpDocumentType` union type:
```typescript
export type ErpDocumentType =
  | 'sale'
  | 'purchase'
  | 'purchase_return'   // NEW — dedicated sequence with PRET- prefix
  | 'payment'
  ...
```
The type is a TypeScript-only union; it flows through to the `generate_document_number` RPC as a free-form string. The RPC accepts any `TEXT` value for `p_document_type`.

**`src/app/services/purchaseReturnService.ts`** — `generateReturnNumber()` (~line 761)  
Changed document type from `'purchase'` (interim P1-4 value) to `'purchase_return'`:
```typescript
// Before (P1-4 interim):
return await documentNumberService.getNextDocumentNumber(companyId, branchId, 'purchase');
// After (P2 final):
return await documentNumberService.getNextDocumentNumber(companyId, branchId, 'purchase_return');
```
The fallback (`PRET-YYYYMMDD-XXXX`) is unchanged — activates if no sequence row exists on VPS.

**`src/app/components/purchases/PurchasesPage.tsx`** — line 1281  
Standardized inconsistent fallback prefix from `PR-` to `PRET-`:
```typescript
// Before: `PR-${ret.id?.slice(0, 8)}`
// After:  `PRET-${ret.id?.slice(0, 8)}`
```
Lines 668 and 2175 already used `PRET-` — now consistent across all three fallback locations.

### New Migration File

**`migrations/purchase_return_sequence_finalization.sql`**

Two operations:
1. Patches `erp_document_default_prefix()` SQL function: adds `WHEN 'PURCHASE_RETURN' THEN 'PRET-'`
2. Seeds `purchase_return` sequences for all company/branch combos that already have a `purchase` sequence

The migration is idempotent (`ON CONFLICT DO NOTHING`), wrapped in `DO $$ BEGIN...EXCEPTION` blocks.

---

## How the Numbering System Works (After This Change)

```
generateReturnNumber(companyId, branchId)
  → documentNumberService.getNextDocumentNumber(companyId, branchId, 'purchase_return')
    → Supabase RPC: generate_document_number(p_company_id, p_branch_id, 'purchase_return')
      → Looks up erp_document_sequences WHERE document_type = 'purchase_return'
        → Found: increment last_number, return '{prefix}{zero-padded-number}'
        → Not found: INSERT new row using erp_document_default_prefix('purchase_return') = 'PRET-'
                     then return 'PRET-0001'
      → Returns: 'PRET-0001', 'PRET-0002', etc.
```

If the VPS migration has not been run yet (no `purchase_return` sequence row exists), the RPC will auto-create one using the patched prefix function on first call. As long as the prefix function migration has been deployed, the number format will be correct.

---

## Deploying to VPS

**Order matters: deploy migration BEFORE or ALONGSIDE code.**

```bash
# Step 1: Run on VPS SQL editor
\i migrations/purchase_return_sequence_finalization.sql

# Verify:
SELECT document_type, prefix, COUNT(*)
FROM erp_document_sequences
WHERE document_type IN ('purchase', 'purchase_return')
GROUP BY document_type, prefix;
# Expected: purchase_return rows with prefix='PRET-'

# Step 2: Deploy code (standard deploy process)
# Step 3: Create a test purchase return and verify return_no = 'PRET-NNNN'
```

---

## Effect on Historical Returns

**No change.** Existing purchase returns with `return_no = 'PUR-NNNN'` (generated during the P1-4 interim period when the shared `'purchase'` type was used) are unaffected. Their `return_no` values are already stored in the `purchase_returns` table and are not modified by this change.

The new sequence starts at 0 for the current year. If continuity with existing `PUR-` numbers is needed for specific companies, manually set `last_number` in `erp_document_sequences` to the highest known return sequence value.

---

## Verification

```sql
-- Run after VPS migration + code deploy:
-- scripts/system-audit/verify_purchase_return_numbering_post_patch.sql

-- Quick check: new returns should show 'dedicated-sequence' format
SELECT return_no,
  CASE
    WHEN return_no ~ '^PRET-[0-9]+$'    THEN 'dedicated-sequence' -- target
    WHEN return_no ~ '^PUR-[0-9]+$'     THEN 'shared-purchase-sequence'
    WHEN return_no ~ '^PRET-[0-9]{4,}-' THEN 'timestamp-fallback'
    ELSE 'other'
  END AS format
FROM purchase_returns
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```
