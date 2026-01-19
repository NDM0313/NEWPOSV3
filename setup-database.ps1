# ============================================
# 🎯 SUPABASE DATABASE SETUP SCRIPT
# ============================================
# PowerShell script to automatically setup Supabase database

$connectionString = "postgresql://postgres.pcxfwmbcjrkgzibgdrlz:khan313ndm313@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
$schemaFile = "supabase-schema.sql"
$demoDataFile = "supabase-demo-data.sql"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DIN COLLECTION ERP - DATABASE SETUP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "⚠️  psql not found in PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install PostgreSQL client or use Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host "  1. Go to Supabase Dashboard → SQL Editor" -ForegroundColor Yellow
    Write-Host "  2. Copy content from supabase-schema.sql" -ForegroundColor Yellow
    Write-Host "  3. Run it, then copy supabase-demo-data.sql and run it" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or install PostgreSQL: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ psql found: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Check if schema file exists
if (-not (Test-Path $schemaFile)) {
    Write-Host "❌ Error: $schemaFile not found!" -ForegroundColor Red
    exit 1
}

# Check if demo data file exists
if (-not (Test-Path $demoDataFile)) {
    Write-Host "❌ Error: $demoDataFile not found!" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Step 1: Creating database schema..." -ForegroundColor Cyan
Write-Host "   Executing: $schemaFile" -ForegroundColor Gray

try {
    $schemaResult = & psql $connectionString -f $schemaFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Schema created successfully!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Schema execution completed with warnings/errors" -ForegroundColor Yellow
        Write-Host $schemaResult -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error creating schema: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📊 Step 2: Inserting demo data..." -ForegroundColor Cyan
Write-Host "   Executing: $demoDataFile" -ForegroundColor Gray

try {
    $dataResult = & psql $connectionString -f $demoDataFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Demo data inserted successfully!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Data insertion completed with warnings/errors" -ForegroundColor Yellow
        Write-Host $dataResult -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error inserting data: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Step 3: Verifying data..." -ForegroundColor Cyan

try {
    $verifyQuery = @"
SELECT 
    'Branches' as table_name, COUNT(*)::text as count FROM branches
UNION ALL SELECT 'Accounts', COUNT(*)::text FROM accounts
UNION ALL SELECT 'Contacts', COUNT(*)::text FROM contacts
UNION ALL SELECT 'Products', COUNT(*)::text FROM products
UNION ALL SELECT 'Sales', COUNT(*)::text FROM sales
UNION ALL SELECT 'Purchases', COUNT(*)::text FROM purchases
UNION ALL SELECT 'Expenses', COUNT(*)::text FROM expenses
UNION ALL SELECT 'Rentals', COUNT(*)::text FROM rentals
UNION ALL SELECT 'Studio Sales', COUNT(*)::text FROM studio_sales
UNION ALL SELECT 'Accounting Entries', COUNT(*)::text FROM accounting_entries
UNION ALL SELECT 'Payments', COUNT(*)::text FROM payments
UNION ALL SELECT 'Stock Movements', COUNT(*)::text FROM stock_movements
UNION ALL SELECT 'Numbering Rules', COUNT(*)::text FROM numbering_rules
UNION ALL SELECT 'Settings', COUNT(*)::text FROM settings
UNION ALL SELECT 'Users', COUNT(*)::text FROM users
ORDER BY table_name;
"@
    
    $verifyResult = & psql $connectionString -c $verifyQuery 2>&1
    
    Write-Host ""
    Write-Host "📊 Database Summary:" -ForegroundColor Cyan
    Write-Host $verifyResult -ForegroundColor White
    
} catch {
    Write-Host "⚠️  Could not verify data: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ✅ DATABASE SETUP COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Install Supabase client: npm install @supabase/supabase-js" -ForegroundColor White
Write-Host "  2. Get Supabase URL and Key from Dashboard" -ForegroundColor White
Write-Host "  3. Create .env file with credentials" -ForegroundColor White
Write-Host "  4. Update contexts to use Supabase" -ForegroundColor White
Write-Host ""
