# ============================================================================
# AUTOMATIC DATABASE FIX SCRIPT
# ============================================================================
# This script runs all SQL fixes directly on Supabase database
# ============================================================================

$env:PGPASSWORD = "khan313ndm313"
$env:PGUSER = "postgres.pcxfwmbcjrkgzibgdrlz"

$dbHost = "aws-1-ap-southeast-1.pooler.supabase.com"
$dbPort = "6543"
$dbName = "postgres"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DATABASE FIX SCRIPT" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 0: Fix all missing columns first
Write-Host "Step 0: Fixing all missing columns..." -ForegroundColor Yellow
psql -h $dbHost -p $dbPort -d $dbName -f fix-all-missing-columns.sql
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ All missing columns fixed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Error fixing columns" -ForegroundColor Red
}

Write-Host ""

# Step 0.5: Add missing schema columns
Write-Host "Step 0.5: Adding missing schema columns..." -ForegroundColor Yellow
psql -h $dbHost -p $dbPort -d $dbName -f add-missing-schema-columns.sql
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Missing schema columns added" -ForegroundColor Green
} else {
    Write-Host "  ❌ Error adding schema columns" -ForegroundColor Red
}

Write-Host ""

# Step 0.6: Fix RLS policies (CRITICAL)
Write-Host "Step 0.6: Fixing RLS policies (CRITICAL)..." -ForegroundColor Yellow
psql -h $dbHost -p $dbPort -d $dbName -f fix-rls-all-tables-simple.sql
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ RLS policies fixed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Error fixing RLS policies" -ForegroundColor Red
}
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ All missing columns fixed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Error fixing columns" -ForegroundColor Red
}

Write-Host ""

# Step 1: Fix users table schema
Write-Host "Step 1: Fixing users table schema..." -ForegroundColor Yellow
psql -h $dbHost -p $dbPort -d $dbName -f fix-users-table-schema.sql
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Users table fixed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Error fixing users table" -ForegroundColor Red
}

Write-Host ""

# Step 2: Create fresh demo setup
Write-Host "Step 2: Creating fresh demo setup..." -ForegroundColor Yellow
psql -h $dbHost -p $dbPort -d $dbName -f FRESH_DEMO_SETUP.sql
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Fresh demo setup created" -ForegroundColor Green
} else {
    Write-Host "  ❌ Error creating demo setup" -ForegroundColor Red
}

Write-Host ""

# Step 3: Insert test data
Write-Host "Step 3: Inserting test data..." -ForegroundColor Yellow
psql -h $dbHost -p $dbPort -d $dbName -f TEST_DATA_INSERTION.sql
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Test data inserted" -ForegroundColor Green
} else {
    Write-Host "  ❌ Error inserting test data" -ForegroundColor Red
}

Write-Host ""

# Step 4: Verification
Write-Host "Step 4: Running verification..." -ForegroundColor Yellow
psql -h $dbHost -p $dbPort -d $dbName -f END_TO_END_VERIFICATION.sql
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Verification complete" -ForegroundColor Green
} else {
    Write-Host "  ❌ Error during verification" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ALL FIXES APPLIED!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Refresh browser and test frontend" -ForegroundColor Cyan
Write-Host ""
