# Run fresh data seed against Supabase Postgres (test/dev only)
# Usage: .\run_fresh_seed.ps1
# Or with custom URL: $env:DATABASE_URL = "postgresql://..."; .\run_fresh_seed.ps1

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SeedFile = Join-Path $ScriptDir "fresh_data_seed.sql"

# Use connection string from env (set DATABASE_URL or pass postgres URL)
$DbUrl = $env:DATABASE_URL
if (-not $DbUrl) {
  Write-Host "Set DATABASE_URL or run: `$env:DATABASE_URL = 'postgresql://user:pass@host:5432/postgres'; .\run_fresh_seed.ps1" -ForegroundColor Yellow
  exit 1
}

Write-Host "Running fresh seed from: $SeedFile" -ForegroundColor Cyan
Write-Host "Target: Supabase Postgres" -ForegroundColor Cyan

& psql $DbUrl -f $SeedFile
if ($LASTEXITCODE -eq 0) {
  Write-Host "Seed completed successfully." -ForegroundColor Green
} else {
  Write-Host "Seed failed (exit code $LASTEXITCODE). Check errors above." -ForegroundColor Red
  exit $LASTEXITCODE
}
