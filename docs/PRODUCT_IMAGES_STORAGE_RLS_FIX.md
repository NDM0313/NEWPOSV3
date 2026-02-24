# Product images upload: "new row violates row-level security policy"

If product image upload fails with **StorageApiError: new row violates row-level security policy**, apply the following on **the same Supabase project your app uses** (e.g. **supabase.dincouture.pk**).

## 1. Run the Storage RLS script

In the **Supabase Dashboard** for that project (e.g. open the project that serves `https://supabase.dincouture.pk`) → **SQL Editor**:

1. Open the file **`supabase-extract/migrations/RUN_PRODUCT_IMAGES_STORAGE_RLS.sql`** from this repo (or `24_product_images_storage_rls_fix.sql`).
2. Copy its full contents, paste into a new query, and click **Run**.

This creates (or replaces) RLS policies on `storage.objects` so that **authenticated** users can INSERT/SELECT/UPDATE/DELETE in the `product-images` bucket.

## 2. Ensure the bucket exists

In **Supabase Dashboard** → **Storage**:

- If there is no bucket named **product-images**, create it: **New bucket** → name: `product-images`. You can leave it public or private; the app uses signed URLs when needed.

## 3. Ensure you are logged in

Uploads use the **authenticated** role. If you are not logged in (or the session expired), the request is not considered authenticated and RLS will block the insert.

- Log in to the app and try uploading again.
- If you use a custom auth or proxy, ensure the Supabase client receives the user session (e.g. correct JWT in the request).

## 4. (Optional) Check policies in the Dashboard

In **Supabase Dashboard** → **Storage** → **Policies** (or **Database** → **Tables** → `storage.objects` → RLS policies), confirm there are policies for `product_images_insert`, `product_images_select`, `product_images_update`, and `product_images_delete` for the `product-images` bucket and role `authenticated`.

After doing steps 1–3, product image uploads should succeed.
