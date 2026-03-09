# Full PostgreSQL backup before production release (STEP 9).
# Requires: PRODUCTION_DATABASE_URL or DATABASE_URL in .env.local (use production connection).
# Usage: .\scripts\backup-production-db.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$envPath = Join-Path $root ".env.local"
$backupDir = Join-Path $root "backups"

if (-not (Test-Path $envPath)) {
    Write-Error ".env.local not found. Create it with PRODUCTION_DATABASE_URL (or DATABASE_URL) for production."
    exit 1
}
# Load PRODUCTION_DATABASE_URL or DATABASE_URL
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $k = $matches[1].Trim()
        $v = $matches[2].Trim().Trim('"').Trim("'")
        if (-not [Environment]::GetEnvironmentVariable($k, "Process")) { [Environment]::SetEnvironmentVariable($k, $v, "Process") }
    }
}
$conn = $env:PRODUCTION_DATABASE_URL
if (-not $conn) { $conn = $env:DATABASE_URL }
if (-not $conn) {
    Write-Error "Set PRODUCTION_DATABASE_URL or DATABASE_URL in .env.local for the database to backup."
    exit 1
}
if (-not $env:PRODUCTION_DATABASE_URL -and $env:DATABASE_URL) {
    Write-Host "Note: Using DATABASE_URL (PRODUCTION_DATABASE_URL not set). For production backup, set PRODUCTION_DATABASE_URL."
}

if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$file = Join-Path $backupDir "production_pre_sale_final_trigger_$timestamp.sql"
Write-Host "Backing up production DB to $file"
& pg_dump $conn -F p -f $file
if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump failed"; exit 1 }
Write-Host "Backup complete: $file"
