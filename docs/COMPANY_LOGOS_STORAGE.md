# Company logo storage (`company-logos` bucket)

Web ERP **Settings → Company** logo upload uses Supabase Storage bucket **`company-logos`**.  
If the bucket is missing, you see:

> Bucket 'company-logos' not found. Create it in Supabase Dashboard → Storage (name: company-logos).

This is **not** fixed by the mobile APK product-image builds (32/33). Company logo upload is **web-only** ([`src/app/utils/companyLogoUpload.ts`](../src/app/utils/companyLogoUpload.ts)).

---

## Fix (choose one)

### Option A — VPS deploy (recommended)

Applies canonical migrations and ensures buckets in [`deploy/deploy.sh`](../deploy/deploy.sh):

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull origin main && bash deploy/deploy.sh"
```

### Option B — Supabase SQL Editor

On the **same project** as `https://erp.dincouture.pk` (production Supabase):

1. Open **SQL Editor**.
2. Run the full file [`migrations/20260601150000_company_logos_storage_bucket.sql`](../migrations/20260601150000_company_logos_storage_bucket.sql).

Or create the bucket manually: **Storage → New bucket** → name `company-logos`, **private**, then run RLS from [`migrations/20260611120000_company_logos_storage_rls.sql`](../migrations/20260611120000_company_logos_storage_rls.sql) if policies are missing.

### Option C — Local `DATABASE_URL`

From repo root with `.env.local` pointing at production Postgres:

```bash
psql "$DATABASE_URL" -f migrations/20260601150000_company_logos_storage_bucket.sql
```

---

## Verify

1. SQL: `SELECT name, public FROM storage.buckets WHERE name = 'company-logos';` — one row, `public = false`.
2. Web: Settings → Company → upload PNG/JPG (max 2 MB) → success toast *Logo uploaded. Click Save to persist…*
3. Network: `POST .../storage/v1/object/company-logos/{companyId}/logo.jpg` → **JSON** 200 (not HTML 404).
4. Save company settings; logo appears on invoices/reports after refresh.

---

## Related

| Doc | Role |
|-----|------|
| [`docs/STORAGE_RLS_FIX.md`](STORAGE_RLS_FIX.md) | Other attachment buckets |
| [`docs/infra/ERP_DISPLAY_LOCKED.md`](infra/ERP_DISPLAY_LOCKED.md) | Product photos (APK) vs company logo (web) |

**Mobile:** [`erp-mobile-app/src/lib/companyLogoDisplay.ts`](../erp-mobile-app/src/lib/companyLogoDisplay.ts) only **displays** signed URLs for reports; it does not upload logos.
