# Storage upload blocked by RLS

When uploads to Storage fail (e.g. "new row violates row-level security policy"), apply storage RLS using one of these options.

## Option 1: VPS (deploy)

```bash
cd /root/NEWPOSV3 && bash deploy/deploy.sh
```

RLS is applied automatically as part of deploy.

## Option 2: Supabase Dashboard (SQL Editor)

1. Open **Supabase Dashboard** → **SQL Editor** for the project your app uses.
2. Run **`supabase-extract/migrations/RUN_THIS_FOR_STORAGE_RLS.sql`** payment-attachments, sale-attachments, and purchase-attachments.
3. If **product image** uploads still fail, run **`RUN_PRODUCT_IMAGES_STORAGE_RLS.sql`** as well.

Create the buckets in **Storage** first if they don’t exist: `payment-attachments`, `sale-attachments`, `purchase-attachments`, and `product-images` for product images.

## Option 3: Local (npm script)

1. In project root, ensure **`.env.local`** has **`DATABASE_URL`** or **`DATABASE_POOLER_URL`** (Supabase Postgres connection string).
2. Run:

```bash
npm run apply-storage-rls
```

This applies `RUN_THIS_FOR_STORAGE_RLS.sql` (payment-, sale-, and purchase-attachments) and `RUN_PRODUCT_IMAGES_STORAGE_RLS.sql` against the database from `.env.local`.

**If sale upload still fails after the script succeeds:** Your `DATABASE_URL` may point to a different project than the app’s Supabase. Run the SQL in **Supabase Dashboard → SQL Editor** for the **same project** as `VITE_SUPABASE_URL`. Use **`RUN_SALE_ATTACHMENTS_RLS_ONLY.sql`** for sale uploads only, or **`RUN_THIS_FOR_STORAGE_RLS.sql`** for all buckets.

---

See **docs/PRODUCT_IMAGES_STORAGE_RLS_FIX.md** for more detail on product-images bucket and auth.
