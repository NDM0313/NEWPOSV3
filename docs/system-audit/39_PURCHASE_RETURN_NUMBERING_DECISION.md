# 39. Purchase Return Document Numbering — Decision

**Date:** 2026-04-12  
**Relates to:** P1-4 (`purchaseReturnService.ts` — `generateReturnNumber()` redirected to canonical RPC)  
**Decision:** Create a dedicated `purchase_return` sequence with `PRET-` prefix

---

## Background

P1-4 redirected `generateReturnNumber()` in `purchaseReturnService.ts` from the legacy `document_sequences` table to the canonical `documentNumberService.getNextDocumentNumber(companyId, branchId, 'purchase')`.

This used the `'purchase'` document type as a pragmatic interim solution — it worked immediately without needing a new sequence to be seeded. However, it means purchase returns share the same counter as purchase orders, producing numbers like `PUR-0001` for both.

---

## Evidence: UI Uses Distinct `PRET-` Prefix

The application UI treats purchase return numbers as visually distinct from purchase numbers:

**`src/app/components/purchases/PurchasesPage.tsx`**
- Line 668: `PRET-${id.slice(0,8)}` — fallback for return_no display
- Line 1281: `PR-${id.slice(0,8)}` — alternate fallback
- Line 2175: `PRET-${id.slice(0,8)}` — second instance
- Return numbers displayed in `font-mono text-purple-400` — visually distinct from purchase numbers

**`src/app/components/purchases/StandalonePurchaseReturnForm.tsx`**
- Uses `PRET-` prefix in display contexts

The `PRET-` prefix is the **intended prefix** for purchase returns. The current P1-4 redirect to the `'purchase'` sequence is a temporary workaround.

---

## Decision: Dedicated `purchase_return` Sequence

**Verdict: A separate `purchase_return` sequence is the correct approach.**

### Rationale

1. **User-facing numbering must be distinct**: Return numbers and purchase orders appear on different documents and must be distinguishable at a glance.
2. **Counter contamination**: Sharing the purchase sequence means `PUR-0005` could be either a purchase order or a purchase return — ambiguous in supplier communications.
3. **Audit trail**: GL entries and physical documents reference return numbers. Mixed numbering breaks audit matching.
4. **UI confirms intent**: The `PRET-` fallback prefix in the UI was added deliberately — the original developer intended returns to have their own prefix.

---

## Implementation

### Step 1: Seed the sequence

Run on VPS/staging per company, per branch:

```sql
-- Seed purchase_return sequence for each company/branch combination
INSERT INTO erp_document_sequences (
  company_id,
  branch_id,
  document_type,
  prefix,
  current_value,
  created_at,
  updated_at
)
SELECT
  b.company_id,
  b.id AS branch_id,
  'purchase_return',
  'PRET-',
  0,  -- starts at 0 so first generated is PRET-0001
  NOW(),
  NOW()
FROM branches b
WHERE NOT EXISTS (
  SELECT 1 FROM erp_document_sequences eds
  WHERE eds.company_id = b.company_id
    AND eds.branch_id = b.id
    AND eds.document_type = 'purchase_return'
)
ORDER BY b.company_id, b.id;
```

### Step 2: Update `purchaseReturnService.ts`

Change `generateReturnNumber()` from using `'purchase'` type to `'purchase_return'`:

```typescript
// Before (P1-4 interim):
return await documentNumberService.getNextDocumentNumber(companyId, branchId, 'purchase');

// After (correct):
return await documentNumberService.getNextDocumentNumber(companyId, branchId, 'purchase_return');
```

**File:** `src/app/services/purchaseReturnService.ts`  
**Function:** `generateReturnNumber()`

### Step 3: Verify

```sql
-- Run: scripts/system-audit/verify_purchase_return_numbering_post_patch.sql
-- CHECK 1: purchase_return sequence should now appear
-- CHECK 4: new returns should have PRET-NNNN format (not PUR-NNNN)
```

---

## Numbering Format

The `generate_document_number` RPC produces: `{prefix}{zero-padded-number}`

With `prefix = 'PRET-'` and a 4-digit minimum:  
→ `PRET-0001`, `PRET-0002`, ...

If the prefix is empty or the RPC formats differently, the UI fallbacks (`PRET-${id.slice(0,8)}`) will continue to display the `PRET-` label correctly for returns that have no `return_no`.

---

## Migration of Existing Returns

Existing purchase returns that received a `PUR-NNNN` number (from the interim P1-4 shared sequence) do **not** need to be renumbered. Their numbers are already recorded on supplier documents. Leave them as-is.

New returns (after the sequence is seeded and the code updated) will receive `PRET-NNNN` numbers automatically.

---

## Action Items

| Action | Owner | Status |
|--------|-------|--------|
| Seed `purchase_return` sequences per company/branch | DBA / ops | Pending |
| Update `purchaseReturnService.generateReturnNumber()` to use `'purchase_return'` type | Dev | Pending |
| Deploy and verify with `verify_purchase_return_numbering_post_patch.sql` | QA | Pending |

---

## Relationship to Other Sequences

| Document type | Current numbering | Sequence type |
|---------------|------------------|---------------|
| Purchase order | `PUR-NNNN` | `purchase` sequence in `erp_document_sequences` |
| Purchase return | `PRET-NNNN` (target) | `purchase_return` sequence — TO BE SEEDED |
| Sale | Varies by prefix | `sale` sequence |
| Sale return | Varies | `sale_return` sequence |
