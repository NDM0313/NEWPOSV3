#Requires -Version 5.1
<#
.SYNOPSIS
  DIN Couture Windows 11 AI toolkit audit + Graphify MCP repair.
.DESCRIPTION
  Run on the Windows PC (ndm / ndm31) in an elevated-or-normal PowerShell.
  - Inventories hardware + toolchains
  - Backs up %USERPROFILE%\.cursor\mcp.json before edits
  - Ensures uv + graphifyy[mcp] + graphify-mcp PATH registration
  - Merges Graphify MCP entry WITHOUT removing Jetro or other servers
  - Copies the 5 DIN .mdc specialist rules into Corusr project .cursor/rules
  - Does NOT install codebase-memory-mcp (redundant / high RAM)
  - Does NOT download OpenMontage multi-GB models
#>

$ErrorActionPreference = 'Continue'
$Stamp = Get-Date -Format 'yyyyMMddTHHmmssZ'
$UserHome = $env:USERPROFILE
$CursorDir = Join-Path $UserHome '.cursor'
$McpPath = Join-Path $CursorDir 'mcp.json'
$LocalBin = Join-Path $UserHome '.local\bin'
$ReportDir = Join-Path $UserHome "Desktop\DIN_COUTURE_AI_TOOLKIT_$Stamp"
$ToolkitSrc = Join-Path $PSScriptRoot '..'
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Write-Section($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

Write-Section '1) Hardware / OS inventory'
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$gpu = Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion
$disk = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null }
$inv = [ordered]@{
  ComputerName = $env:COMPUTERNAME
  UserProfile  = $UserHome
  Windows      = "$($os.Caption) $($os.Version) build $($os.BuildNumber)"
  CPU          = $cpu.Name
  LogicalCPUs  = $cpu.NumberOfLogicalProcessors
  TotalRAM_GB  = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
  FreeRAM_GB   = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  GPUs         = @($gpu | ForEach-Object { $_.Name })
  Disks        = @($disk | ForEach-Object { "{0}: free {1:N1} GB / {2:N1} GB" -f $_.Name, ($_.Free/1GB), (($_.Used+$_.Free)/1GB) })
}
$inv | ConvertTo-Json -Depth 5 | Tee-Object (Join-Path $ReportDir 'inventory.json')

Write-Section '2) Toolchain versions'
$tools = @{}
foreach ($name in @('python','python3','uv','node','npm','git','ffmpeg','graphify','graphify-mcp')) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) {
    $ver = & $cmd.Source --version 2>&1 | Select-Object -First 1
    if ($name -eq 'graphify') {
      # Some installs reject unknown subcommands; also capture help head
      $help = & $cmd.Source --help 2>&1 | Select-Object -First 5
      $tools[$name] = @{ Path = $cmd.Source; VersionLine = "$ver"; HelpHead = ($help -join ' | ') }
    } else {
      $tools[$name] = @{ Path = $cmd.Source; VersionLine = "$ver" }
    }
  } else {
    $tools[$name] = $null
  }
}
# Common uv / graphify locations
foreach ($p in @(
  (Join-Path $LocalBin 'uv.exe'),
  (Join-Path $LocalBin 'graphify.exe'),
  (Join-Path $LocalBin 'graphify-mcp.exe'),
  (Join-Path $UserHome 'AppData\Local\Programs\Python\Python*\python.exe')
)) {
  Get-Item $p -ErrorAction SilentlyContinue | ForEach-Object {
    $tools["found:$($_.Name)"] = $_.FullName
  }
}
$tools | ConvertTo-Json -Depth 6 | Tee-Object (Join-Path $ReportDir 'toolchain.json')

Write-Section '3) Backup global mcp.json'
New-Item -ItemType Directory -Force -Path $CursorDir | Out-Null
if (Test-Path $McpPath) {
  $bak = Join-Path $CursorDir "mcp.json.bak.$Stamp"
  Copy-Item $McpPath $bak -Force
  Write-Host "Backed up -> $bak"
  Copy-Item $McpPath (Join-Path $ReportDir "mcp.json.bak.$Stamp") -Force
} else {
  Write-Host "No existing $McpPath (will create)"
  '{}' | Set-Content -Encoding UTF8 $McpPath
}

