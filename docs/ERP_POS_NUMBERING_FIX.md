# ERP POS Numbering Fix (PS Prefix)

## Problem

POS sales were getting **normal sales** invoice numbers (e.g. SL-0001) instead of **POS** numbers (e.g. PS-0001) from the numbering settings.

## Root cause

In `SalesContext.createSale`, the `sequenceType` passed to `documentNumberService.getNextDocumentNumberGlobal()` did not treat POS as its own type. The ternary chain ended with:

- `docType === 'studio' ? 'STD' : 'SL'`

So when `docType === 'pos'`, it fell through to `'SL'`, and POS used the same sequence as normal sales.

## Fix

### 1. SalesContext

**File:** `src/app/context/SalesContext.tsx`

- In the line that sets `sequenceType`, add an explicit branch for POS:
  - **Before:** `docType === 'studio' ? 'STD' : 'SL'`
  - **After:** `docType === 'studio' ? 'STD' : docType === 'pos' ? 'PS' : 'SL'`
- So when `docType === 'pos'`, `sequenceType` is `'PS'` and the next number is requested for the PS sequence.

### 2. documentNumberService

**File:** `src/app/services/documentNumberService.ts`

- In `getNextDocumentNumberGlobal`, extend the `type` parameter union to include `'PS'`:
  - **Before:** `type: 'SL' | 'DRAFT' | 'QT' | 'SO' | 'CUS' | 'PUR' | 'PAY' | 'RNT' | 'STD'`
  - **After:** `type: 'SL' | 'PS' | 'DRAFT' | 'QT' | 'SO' | 'CUS' | 'PUR' | 'PAY' | 'RNT' | 'STD'`
- Comment updated to state that PS is used for POS.

### 3. Database

The existing `get_next_document_number_global(p_company_id, p_type)` already supports any `p_type`: the `CASE` has an `ELSE UPPER(TRIM(p_type)) || '-'`, so when `p_type = 'PS'` the prefix is `'PS-'` and the sequence is stored under `document_type = 'PS'`. No DB migration was required.

## Result

- **Normal sale (invoice):** `docType = 'invoice'` → `sequenceType = 'SL'` → SL-0001, SL-0002, …
- **POS sale:** `docType = 'pos'` → `sequenceType = 'PS'` → PS-0001, PS-0002, …
- Studio, draft, quotation, order unchanged (STD, DRAFT, QT, SO).

## Verification

1. Create a **normal** sale (Sales → New Sale, final) and save → invoice number should be SL-xxxx.
2. Create a **POS** sale (POS → add items → checkout) → invoice number should be PS-xxxx.
3. Check that SL and PS sequences each increment independently (e.g. SL-0003 and PS-0002 can coexist).

## Rollback

- In SalesContext, remove the `docType === 'pos' ? 'PS'` branch so POS again falls through to `'SL'`.
- In documentNumberService, remove `'PS'` from the type union.
