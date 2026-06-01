# Phase 14 — Expense Receipt Upload 400 Fix (Deployment Log)

**Date:** 2026-05-25  
**Scope:** `erp-mobile-app/` + chhota deploy diagnostic; koi naya DB migration nahi.

## Masla

Dev browser (`localhost:5174` → Vite proxy → Supabase Storage) par expense save karte waqt:

```
POST .../storage/v1/object/expense-receipts/{companyId}/receipts/...
400 (Bad Request)
```

Expense save ho jati thi lekin **receipt attach nahi** hoti — 400 aksar tab aata hai jab VPS par **`expense-receipts` bucket missing** ho (Supabase kabhi 404 ki jagah 400 deta hai).

## Fixes (client)

### [`storageUploadErrors.ts`](../erp-mobile-app/src/utils/storageUploadErrors.ts)

- `storageErrorStatus()` helper
- `isBucketNotFoundError()` — HTTP 400 + generic "Bad Request" / bucket phrases
- Bucket missing par clear admin message (VPS deploy)

### [`expenses.ts`](../erp-mobile-app/src/api/expenses.ts)

- Session preflight: `listBuckets()` — agar `expense-receipts` na ho to upload se pehle error
- `contentType` fallback (`.jpg` → `image/jpeg`, etc.)
- Dev logging on failure
- Return `{ url, error, kind }` for UI

### [`ExpenseModule.tsx`](../erp-mobile-app/src/components/expense/ExpenseModule.tsx)

- `up.kind === 'bucket'` → soft-save without attachment + admin message
- Doosri upload errors → save block

### [`deploy/diagnose-storage-upload-vps.sh`](../deploy/diagnose-storage-upload-vps.sh)

- `expense_receipts_bucket` + `expense_receipts_policies` counts

## VPS fix (agar bucket missing ho)

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/apply-fixes-now.sh"
```

Verify:

```sql
SELECT name FROM storage.buckets WHERE name = 'expense-receipts';
```

## Verify

```bash
npm run typecheck:mobile   # PASS
```

**Manual smoke:**

1. Expense + JPG → receipt upload OK, `receipt_url` save
2. Bucket missing → clear message, expense bina attachment save (optional)
3. Upload fail (auth/size) → save block + error
