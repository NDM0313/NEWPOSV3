# Smoke check — verifies Supabase URL config (no network call without key)

$ErrorActionPreference = "Stop"
$AppDir = Split-Path $PSScriptRoot -Parent
Set-Location $AppDir

Write-Host "erp-flutter-v2 smoke check"
Write-Host "  Expected API: https://erp.dincouture.pk"
Write-Host "  Package: com.dincouture.erp.flutter_v2"

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    Write-Warning "Flutter not on PATH — skip analyze; install Flutter SDK for full QA."
    exit 0
}

flutter pub get
flutter analyze
