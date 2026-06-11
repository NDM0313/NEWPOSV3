# Build release APK on Windows (mirrors build-release-apk.sh)
$ErrorActionPreference = "Stop"
$AppDir = Split-Path $PSScriptRoot -Parent
$Root = Split-Path $AppDir -Parent
Set-Location $AppDir

$Flutter = if ($env:FLUTTER_ROOT) {
    Join-Path $env:FLUTTER_ROOT "bin\flutter.bat"
} elseif (Test-Path "C:\Users\ndm31\dev\flutter\bin\flutter.bat") {
    "C:\Users\ndm31\dev\flutter\bin\flutter.bat"
} else {
    "flutter"
}

& $Flutter pub get
& $Flutter analyze --no-fatal-infos
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$key = $null
foreach ($candidate in @(
    (Join-Path $Root ".env.production"),
    (Join-Path $Root ".env.local"),
    (Join-Path $Root "erp-mobile-app\.env.production")
)) {
    if (Test-Path $candidate) {
        $line = Select-String -Path $candidate -Pattern '^VITE_SUPABASE_ANON_KEY=' | Select-Object -First 1
        if ($line) {
            $key = ($line.Line -replace '^VITE_SUPABASE_ANON_KEY=', '').Trim().Trim('"').Trim("'")
            break
        }
    }
}
if (-not $key) { Write-Error "VITE_SUPABASE_ANON_KEY not found in env files." }

& $Flutter build apk --release --dart-define=SUPABASE_ANON_KEY=$key
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$releases = Join-Path $AppDir "releases"
New-Item -ItemType Directory -Force -Path $releases | Out-Null
$pubspec = Get-Content (Join-Path $AppDir "pubspec.yaml") -Raw
$version = if ($pubspec -match 'version:\s*(\S+)') { $Matches[1] } else { "unknown" }
$apk = Join-Path $AppDir "build\app\outputs\flutter-apk\app-release.apk"
$dest = Join-Path $releases "erp-flutter-$version.apk"
Copy-Item $apk $dest -Force
Write-Host "APK: $dest"
Write-Host "Configure android/key.properties for release signing (see key.properties.example)."
