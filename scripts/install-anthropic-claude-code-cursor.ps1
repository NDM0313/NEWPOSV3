# Install Anthropic "Claude Code" for Cursor on Windows x64 with the correct platform VSIX.
# Cursor/VS Code Marketplace can serve gzip; saving without decompress yields a broken VSIX and
# the extension shows: "Unsupported platform: win32-x64. No compatible Claude Code binary found."
#
# Usage (from repo root):
#   .\scripts\install-anthropic-claude-code-cursor.ps1
#   .\scripts\install-anthropic-claude-code-cursor.ps1 -Version 2.1.101
#   .\scripts\install-anthropic-claude-code-cursor.ps1 -CursorExe "C:\Program Files\cursor\Cursor.exe"

param(
    [string]$Version = "",
    [string]$CursorExe = "cursor",
    [string]$TargetPlatform = "win32-x64",
    [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"
$Publisher = "anthropic"
$ExtensionSlug = "claude-code"
$ExtensionId = "$Publisher.$ExtensionSlug"

function Get-LatestMarketplaceVersion {
    $payload = @{
        filters     = @(
            @{
                criteria   = @(
                    @{ filterType = 7; value = $ExtensionId }
                )
                pageNumber = 1
                pageSize   = 1
            }
        )
        flags       = 914
    } | ConvertTo-Json -Depth 6 -Compress

    $headers = @{
        Accept       = "application/json;api-version=3.0-preview.1"
        "User-Agent" = "NEW-POSV3-install-script"
    }
    $uri = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=3.0-preview.1"
    $resp = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json; charset=utf-8" -Headers $headers -Body $payload
    $ver = $resp.results[0].extensions[0].versions[0].version
    if (-not $ver) { throw "Marketplace query returned no version for $ExtensionId." }
    return $ver
}

if (-not $Version) {
    Write-Host "[$ExtensionId] Resolving latest Marketplace version..." -ForegroundColor Cyan
    $Version = Get-LatestMarketplaceVersion
}
Write-Host "[$ExtensionId] Using version $Version (target: $TargetPlatform)." -ForegroundColor Cyan

if ($env:PROCESSOR_ARCHITECTURE -ne "AMD64" -and $TargetPlatform -eq "win32-x64") {
    Write-Host "[$ExtensionId] Warning: PROCESSOR_ARCHITECTURE is $($env:PROCESSOR_ARCHITECTURE); win32-x64 VSIX is for x64 Windows." -ForegroundColor Yellow
}

$vsixName = "${ExtensionId}-${Version}-${TargetPlatform}.vsix"
$vsixPath = Join-Path $env:TEMP $vsixName
$downloadUri = "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/$Publisher/vsextensions/$ExtensionSlug/$Version/vspackage?targetPlatform=$TargetPlatform"

Write-Host "[$ExtensionId] Downloading (gzip-safe)..." -ForegroundColor Cyan
# --compressed: decode Content-Encoding so the file on disk is a real ZIP/VSIX (PK header), not raw gzip.
& curl.exe -L --compressed -f -S -s -o $vsixPath $downloadUri
if ($LASTEXITCODE -ne 0) { throw "curl download failed with exit code $LASTEXITCODE." }

$magic = Get-Content -LiteralPath $vsixPath -Encoding Byte -TotalCount 4
if ([BitConverter]::ToString($magic) -ne "50-4B-03-04") {
    throw "Downloaded file is not a ZIP/VSIX (expected PK.. header). Try again or check network/VPN."
}

Write-Host "[$ExtensionId] Installing via '$CursorExe'..." -ForegroundColor Cyan
# Cursor's Node CLI writes DeprecationWarning to stderr; with $ErrorActionPreference Stop that becomes terminating.
$eaPrev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & $CursorExe --uninstall-extension $ExtensionId 2>&1 | Out-Null
    Start-Sleep -Seconds 1
    & $CursorExe --install-extension $vsixPath --force
    if ($LASTEXITCODE -ne 0) { throw "cursor --install-extension failed with exit code $LASTEXITCODE." }
} finally {
    $ErrorActionPreference = $eaPrev
}

if (-not $SkipVerify) {
    $root = Join-Path $env:USERPROFILE ".cursor\extensions"
    $dir = Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "${ExtensionId}-${Version}*" } |
        Select-Object -First 1
    if (-not $dir) {
        throw "Installed folder not found under $root matching ${ExtensionId}-${Version}*."
    }
    $native = Join-Path $dir.FullName "resources\native-binary\claude.exe"
    $cli = Join-Path $dir.FullName "resources\claude-code\cli.js"
    if (-not (Test-Path -LiteralPath $native) -and -not (Test-Path -LiteralPath $cli)) {
        throw "Install verification failed: neither '$native' nor '$cli' exists. Wrong VSIX variant?"
    }
    if (Test-Path -LiteralPath $native) {
        Write-Host "[$ExtensionId] OK: native launcher present ($native)." -ForegroundColor Green
    } else {
        Write-Host "[$ExtensionId] OK: Node launcher present ($cli)." -ForegroundColor Green
    }
}

$log = Join-Path $env:USERPROFILE ".vscode-extension-install-audit.log"
$line = "Installed Claude Code ($ExtensionId@$Version, $TargetPlatform) at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$line | Out-File -Append -FilePath $log -Encoding utf8
Write-Host "[$ExtensionId] Audit: $log" -ForegroundColor DarkGray
Write-Host "[$ExtensionId] Done. Reload Cursor: Developer: Reload Window." -ForegroundColor Green
