# Publish ERP Mobile 1.0.1 build 2 to GitHub Releases (requires GitHub CLI).
# Run from anywhere: powershell -ExecutionPolicy Bypass -File .\erp-mobile-app\releases\publish-github-release.ps1
# Prereqs: https://cli.github.com/  then  gh auth login

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir '..\..')
Set-Location $RepoRoot

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
  Write-Error "GitHub CLI (gh) not found. Install from https://cli.github.com/ and add to PATH, then run: gh auth login"
}

$apk = Join-Path $ScriptDir 'erp-mobile-1.0.1-build2.apk'
if (-not (Test-Path $apk)) {
  $built = Join-Path $RepoRoot 'erp-mobile-app\android\app\build\outputs\apk\release\app-release.apk'
  if (-not (Test-Path $built)) {
    Write-Error "No APK at $apk or $built. Build first: erp-mobile-app\\scripts\\build-apk-windows.ps1 -Configuration Release -Production"
  }
  Write-Host "Copying release APK to releases folder..." -ForegroundColor Yellow
  Copy-Item $built $apk -Force
}

$notes = Join-Path $ScriptDir 'GH_RELEASE_NOTES_mobile-v1.0.1-build2.md'
if (-not (Test-Path $notes)) {
  Write-Error "Missing release notes: $notes"
}

Write-Host "Creating GitHub release tag mobile-v1.0.1-build2 ..." -ForegroundColor Cyan
& gh release create mobile-v1.0.1-build2 `
  --title "ERP Mobile 1.0.1 (build 2) — Shared counter PIN" `
  --notes-file $notes `
  $apk

Write-Host "Done. See https://github.com/NDM0313/NEWPOSV3/releases/tag/mobile-v1.0.1-build2" -ForegroundColor Green
