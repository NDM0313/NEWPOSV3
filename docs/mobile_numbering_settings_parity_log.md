# Mobile Numbering — Web Settings Parity (Deploy Log)

**Date:** 2026-05-25  
**Scope:** Mobile app + shared document-creation RPCs align with Settings → Numbering Rules.

## Masla

Mobile par Regular sale `SL-0033` bani — web Settings mein Branch Code ON (`CR-SL-0001` preview) ke bawajood branch prefix apply nahi hua.

**Do engines:**
- `generate_document_number` → `erp_document_sequences` (Settings yahan)
- `get_next_document_number_global` → hardcoded `SL-0033` (Settings ignore)

**RPC bug:** `create_sale_document_header` (aur expense/purchase/rental RPCs) `generate_document_number` ko `v_sentinel` pass karte thay, real `p_branch_id` nahi — branch code lookup fail.

## Fix

### Database

**Migration:** [`migrations/20260525140000_document_rpc_branch_numbering.sql`](../migrations/20260525140000_document_rpc_branch_numbering.sql)

- `create_sale_document_header` → `p_branch_id`
- `create_expense_document` → `p_branch_id`
- `create_purchase_document_header` → `p_branch_id`
- `create_rental_booking` → `p_branch_id`

### Mobile client

**File:** [`erp-mobile-app/src/api/documentNumber.ts`](../erp-mobile-app/src/api/documentNumber.ts)

- `get_next_document_number_global` hata kar `generate_document_number` + `branchId`
- POS, studio, product, journal paths ab Settings follow karte hain

## Deploy (VPS)

```bash
ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres" < migrations/20260525140000_document_rpc_branch_numbering.sql
ssh dincouture-vps "docker restart supabase-rest"
```

Mobile APK: `erp-mobile-app` build/sync after client change.

## Test

1. Settings → Sale: Branch Based ON, Branch Code ON; branch code `CR` set
2. Mobile Regular nayi sale → `CR-SL-0034` (ya preview jaisa next)
3. Purani `SL-0033` list mein same
4. POS / studio / expense smoke

## Note

Web ke kuch paths ab bhi `getNextDocumentNumberGlobal('SL')` use karte hain — alag follow-up agar poori web parity chahiye.
