# Phase 13 Go-Live import — dry-run then live --confirm
# Usage (from repo root or migration-tools/):
#   .\migration-tools\run-import.ps1
#   .\run-import.ps1 -ConfirmOnly
#   .\run-import.ps1 -Phase contacts

param(
  [string]$TargetCompanyId = "",
  [ValidateSet("all", "contacts", "accounts", "products", "ledgers")]
  [string]$Phase = "all",
  [switch]$ConfirmOnly,
  [switch]$DryRunOnly,
  [int]$BatchSize = 100
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$ImportScript = Join-Path $ScriptDir "importToSupabase.js"
if (-not (Test-Path $ImportScript)) {
  Write-Error "importToSupabase.js not found at $ImportScript"
}

$companyArgs = @()
if ($TargetCompanyId) {
  $companyArgs = @("--target-company-id", $TargetCompanyId)
}

$phaseArgs = @()
if ($Phase -and $Phase -ne "all") {
  $phaseArgs = @("--phase", $Phase)
}

$batchArgs = @("--batch-size", [string]$BatchSize)

function Invoke-Import([string[]]$extraArgs) {
  $allArgs = @($ImportScript) + $companyArgs + $phaseArgs + $batchArgs + $extraArgs
  Write-Host "> node $($allArgs -join ' ')" -ForegroundColor Cyan
  & node @allArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Phase 13 import runner (cwd: $ScriptDir)" -ForegroundColor Green

if (-not $ConfirmOnly) {
  Write-Host "`n=== Step 1: dry-run ===" -ForegroundColor Yellow
  Invoke-Import @("--dry-run")
}

if (-not $DryRunOnly) {
  Write-Host "`n=== Step 2: live import (--confirm) ===" -ForegroundColor Yellow
  Invoke-Import @("--confirm")
}

Write-Host "`nDone. See output/import_report.json" -ForegroundColor Green
