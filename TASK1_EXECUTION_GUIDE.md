# 🚀 TASK 1: SQL Migration Execution Guide

**Status**: ⚠️ PENDING EXECUTION  
**Priority**: 1 (CRITICAL - Data Integrity)  
**Date**: January 2026

---

## 📋 Overview

This task executes a SQL migration to add packing columns to `sale_items` and `purchase_items` tables. The frontend code is already complete and ready to save packing data, but the database schema needs to be updated first.

**Impact**: Without this migration, packing data entered in Sales and Purchases forms will not be saved to the database.

---

## ✅ Prerequisites

- [x] Supabase project is set up
- [x] Database connection is working
- [x] You have access to Supabase Dashboard
- [x] Migration file exists: `supabase-extract/migrations/add_packing_columns.sql`

---

## 🎯 What This Migration Does

### Adds 4 columns to `sale_items` table:
1. `packing_type` (VARCHAR(50)) - Type of packing (e.g., "fabric", "wholesale")
2. `packing_quantity` (DECIMAL(15,2)) - Total quantity in packing unit
3. `packing_unit` (VARCHAR(50)) - Unit of packing (e.g., "meters", "boxes")
4. `packing_details` (JSONB) - Detailed packing information (boxes, meters, thaans, etc.)

### Adds 4 columns to `purchase_items` table:
1. `packing_type` (VARCHAR(50))
2. `packing_quantity` (DECIMAL(15,2))
3. `packing_unit` (VARCHAR(50))
4. `packing_details` (JSONB)

---

## 📝 Execution Steps

### Method 1: Using Supabase Dashboard (Recommended)

#### Step 1: Open Supabase Dashboard
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)

#### Step 2: Open Migration File
1. Open the file: `supabase-extract/migrations/add_packing_columns.sql`
2. Copy the entire contents

#### Step 3: Execute SQL
1. In Supabase SQL Editor, click **New Query**
2. Paste the SQL from the migration file
3. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
4. Wait for execution to complete

#### Step 4: Verify Success
You should see:
- ✅ Success message: "Success. No rows returned"
- ✅ No error messages

---

### Method 2: Using psql (Command Line)

#### For Windows (PowerShell):

```powershell
# Set connection variables
$env:PGHOST="your-supabase-host.supabase.co"
$env:PGPORT="6543"
$env:PGDATABASE="postgres"
$env:PGUSER="postgres.your-project-ref"
$env:PGPASSWORD="your-password"

# Execute migration
psql -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d $env:PGDATABASE -f "supabase-extract/migrations/add_packing_columns.sql"
```

#### For MacBook/Linux:

```bash
# Set connection variables
export PGHOST="your-supabase-host.supabase.co"
export PGPORT="6543"
export PGDATABASE="postgres"
export PGUSER="postgres.your-project-ref"
export PGPASSWORD="your-password"

# Execute migration
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f supabase-extract/migrations/add_packing_columns.sql
```

---

## ✅ Verification Steps

### Step 1: Verify Columns Exist

Run this SQL in Supabase SQL Editor:

```sql
-- Verify sale_items columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sale_items'
AND column_name LIKE 'packing%'
ORDER BY column_name;

-- Verify purchase_items columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'purchase_items'
AND column_name LIKE 'packing%'
ORDER BY column_name;
```

**Expected Result**: Should return 4 rows for each table:
- `packing_details` (jsonb)
- `packing_quantity` (numeric)
- `packing_type` (character varying)
- `packing_unit` (character varying)

### Step 2: Test Packing Feature

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Test Sales Form:**
   - Go to Sales module
   - Create a new sale
   - Add a product
   - Click "Add Packing" button
   - Enter packing details (boxes, pieces, meters)
   - Save the sale
   - Check browser console for errors (should be none)

3. **Test Purchases Form:**
   - Go to Purchases module
   - Create a new purchase order
   - Add a product
   - Click "Add Packing" button
   - Enter packing details
   - Save the purchase
   - Check browser console for errors (should be none)

4. **Verify Data Persistence:**
   - Refresh the page
   - Open the saved sale/purchase
   - Verify packing data is still there

### Step 3: Check Database

Run this SQL to verify data was saved:

