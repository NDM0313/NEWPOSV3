# Phase 13 rollback — non-interactive when -Yes is set
# Usage:
#   .\run-rollback.ps1 -DryRunOnly -All
#   .\run-rollback.ps1 -ConfirmOnly -All -Yes
#   .\run-rollback.ps1 -ConfirmOnly -JournalsOnly -Yes

param(
  [switch]$All,
  [switch]$JournalsOnly,
  [switch]$DryRunOnly,
  [switch]$ConfirmOnly,
  [switch]$Yes,
  [string]$TargetCompanyId = ""
)

$ErrorActionPreference = "Stop"

if ($All -and $JournalsOnly) {
  Write-Error "Use only one of -All or -JournalsOnly"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$RollbackScript = Join-Path $ScriptDir "rollbackImport.js"
$modeArgs = @()
if ($All) { $modeArgs = @("--all") }
elseif ($JournalsOnly) { $modeArgs = @("--journals-only") }
else { $modeArgs = @("--all") }

$companyArgs = @()
if ($TargetCompanyId) {
  $companyArgs = @("--target-company-id", $TargetCompanyId)
}

$yesArgs = @()
if ($Yes) { $yesArgs = @("--yes") }

function Invoke-Rollback([string[]]$extraArgs) {
  $allArgs = @($RollbackScript) + $companyArgs + $modeArgs + $yesArgs + $extraArgs
  Write-Host "> node $($allArgs -join ' ')" -ForegroundColor Cyan
  & node @allArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Phase 13 rollback runner (cwd: $ScriptDir)" -ForegroundColor Green

if (-not $ConfirmOnly) {
  Write-Host "`n=== Step 1: dry-run ===" -ForegroundColor Yellow
  Invoke-Rollback @("--dry-run")
}

if (-not $DryRunOnly) {
  Write-Host "`n=== Step 2: live rollback (--confirm) ===" -ForegroundColor Yellow
  Invoke-Rollback @("--confirm")
}

Write-Host "`nRollback runner finished." -ForegroundColor Green
