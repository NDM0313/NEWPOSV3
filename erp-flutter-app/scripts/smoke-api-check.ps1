# PowerShell smoke check for Flutter ERP (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$EnvFile = $null
foreach ($candidate in @(
    (Join-Path $Root ".env.production"),
    (Join-Path $Root ".env.local"),
    (Join-Path $Root "erp-mobile-app\.env.production")
)) {
    if (Test-Path $candidate) { $EnvFile = $candidate; break }
}
if (-not $EnvFile) {
    Write-Error "No env file with VITE_SUPABASE_ANON_KEY found."
}
$content = Get-Content $EnvFile -Raw
if ($content -notmatch 'VITE_SUPABASE_ANON_KEY=(.+)') {
    Write-Error "VITE_SUPABASE_ANON_KEY missing in $EnvFile"
}
$key = $Matches[1].Trim().Trim('"').Trim("'")
if ($key.Length -lt 100) {
    Write-Error "Anon key looks too short ($($key.Length) chars). Use production Kong key."
}
Write-Host "Env file: $EnvFile"
Write-Host "Anon key length: $($key.Length)"

$resp = Invoke-WebRequest -Uri "https://erp.dincouture.pk" -UseBasicParsing -TimeoutSec 15
Write-Host "HTTPS erp.dincouture.pk: $($resp.StatusCode)"
Write-Host "Smoke OK"