Write-Section '4) Ensure uv + graphifyy[mcp]'
$uv = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uv -and (Test-Path (Join-Path $LocalBin 'uv.exe'))) {
  $env:PATH = "$LocalBin;$env:PATH"
  $uv = Get-Command uv -ErrorAction SilentlyContinue
}
if (-not $uv) {
  Write-Host 'Installing uv...'
  powershell -ExecutionPolicy Bypass -c "irm https://astral.sh/uv/install.ps1 | iex"
  $env:PATH = "$LocalBin;$env:PATH"
  $uv = Get-Command uv -ErrorAction SilentlyContinue
}
if ($uv) {
  & $uv.Source tool install --reinstall "graphifyy[mcp]"
  & $uv.Source tool update-shell
  $env:PATH = "$LocalBin;$env:PATH"
} else {
  Write-Warning 'uv still missing — install manually then re-run'
}

$graphify = Get-Command graphify -ErrorAction SilentlyContinue
$graphifyMcp = Get-Command graphify-mcp -ErrorAction SilentlyContinue
if (-not $graphifyMcp -and (Test-Path (Join-Path $LocalBin 'graphify-mcp.exe'))) {
  $graphifyMcp = Get-Item (Join-Path $LocalBin 'graphify-mcp.exe')
}
$gHelp = if ($graphify) { & $graphify.Source --help 2>&1 | Out-String } else { 'MISSING' }
$gHelp | Set-Content (Join-Path $ReportDir 'graphify-help.txt')
# Demonstrate why bare "version" may confuse older wrappers
if ($graphify) {
  "graphify --version =>" | Set-Content (Join-Path $ReportDir 'graphify-version-probe.txt')
  & $graphify.Source --version 2>&1 | Add-Content (Join-Path $ReportDir 'graphify-version-probe.txt')
  "graphify version =>" | Add-Content (Join-Path $ReportDir 'graphify-version-probe.txt')
  & $graphify.Source version 2>&1 | Add-Content (Join-Path $ReportDir 'graphify-version-probe.txt')
}

Write-Section '5) Merge Graphify into mcp.json (preserve all existing servers)'
$mcpCmd = if ($graphifyMcp) {
  if ($graphifyMcp.Source) { $graphifyMcp.Source } else { $graphifyMcp.FullName }
} else {
  Join-Path $LocalBin 'graphify-mcp.exe'
}
$defaultGraph = 'C:\Users\ndm31\dev\Corusr\NEW POSV3\graphify-out\graph.json'
$altGraph = Join-Path $UserHome 'dev\Corusr\NEW POSV3\graphify-out\graph.json'
$graphPath = if (Test-Path $defaultGraph) { $defaultGraph } elseif (Test-Path $altGraph) { $altGraph } else { $defaultGraph }

# Windows PowerShell 5.1-safe merge via .NET JavaScriptSerializer / manual object rebuild
Add-Type -AssemblyName System.Web.Extensions -ErrorAction SilentlyContinue
$jsonText = Get-Content $McpPath -Raw
if ([string]::IsNullOrWhiteSpace($jsonText)) { $jsonText = '{}' }
$mcpObj = $jsonText | ConvertFrom-Json
if (-not $mcpObj.mcpServers) {
  $mcpObj | Add-Member -MemberType NoteProperty -Name mcpServers -Value ([pscustomobject]@{}) -Force
}
$graphifyEntry = [pscustomobject]@{
  command = $mcpCmd
  args    = @($graphPath)
}
# Replace or add graphify while leaving jetro / others intact
if ($mcpObj.mcpServers.PSObject.Properties.Name -contains 'graphify') {
  $mcpObj.mcpServers.graphify = $graphifyEntry
} else {
  $mcpObj.mcpServers | Add-Member -MemberType NoteProperty -Name graphify -Value $graphifyEntry -Force
}
($mcpObj | ConvertTo-Json -Depth 30) | Set-Content -Encoding UTF8 $McpPath
Write-Host "Wrote graphify MCP -> command=$mcpCmd args=$graphPath"
Copy-Item $McpPath (Join-Path $ReportDir 'mcp.json.after.json') -Force
Write-Host "Existing MCP servers preserved: $($mcpObj.mcpServers.PSObject.Properties.Name -join ', ')"

