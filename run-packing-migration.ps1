# ============================================================================
# PowerShell Script: Execute Packing Columns Migration
# ============================================================================
# Purpose: Execute SQL migration to add packing columns
# Date: January 2026
# Platform: Windows PowerShell
# ============================================================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  PACKING COLUMNS MIGRATION SCRIPT" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# STEP 1: Check if migration file exists
# ============================================================================
$migrationFile = "supabase-extract\migrations\add_packing_columns.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ ERROR: Migration file not found!" -ForegroundColor Red
    Write-Host "   Expected location: $migrationFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please ensure the file exists before running this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Migration file found: $migrationFile" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 2: Display migration file contents
# ============================================================================
Write-Host "Migration SQL to be executed:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Get-Content $migrationFile | Write-Host
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# STEP 3: Prompt for Supabase connection details
# ============================================================================
Write-Host "Supabase Connection Details:" -ForegroundColor Cyan
Write-Host ""

$hostName = Read-Host "Enter Supabase host (e.g., abcdefghijklmno.supabase.co)"
$port = Read-Host "Enter port (default: 6543)" 
if ([string]::IsNullOrWhiteSpace($port)) { $port = "6543" }
$database = Read-Host "Enter database name (default: postgres)"
if ([string]::IsNullOrWhiteSpace($database)) { $database = "postgres" }
$username = Read-Host "Enter username (e.g., postgres.abcdefghijklmno)"
$password = Read-Host "Enter password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
)

Write-Host ""

# ============================================================================
# STEP 4: Check if psql is available
# ============================================================================
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "⚠️  WARNING: psql command not found!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please choose one of the following options:" -ForegroundColor Cyan
    Write-Host "  1. Install PostgreSQL client tools" -ForegroundColor White
    Write-Host "  2. Use Supabase Dashboard SQL Editor (Recommended)" -ForegroundColor White
    Write-Host ""
    Write-Host "For Supabase Dashboard:" -ForegroundColor Cyan
    Write-Host "  1. Go to: https://app.supabase.com/" -ForegroundColor White
    Write-Host "  2. Select your project" -ForegroundColor White
    Write-Host "  3. Go to SQL Editor" -ForegroundColor White
    Write-Host "  4. Copy contents of: $migrationFile" -ForegroundColor White
    Write-Host "  5. Paste and execute" -ForegroundColor White
    Write-Host ""
    
    # Open migration file in default editor
    $openFile = Read-Host "Open migration file in editor? (Y/N)"
    if ($openFile -eq "Y" -or $openFile -eq "y") {
        Start-Process notepad.exe -ArgumentList $migrationFile
    }
    
    exit 0
}

Write-Host "✅ psql found: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 5: Set environment variables
# ============================================================================
$env:PGHOST = $hostName
$env:PGPORT = $port
$env:PGDATABASE = $database
$env:PGUSER = $username
$env:PGPASSWORD = $plainPassword

Write-Host "Connection details set:" -ForegroundColor Cyan
Write-Host "  Host: $hostName" -ForegroundColor White
Write-Host "  Port: $port" -ForegroundColor White
Write-Host "  Database: $database" -ForegroundColor White
Write-Host "  User: $username" -ForegroundColor White
Write-Host ""

# ============================================================================
# STEP 6: Confirm execution
# ============================================================================
$confirm = Read-Host "Execute migration? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Migration cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Executing migration..." -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# STEP 7: Execute migration
# ============================================================================
try {
    $result = & psql -h $hostName -p $port -U $username -d $database -f $migrationFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "  ✅ MIGRATION EXECUTED SUCCESSFULLY!" -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Run verification script: verify-packing-migration.sql" -ForegroundColor White
        Write-Host "  2. Test packing feature in Sales/Purchases forms" -ForegroundColor White
        Write-Host "  3. Verify data persists after page refresh" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Red
        Write-Host "  ❌ MIGRATION FAILED!" -ForegroundColor Red
        Write-Host "============================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Error output:" -ForegroundColor Yellow
        $result | Write-Host
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Cyan
        Write-Host "  1. Check connection details are correct" -ForegroundColor White
        Write-Host "  2. Verify user has ALTER TABLE permissions" -ForegroundColor White
        Write-Host "  3. Check if columns already exist (may be OK)" -ForegroundColor White
        Write-Host "  4. Try executing SQL directly in Supabase Dashboard" -ForegroundColor White
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "  ❌ ERROR EXECUTING MIGRATION!" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please try executing the SQL manually in Supabase Dashboard." -ForegroundColor Yellow
    Write-Host ""
    exit 1
} finally {
    # Clear password from environment
    $env:PGPASSWORD = ""
    $plainPassword = $null
}

Write-Host ""
Write-Host "Script completed." -ForegroundColor Green
Write-Host ""
