# Build release APK for erp-flutter-v2 (Windows)
# Reads VITE_SUPABASE_ANON_KEY from repo .env files

$ErrorActionPreference = "Stop"
$AppDir = Split-Path $PSScriptRoot -Parent
$Root = Split-Path $AppDir -Parent
Set-Location $AppDir

function Get-AnonKey {
    $candidates = @(
        (Join-Path $Root ".env.production"),
        (Join-Path $Root ".env.local"),
        (Join-Path $Root "erp-mobile-app\.env.production")
    )
    foreach ($f in $candidates) {
        if (Test-Path $f) {
            foreach ($line in Get-Content $f) {
                if ($line -match '^\s*VITE_SUPABASE_ANON_KEY\s*=\s*(.+)\s*$') {
                    return $Matches[1].Trim().Trim('"').Trim("'")
                }
            }
        }
    }
    throw "VITE_SUPABASE_ANON_KEY not found in .env.production / .env.local / erp-mobile-app/.env.production"
}

$key = Get-AnonKey
Write-Host "Running flutter analyze..."
flutter analyze
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building release APK..."
flutter build apk --release --dart-define=SUPABASE_ANON_KEY="$key"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $AppDir "build\app\outputs\flutter-apk\app-release.apk"
$releases = Join-Path $AppDir "releases"
New-Item -ItemType Directory -Force -Path $releases | Out-Null
$dest = Join-Path $releases ("erp-flutter-v2-" + (Get-Date -Format "yyyyMMdd-HHmm") + ".apk")
Copy-Item $apk $dest -Force
Write-Host "APK copied to $dest"