Write-Section '6) Ensure project graphs exist (AST-only, no LLM / no big models)'
$projects = @(
  (Join-Path $UserHome 'dev\Corusr\NEW POSV3'),
  (Join-Path $UserHome 'dev\Corusr\AutoUploadAi')
)
foreach ($proj in $projects) {
  if (-not (Test-Path $proj)) { Write-Host "skip missing $proj"; continue }
  Push-Location $proj
  if ($graphify) {
    Write-Host "graphify update . --no-cluster in $proj"
    & $graphify.Source update . --no-cluster 2>&1 | Tee-Object (Join-Path $ReportDir ("graphify-update-{0}.log" -f ($proj.Split('\')[-1]))) | Select-Object -Last 20
  }
  Pop-Location
}

Write-Section '7) Install 5 DIN specialist Cursor rules'
$ruleSrc = Join-Path $ToolkitSrc 'rules'
$ruleTargets = @{
  (Join-Path $UserHome 'dev\Corusr\NEW POSV3\.cursor\rules') = @(
    'din-erp-database-architect.mdc','din-qa-security-auditor.mdc','din-couture-sales-marketing-specialist.mdc','din-n8n-omnichannel-engineer.mdc','din-video-reel-producer.mdc'
  )
  (Join-Path $UserHome 'dev\Corusr\AutoUploadAi\.cursor\rules') = @(
    'din-video-reel-producer.mdc','din-qa-security-auditor.mdc','din-couture-sales-marketing-specialist.mdc'
  )
}
# Optional n8n / Accounts-Manager folders if present
$optional = @(
  @{ Path = (Join-Path $UserHome 'dev\Corusr\din-couture-n8n\.cursor\rules'); Files = @('din-n8n-omnichannel-engineer.mdc','din-qa-security-auditor.mdc','din-couture-sales-marketing-specialist.mdc') },
  @{ Path = (Join-Path $UserHome 'dev\Corusr\Accounts-Manager\.cursor\rules'); Files = @('din-erp-database-architect.mdc','din-qa-security-auditor.mdc') }
)
foreach ($kv in $ruleTargets.GetEnumerator()) {
  New-Item -ItemType Directory -Force -Path $kv.Key | Out-Null
  foreach ($f in $kv.Value) {
    $src = Join-Path $ruleSrc $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $kv.Key $f) -Force; Write-Host "rule -> $($kv.Key)\$f" }
  }
}
foreach ($o in $optional) {
  if (Test-Path (Split-Path $o.Path -Parent)) {
    New-Item -ItemType Directory -Force -Path $o.Path | Out-Null
    foreach ($f in $o.Files) {
      $src = Join-Path $ruleSrc $f
      if (Test-Path $src) { Copy-Item $src (Join-Path $o.Path $f) -Force }
    }
  }
}

Write-Section '8) codebase-memory-mcp check (SKIP install)'
$cbm = Get-Command codebase-memory-mcp -ErrorAction SilentlyContinue
"Installed=$([bool]$cbm) Action=SKIP (Cursor native index + Graphify cover need; CBM peak RAM often 8-11GB on mid repos)" |
  Set-Content (Join-Path $ReportDir 'codebase-memory-mcp.txt')

Write-Section '9) FFmpeg / OpenMontage recommendation probe'
$ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
"ffmpeg=$([bool]$ff) path=$($ff.Source)" | Set-Content (Join-Path $ReportDir 'ffmpeg.txt')
@"
RECOMMENDATION: Prefer local FFmpeg watermark pipeline for DIN Reels (logo + Article Code SKU + 9:16).
OpenMontage is powerful but heavy (Node 22+, Remotion/HyperFrames, optional AI providers) and not required for SKU watermarking.
Do NOT auto-download multi-GB models.
"@ | Set-Content (Join-Path $ReportDir 'openmontage-recommendation.txt')

Write-Section 'DONE'
Write-Host "Artifacts: $ReportDir"
Write-Host "Rollback global MCP: Copy-Item '$CursorDir\mcp.json.bak.$Stamp' '$McpPath' -Force"
Write-Host "Then reload Cursor MCP servers / restart Cursor."
