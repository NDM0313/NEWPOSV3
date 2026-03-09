# Migration: products.product_type (Studio Production Accounting)

Run this once per environment (local, VPS, Supabase project) so production products (STD-PROD-xxxx) and inventory accounting work correctly.

## File to run

- **`products_product_type_production.sql`**

## How to run

### Option A – Supabase Dashboard (recommended)

1. Open your project in [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor**.
3. Open `migrations/products_product_type_production.sql`, copy its contents, and paste into the editor.
4. Click **Run**.

### Option B – Supabase CLI

```bash
supabase db push
# or, if you run SQL files manually:
psql $DATABASE_URL -f migrations/products_product_type_production.sql
```

### Option C – VPS (after deploy)

If you apply migrations as part of deploy:

```bash
# From project root, after git pull
ssh dincouture-vps "cd /root/NEWPOSV3 && psql \$DATABASE_URL -f migrations/products_product_type_production.sql"
# Or run the SQL in Supabase SQL Editor for the same project.
```

## What it does

- Adds **`products.product_type`** (`'normal'` | `'production'`) with default `'normal'`.
- Backfills **`product_type = 'production'`** for:
  - Products linked from `studio_production_orders_v2`
  - Products with SKU like `STUDIO-%` or `STD-PROD-%`

## After migration

- New studio-created products get SKU **STD-PROD-00001**, **STD-PROD-00002**, …
- Creating a product from a completed production order adds a **stock movement** (finished goods) and, when accounting is enabled, **Dr Finished Goods Inventory, Cr Production Cost**.
- Generating the studio customer invoice posts **Dr AR, Cr Sales** and **Dr COGS, Cr Inventory** (when accounts 1100, 4000, 5100, 1200 exist).
