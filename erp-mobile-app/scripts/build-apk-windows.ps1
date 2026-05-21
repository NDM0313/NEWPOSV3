<#!
  Build ERP Mobile Android APK on Windows (Capacitor + Gradle).
  Run from erp-mobile-app:  powershell -ExecutionPolicy Bypass -File .\scripts\build-apk-windows.ps1

  Prerequisites: Node/npm, JDK 17 (JAVA_HOME), Android SDK, android/local.properties with sdk.dir
#>
param(
  [ValidateSet('Debug', 'Release')][string] $Configuration = 'Debug',
  [switch] $Production,
  [switch] $SkipSync
)

$ErrorActionPreference = 'Stop'
$AppRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $AppRoot

Write-Host "== ERP Mobile Windows APK builder ==" -ForegroundColor Cyan
Write-Host "App root: $AppRoot"
Write-Host "Configuration: $Configuration  ProductionWebBuild: $($Production.IsPresent)  SkipSync: $($SkipSync.IsPresent)"

if ($Production) {
  node (Join-Path $AppRoot 'scripts\sync-env-production-from-local.mjs')
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  node (Join-Path $AppRoot 'scripts\verify-mobile-build-env.mjs')
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $SkipSync) {
  if ($Production) {
    npm run cap:sync:android:prod
  } else {
    npm run cap:sync:android
  }
} else {
  Write-Host "Skipping cap sync (--SkipSync)." -ForegroundColor Yellow
}

$AndroidDir = Join-Path $AppRoot 'android'
if (-not (Test-Path (Join-Path $AndroidDir 'gradlew.bat'))) {
  throw "gradlew.bat not found under android/. Run from erp-mobile-app or re-add Capacitor android platform."
}

Set-Location $AndroidDir
$gradleArgs = if ($Configuration -eq 'Debug') { 'assembleDebug' } else { 'assembleRelease' }
Write-Host "Running: gradlew.bat $gradleArgs" -ForegroundColor Cyan
& .\gradlew.bat $gradleArgs
if ($LASTEXITCODE -ne 0) { throw "Gradle failed with exit code $LASTEXITCODE" }

Set-Location $AppRoot
$outBase = Join-Path $AppRoot 'android\app\build\outputs\apk'
if ($Configuration -eq 'Debug') {
  $apk = Join-Path $outBase 'debug\app-debug.apk'
} else {
  $relDir = Join-Path $outBase 'release'
  $apk = Get-ChildItem -Path $relDir -Filter '*.apk' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}

Write-Host ""
Write-Host "Build finished." -ForegroundColor Green
if ($apk -and (Test-Path $apk)) {
  Write-Host "APK: $apk" -ForegroundColor Green
  if ($Configuration -eq 'Release') {
    node (Join-Path $AppRoot 'scripts\copy-release-apk.mjs')
  }
  Write-Host "Tip: update erp-mobile-app/releases/APK_UPDATE.md for your release notes."
} else {
  Write-Host "Check outputs under: $outBase" -ForegroundColor Yellow
}
