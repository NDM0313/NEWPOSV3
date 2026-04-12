# 31. P1-4: Document Numbering Unification

**Date:** 2026-04-12  
**Status:** P2 COMPLETE — dedicated `purchase_return` sequence type implemented; VPS migration pending  
**Priority:** P1  
**Bug class:** Legacy numbering table in use alongside canonical system

---

## 1. Problem Statement

Three separate numbering systems were active:

| System | Table | RPC | Used by |
|--------|-------|-----|---------|
| Canonical | `erp_document_sequences` | `generate_document_number` | Sales, purchases, payments, expenses, products, journals |
| Secondary | `document_sequences_global` | `get_next_document_number_global` | Some payment/receipt prefixes |
| Legacy | `document_sequences` | none (direct read+update) | Purchase returns (`generateReturnNumber`) |

The legacy `document_sequences` system:
- Is not atomic (read + increment in two round trips — race condition possible)
- Falls back to a timestamp-based PRET-YYYYMMDD-xxxx number on miss
- Is the only remaining caller of `document_sequences` for production document creation

---

## 2. Code Fix

**File:** `src/app/services/purchaseReturnService.ts`

**Import added:**
```typescript
import { documentNumberService } from './documentNumberService';
```

**`generateReturnNumber()` replaced:**
```typescript
// P1-4: Use canonical erp_document_sequences via generate_document_number RPC
// Was: document_sequences (legacy table, non-atomic)
async generateReturnNumber(companyId: string, branchId?: string): Promise<string> {
  try {
    return await documentNumberService.getNextDocumentNumber(
      companyId,
      branchId && branchId !== 'all' ? branchId : null,
      'purchase_return'   // P2: changed from 'purchase' to dedicated type
    );
  } catch {
    const d = new Date();
    return `PRET-...`;  // timestamp fallback retained
  }
}
// P2 update: 'purchase' was an interim type shared with purchase orders.
// 'purchase_return' is now a first-class ErpDocumentType with PRET- prefix.
// See: 39_PURCHASE_RETURN_NUMBERING_DECISION.md, 43_PURCHASE_RETURN_NUMBERING_IMPLEMENTATION.md
```

**Before:** Read from `document_sequences` WHERE `document_type = 'purchase_return'`; increment; write back  
**After:** Single atomic RPC call to `generate_document_number` with `p_document_type = 'purchase'`

---

## 3. Document Type Mapping Note

`documentNumberService.getNextDocumentNumber()` uses `ErpDocumentType` which includes `'purchase'` but not `'purchase_return'` as a separate type. Purchase returns use the `purchase` sequence. This produces numbers in the same series as purchases (e.g. PUR-0023 for purchase, PUR-0024 for purchase return). This is acceptable — the return number carries the `PRET-` prefix in the fallback but the canonical engine will use the `purchase` sequence prefix configured in `erp_document_sequences`.

**If a separate prefix is needed** (e.g. `RET-` for purchase returns), a new entry in `erp_document_sequences` with `document_type = 'purchase_return'` must be seeded via DB migration, and the call changed to `'purchase_return'` as the type.

---

## 4. Remaining Legacy Numbering Consumers

| System | Consumers | Plan |
|--------|-----------|------|
| `document_sequences_global` | Some payment/receipt document types via `getNextDocumentNumberGlobal()` | P2: migrate per prefix |
| `document_sequences` | None after P1-4 (purchase return was the last consumer) | P2: verify 0 writes; then drop |

---

## 5. Verification

```sql
-- After P1-4: document_sequences.purchase_return sequences should have no new increments
SELECT document_type, current_number, updated_at
FROM document_sequences
WHERE document_type = 'purchase_return'
ORDER BY updated_at DESC;
-- Expected: updated_at before 2026-04-12 (no new increments after patch)

-- Confirm erp_document_sequences has purchase sequence
SELECT * FROM erp_document_sequences WHERE document_type = 'purchase';
```
