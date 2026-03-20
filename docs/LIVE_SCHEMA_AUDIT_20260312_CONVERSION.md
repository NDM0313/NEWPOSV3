# Live schema audit — conversion columns (`supabase.dincouture.pk` / `supabase-db`)

**Date:** 2026-03-12  
**Method:** `docker exec supabase-db psql -U postgres -d postgres` (VPS `dincouture-vps`).

## Before repair

| Table | `converted` | `converted_to_document_id` | Notes |
|-------|---------------|----------------------------|--------|
| `public.sales` | **missing** | **missing** | 43 columns; no conversion archive columns |
| `public.purchases` | **missing** | **missing** | 26 columns |

### Enums (aligned with canonical app design)

- **`sale_status`:** `draft`, `quotation`, `order`, `final`, `cancelled`
- **Purchase status type:** `draft`, `ordered`, `received`, `final`, `cancelled`

No enum mismatch — **400s were from filtering on non-existent `converted`**, not from bad `status=in.(…)`.

## After repair

- Applied `migrations/20260320_sales_purchases_conversion_workflow.sql` as `postgres` (columns + indexes + FKs; function replace failed — see below).
- Applied `migrations/20260321_handle_sale_final_stock_movement_supabase_admin.sql` as **`supabase_admin`** (`handle_sale_final_stock_movement` owner).
- Applied `migrations/20260322_app_document_conversion_schema_rpc.sql` as `postgres`.
- PostgREST: `NOTIFY pgrst, 'reload schema';`

Verified: `sales` and `purchases` both list `converted` and `converted_to_document_id`.

## Root cause (400 Bad Request)

PostgREST rejected `converted=eq.false` while the column was absent (or schema cache stale). Client retries alone still spammed the console until a capability-aware path was added (`app_document_conversion_schema` RPC + cached flags).
