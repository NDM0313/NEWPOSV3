# PowerShell Script: Apply Schema via Direct PostgreSQL Connection
# Date: 2026-01-20

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "APPLYING SCHEMA TO NEW SUPABASE DATABASE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$schemaFile = "supabase-extract/migrations/03_frontend_driven_schema.sql"

if (-not (Test-Path $schemaFile)) {
    Write-Host "ERROR: Schema file not found: $schemaFile" -ForegroundColor Red
    exit 1
}

Write-Host "[1/3] Checking psql availability..." -ForegroundColor Yellow

$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "ERROR: psql not found in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL client or apply schema manually via Supabase SQL Editor" -ForegroundColor Yellow
    exit 1
}

Write-Host "SUCCESS: psql found" -ForegroundColor Green
Write-Host ""

Write-Host "[2/3] Setting up connection..." -ForegroundColor Yellow

$dbHost = "db.wrwljqzckmnmuphwhslt.supabase.co"
$dbPort = "5432"
$dbName = "postgres"
$dbUser = "postgres"
$dbPassword = "khan313ndm313"

$env:PGPASSWORD = $dbPassword

Write-Host "SUCCESS: Connection configured" -ForegroundColor Green
Write-Host ""

Write-Host "[3/3] Applying schema..." -ForegroundColor Yellow
Write-Host "   This may take 30-60 seconds..." -ForegroundColor Gray
Write-Host ""

$result = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $schemaFile 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Schema applied successfully!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Verifying tables..." -ForegroundColor Yellow
    $verifyQuery = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
    $verifyResult = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $verifyQuery 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $tableCount = $verifyResult.Trim()
        Write-Host "SUCCESS: Tables created: $tableCount" -ForegroundColor Green
    }
} else {
    Write-Host "ERROR: Failed to apply schema" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    Write-Host ""
    Write-Host "Please apply schema manually via Supabase SQL Editor" -ForegroundColor Yellow
    exit 1
}

Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Restart dev server to load new .env.local" -ForegroundColor White
Write-Host "2. Test connection by creating a new business" -ForegroundColor White
Write-Host ""
