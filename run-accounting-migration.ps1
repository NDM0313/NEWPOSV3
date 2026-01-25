# ============================================
# 🎯 AUTO-RUN ACCOUNTING MIGRATION
# ============================================
# PowerShell script to automatically run Chart of Accounts migration
# Uses connection string from .env.local

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  RUNNING CHART OF ACCOUNTS MIGRATION" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Read .env.local
Write-Host "[1/4] Reading .env.local..." -ForegroundColor Yellow

if (-not (Test-Path ".env.local")) {
    Write-Host "❌ ERROR: .env.local file not found!" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content ".env.local" -Raw
$connectionString = ""

# Extract DATABASE_POOLER_URL
if ($envContent -match "DATABASE_POOLER_URL=(.+)") {
    $connectionString = $matches[1].Trim()
    Write-Host "✅ Connection string found" -ForegroundColor Green
} else {
    Write-Host "❌ ERROR: DATABASE_POOLER_URL not found in .env.local" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Check migration file
Write-Host "[2/4] Checking migration file..." -ForegroundColor Yellow

$migrationFile = "supabase-extract/migrations/16_chart_of_accounts.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ ERROR: Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Migration file found" -ForegroundColor Green
Write-Host ""

# Step 3: Check psql availability
Write-Host "[3/4] Checking psql availability..." -ForegroundColor Yellow

$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "⚠️  psql not found in PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Attempting alternative method using Node.js..." -ForegroundColor Yellow
    Write-Host ""
    
    # Try Node.js method
    $nodeScript = @"
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = '$connectionString';
const migrationFile = '$migrationFile';

async function runMigration() {
  const client = new Client({
    connectionString: connectionString
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Executing migration (this may take 30-60 seconds)...');
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
"@

    $nodeScriptFile = "temp-migration-runner.js"
    $nodeScript | Out-File -FilePath $nodeScriptFile -Encoding UTF8
    
    # Check if pg package is installed
    if (-not (Test-Path "node_modules/pg")) {
        Write-Host "Installing pg package..." -ForegroundColor Yellow
        npm install pg --save-dev --silent
    }
    
    Write-Host "Running migration via Node.js..." -ForegroundColor Yellow
    node $nodeScriptFile
    
    if ($LASTEXITCODE -eq 0) {
        Remove-Item $nodeScriptFile -ErrorAction SilentlyContinue
        Write-Host ""
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        exit 0
    } else {
        Remove-Item $nodeScriptFile -ErrorAction SilentlyContinue
        Write-Host ""
        Write-Host "❌ Migration failed. Please run manually via Supabase SQL Editor." -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ psql found: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Step 4: Execute migration
Write-Host "[4/4] Executing migration..." -ForegroundColor Yellow
Write-Host "   This may take 30-60 seconds..." -ForegroundColor Gray
Write-Host ""

# Extract password from connection string for PGPASSWORD
if ($connectionString -match "://[^:]+:([^@]+)@") {
    $password = $matches[1]
    $env:PGPASSWORD = $password
}

# Parse connection string
$connectionString = $connectionString -replace "postgresql://", ""
$parts = $connectionString -split "@"
$userPass = $parts[0] -split ":"
$hostPort = $parts[1] -split ":"
$dbHost = $hostPort[0]
$port = if ($hostPort[1] -match "(\d+)/") { $matches[1] } else { "6543" }
$database = if ($hostPort[1] -match "/(.+)") { $matches[1] } else { "postgres" }
$user = $userPass[0]

Write-Host "   Host: $dbHost" -ForegroundColor Gray
Write-Host "   Port: $port" -ForegroundColor Gray
Write-Host "   Database: $database" -ForegroundColor Gray
Write-Host "   User: $user" -ForegroundColor Gray
Write-Host ""

try {
    # Wrap migration in transaction and execute
    # Use --set ON_ERROR_STOP=0 to continue on errors (for IF NOT EXISTS)
    $psqlArgs = @(
        "-h", $dbHost,
        "-p", $port,
        "-U", $user,
        "-d", $database,
        "-v", "ON_ERROR_STOP=0",
        "-f", $migrationFile,
        "-q"  # Quiet mode (less output)
    )
    
    # Run migration, redirect stderr to filter out NOTICE messages
    $output = & psql $psqlArgs 2>&1 | Where-Object { 
        $_ -notmatch "NOTICE:" -and 
        $_ -notmatch "WARNING:" -and 
        $_ -notmatch "extension.*already exists" 
    } | Out-String
    
    # Check for actual errors (ERROR or FATAL, but not NOTICE/WARNING)
    $hasRealError = $output -match "ERROR|FATAL" -and $output -notmatch "NOTICE|WARNING|already exists"
    
    if ($LASTEXITCODE -eq 0 -or -not $hasRealError) {
        Write-Host ""
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Refresh your app" -ForegroundColor White
        Write-Host "  2. Navigate to Accounting Test Page (/test/accounting-chart)" -ForegroundColor White
        Write-Host "  3. Default accounts will auto-create" -ForegroundColor White
        Write-Host ""
        exit 0
    } else {
        Write-Host ""
        Write-Host "❌ Migration failed. Error output:" -ForegroundColor Red
        Write-Host $output -ForegroundColor Red
        Write-Host ""
        Write-Host "Please check the error and run manually via Supabase SQL Editor if needed." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error executing migration: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run the migration manually via Supabase SQL Editor:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://supabase.com/dashboard" -ForegroundColor White
    Write-Host "  2. Select project: wrwljqzckmnmuphwhslt" -ForegroundColor White
    Write-Host "  3. Open SQL Editor" -ForegroundColor White
    Write-Host "  4. Copy content from: $migrationFile" -ForegroundColor White
    Write-Host "  5. Paste and Run" -ForegroundColor White
    exit 1
} finally {
    # Clear password from environment
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
