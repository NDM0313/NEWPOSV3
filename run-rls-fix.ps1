# ============================================================================
# RUN RLS FIX SQL SCRIPT
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Running RLS Fix SQL Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Database connection parameters
$dbHost = "aws-1-ap-southeast-1.pooler.supabase.com"
$dbPort = "6543"
$dbUser = "postgres.pcxfwmbcjrkgzibgdrlz"
$dbPassword = "khan313ndm313"
$dbName = "postgres"

# Set environment variables for psql
$env:PGPASSWORD = $dbPassword
$env:PGHOST = $dbHost
$env:PGPORT = $dbPort
$env:PGUSER = $dbUser
$env:PGDATABASE = $dbName

# SQL file path
$sqlFile = "fix-rls-remove-recursion.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Error: $sqlFile not found!" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Running SQL file: $sqlFile" -ForegroundColor Yellow
Write-Host ""

try {
    # Run SQL file
    Get-Content $sqlFile | psql
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ RLS Fix SQL executed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Error executing SQL file" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  RLS Fix Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
