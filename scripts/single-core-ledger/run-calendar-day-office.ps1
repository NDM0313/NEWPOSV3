# Calendar Stability Day runner (OLD ERP) — parameterized Day 4+
# Passwords: shell-only OR gitignored .env.qa.local (never commit).
param(
  [Parameter(Mandatory = $true)]
  [int]$CalendarDay,
  [Parameter(Mandatory = $true)]
  [string]$FolderDate,
  [Parameter(Mandatory = $true)]
  [int]$CalendarDaysElapsed
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

function Load-DotEnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length - 2) }
    Set-Item -Path "env:$key" -Value $val
  }
}

Load-DotEnvFile (Join-Path $Root '.env.qa.local')

$hasChina = [bool]$env:QA_BROWSER_PASSWORD_CHINA
$hasBridal = [bool]$env:QA_BROWSER_PASSWORD_BRIDAL
$hasCouture = [bool]$env:QA_BROWSER_PASSWORD_COUTURE
$hasGeneric = $env:ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK -eq 'true' -and [bool]$env:QA_BROWSER_PASSWORD

if (-not ($hasChina -and $hasBridal -and $hasCouture) -and -not $hasGeneric) {
  Write-Host 'Missing QA browser passwords.'
  exit 1
}

if ($hasChina) { Write-Host 'CHINA password env present' }
if ($hasBridal) { Write-Host 'BRIDAL password env present' }
if ($hasCouture) { Write-Host 'COUTURE password env present' }

$runStart = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
$runLocalDate = Get-Date -Format 'yyyy-MM-dd'
Write-Host "=== Calendar Day $CalendarDay start: $runStart ==="

npm run monitor:three-company-unified-ledger
if ($LASTEXITCODE -ne 0) { throw 'monitor:three-company-unified-ledger FAILED' }

$latestJson = Join-Path $Root 'reports/single-core-ledger/operational-monitoring/latest-three-company-monitoring.json'
if (-not (Test-Path $latestJson)) { throw "Missing $latestJson" }
$monitorPayload = Get-Content $latestJson -Raw | ConvertFrom-Json
$artifactRel = "reports/single-core-ledger/operational-monitoring/three-company-monitoring-$($monitorPayload.timestamp_slug).json"

npm run test:unified-ledger 2>&1 | Tee-Object -Variable unifiedOut | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'test:unified-ledger FAILED' }
$unifiedMatch = [regex]::Match(($unifiedOut -join "`n"), 'tests (\d+)')
$unifiedCount = if ($unifiedMatch.Success) { "$($unifiedMatch.Groups[1].Value)/$($unifiedMatch.Groups[1].Value)_PASS" } else { 'PASS' }

npm run test:unit 2>&1 | Tee-Object -Variable unitOut | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'test:unit FAILED' }
$unitMatch = [regex]::Match(($unitOut -join "`n"), 'pass (\d+)')
$unitCount = if ($unitMatch.Success) { "$($unitMatch.Groups[1].Value)/$($unitMatch.Groups[1].Value)_PASS" } else { 'PASS' }

npm run build 2>&1 | ForEach-Object { Write-Host $_ }
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0) { throw 'build FAILED' }

$runEnd = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
$head = (git rev-parse HEAD).Trim()
$originMain = (git rev-parse origin/main).Trim()

node scripts/single-core-ledger/generate-calendar-stability-evidence.mjs `
  --folder-date $FolderDate `
  --calendar-day $CalendarDay `
  --calendar-days-elapsed $CalendarDaysElapsed `
  --run-local-date $runLocalDate `
  --monitoring-artifact $artifactRel `
  --unified $unifiedCount `
  --unit $unitCount `
  --build PASS `
  --head $head `
  --origin-main $originMain `
  --run-start $runStart `
  --run-end $runEnd

Write-Host "=== Calendar Day $CalendarDay complete: $runEnd ==="
Write-Host "Evidence: reports/single-core-engine-calendar-stability-$FolderDate/"