```sql
-- Check sale_items with packing data
SELECT 
    id,
    product_name,
    packing_type,
    packing_quantity,
    packing_unit,
    packing_details
FROM sale_items
WHERE packing_details IS NOT NULL
LIMIT 5;

-- Check purchase_items with packing data
SELECT 
    id,
    product_name,
    packing_type,
    packing_quantity,
    packing_unit,
    packing_details
FROM purchase_items
WHERE packing_details IS NOT NULL
LIMIT 5;
```

---

## 🐛 Troubleshooting

### Issue 1: "Column already exists" Error

**Solution**: This means the migration was already executed. You can skip it or verify columns exist.

### Issue 2: "Permission denied" Error

**Solution**: 
- Check you're using the correct database user
- Verify RLS policies allow the operation
- Try using service_role key for migration

### Issue 3: Packing Data Not Saving

**Possible Causes:**
1. Migration not executed - Verify columns exist
2. Frontend code issue - Check browser console
3. RLS policy blocking - Check Supabase logs

**Debug Steps:**
```sql
-- Check if columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'sale_items' 
AND column_name LIKE 'packing%';

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename IN ('sale_items', 'purchase_items');
```

### Issue 4: Migration File Not Found

**Solution**: 
- Verify file exists at: `supabase-extract/migrations/add_packing_columns.sql`
- If missing, create it with the SQL from this guide

---

## 📊 Migration SQL (Complete)

```sql
-- ============================================================================
-- MIGRATION: Add Packing Columns to sale_items and purchase_items
-- ============================================================================
-- Date: January 2026
-- Purpose: Enable packing data persistence for Sales and Purchases

-- Add packing columns to sale_items
ALTER TABLE sale_items 
ADD COLUMN IF NOT EXISTS packing_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_quantity DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS packing_unit VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_details JSONB;

-- Add packing columns to purchase_items
ALTER TABLE purchase_items 
ADD COLUMN IF NOT EXISTS packing_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_quantity DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS packing_unit VARCHAR(50),
ADD COLUMN IF NOT EXISTS packing_details JSONB;

-- Add comments for documentation
COMMENT ON COLUMN sale_items.packing_type IS 'Type of packing (e.g., "fabric", "wholesale")';
COMMENT ON COLUMN sale_items.packing_quantity IS 'Total quantity in packing unit (e.g., meters)';
COMMENT ON COLUMN sale_items.packing_unit IS 'Unit of packing (e.g., "meters", "boxes")';
COMMENT ON COLUMN sale_items.packing_details IS 'Detailed packing information (JSONB: boxes, meters, thaans, etc.)';

COMMENT ON COLUMN purchase_items.packing_type IS 'Type of packing (e.g., "fabric", "wholesale")';
COMMENT ON COLUMN purchase_items.packing_quantity IS 'Total quantity in packing unit (e.g., meters)';
COMMENT ON COLUMN purchase_items.packing_unit IS 'Unit of packing (e.g., "meters", "boxes")';
COMMENT ON COLUMN purchase_items.packing_details IS 'Detailed packing information (JSONB: boxes, meters, thaans, etc.)';
```

---

## ✅ Completion Checklist

After execution, verify:

- [ ] SQL migration executed successfully
- [ ] No error messages in Supabase
- [ ] Columns verified in database (8 columns total: 4 in sale_items, 4 in purchase_items)
- [ ] Can create sale with packing data
- [ ] Can create purchase with packing data
- [ ] Packing data persists after page refresh
- [ ] No console errors in browser
- [ ] Data visible in database queries

---

## 📝 Next Steps

After completing this task:

1. **Update Status**: Mark TASK 1 as complete in `WINDOWS_CONTINUATION_GUIDE.md`
2. **Test Thoroughly**: Create multiple sales/purchases with different packing scenarios
3. **Document Issues**: If any issues found, document them for follow-up
4. **Proceed to Optional Tasks**: If approved, proceed with TASK 2 and TASK 3

---

## 🔗 Related Files

- Migration File: `supabase-extract/migrations/add_packing_columns.sql`
- Execution Guide: `TASK1_EXECUTION_GUIDE.md` (this file)
- Continuation Guide: `WINDOWS_CONTINUATION_GUIDE.md`
- Task List: `EXECUTION_TASK_LIST.md`

---

**Ready to Execute!** 🚀

Once you've executed the migration, update the status in `WINDOWS_CONTINUATION_GUIDE.md` and proceed with testing.
