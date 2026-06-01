# Full Phase 13 deploy: rollback ALL imported data, then re-import ALL phases.
# Non-interactive (uses --yes on rollback). Requires .env.migration with service role.
#
# Usage:
#   .\deploy-all.ps1
#   .\deploy-all.ps1 -SkipRollback    # import only (no delete first)
#   .\deploy-all.ps1 -RollbackOnly    # delete only

param(
  [switch]$SkipRollback,
  [switch]$RollbackOnly,
  [switch]$ImportOnly,
  [switch]$DryRunOnly
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

if ($ImportOnly) { $SkipRollback = $true }
if ($RollbackOnly) { $SkipRollback = $false; $ImportOnly = $false }

Write-Host "Phase 13 deploy-all (rollback + import)" -ForegroundColor Green
Write-Host "  company: from .env.migration TARGET_COMPANY_ID" -ForegroundColor Gray

if (-not $SkipRollback) {
  Write-Host "`n========== ROLLBACK (all imported data) ==========" -ForegroundColor Magenta
  if ($DryRunOnly) {
    & "$ScriptDir\run-rollback.ps1" -DryRunOnly -All
  } else {
    & "$ScriptDir\run-rollback.ps1" -ConfirmOnly -All -Yes
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($RollbackOnly -or $DryRunOnly) {
  $stopLabel = if ($DryRunOnly) { 'dry-run' } else { 'rollback-only' }
  Write-Host "`nStopped after rollback ($stopLabel)." -ForegroundColor Yellow
  exit 0
}

Write-Host "`n========== IMPORT (all phases) ==========" -ForegroundColor Magenta
if ($DryRunOnly) {
  & "$ScriptDir\run-import.ps1" -DryRunOnly
} else {
  & "$ScriptDir\run-import.ps1" -ConfirmOnly
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nDeploy-all finished. Check output/import_report.json" -ForegroundColor Green
