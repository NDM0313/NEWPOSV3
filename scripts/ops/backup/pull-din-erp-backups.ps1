#Requires -Version 5.1
<#
.SYNOPSIS
  Pull verified DIN Couture ERP backups from VPS to the office PC.

.DESCRIPTION
  Canonical local root: D:\ERP BACKUP
  - Downloads missing verified day dirs from dincouture-vps:/root/backups/erp-db/
  - Uses *.partial during transfer; promotes only after SHA256 PASS
  - Never deletes remote (VPS) backups
  - Retention: REPORT candidates only (no auto-delete in this version)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\ops\backup\pull-din-erp-backups.ps1
#>
[CmdletBinding()]
param(
  [string]$SshHost = "dincouture-vps",
  [string]$RemoteRoot = "/root/backups/erp-db",
  [string]$LocalRoot = "D:\ERP BACKUP",
  [switch]$SkipRetentionReport
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Status([string]$msg, [string]$color = "White") {
  Write-Host $msg -ForegroundColor $color
}

function Ensure-Dir([string]$p) {
  if (-not (Test-Path -LiteralPath $p)) {
    New-Item -ItemType Directory -Path $p -Force | Out-Null
  }
}

function Get-FileSha256([string]$path) {
  return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Invoke-Remote([string]$cmd) {
  $out = & ssh -o BatchMode=yes -o ConnectTimeout=20 $SshHost $cmd 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "SSH failed ($LASTEXITCODE): $out"
  }
  return ($out | Out-String)
}

function Test-PgRestoreList([string]$dumpPath) {
  $pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
  if (-not $pgRestore) {
    return @{ Available = $false; Pass = $null; Detail = "pg_restore not on PATH" }
  }
  $toc = & pg_restore -l $dumpPath 2>&1
  if ($LASTEXITCODE -ne 0) {
    return @{ Available = $true; Pass = $false; Detail = ($toc | Out-String).Substring(0, [Math]::Min(300, ($toc | Out-String).Length)) }
  }
  if (-not $toc) {
    return @{ Available = $true; Pass = $false; Detail = "empty TOC" }
  }
  return @{ Available = $true; Pass = $true; Detail = "pg_restore -l OK ($($toc.Count) lines)" }
}

Ensure-Dir $LocalRoot
Ensure-Dir (Join-Path $LocalRoot "logs")
Ensure-Dir (Join-Path $LocalRoot "reports")
$logFile = Join-Path $LocalRoot ("logs\pull-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))

function Log([string]$m) {
  $line = "{0:u} {1}" -f (Get-Date).ToUniversalTime(), $m
  Add-Content -LiteralPath $logFile -Value $line
  Write-Host $line
}

Log "PULL start remote=${SshHost}:${RemoteRoot} local=${LocalRoot}"

# Remote day dirs that contain BACKUP_STATUS.json (verified check after download)
$remoteListRaw = Invoke-Remote "find $RemoteRoot -mindepth 3 -maxdepth 3 -type d -exec test -f {}/BACKUP_STATUS.json \; -print 2>/dev/null | sort"

$remoteDirs = @()
foreach ($line in ($remoteListRaw -split "`n")) {
  $d = $line.Trim()
  if ($d -and $d -match '/\d{4}/\d{2}/\d{2}$') { $remoteDirs += $d }
}

$downloaded = 0
$verified = 0
$skipped = 0
$failed = 0
$partialLeft = 0
$latestLocal = $null
$latestStamp = $null
$latestSize = 0
$latestShaOk = $null
$pgRestoreResult = $null
$shaFailures = 0

foreach ($rd in $remoteDirs) {
  $rel = $rd.Substring($RemoteRoot.Length).TrimStart('/')
  $localDay = Join-Path $LocalRoot ($rel -replace '/', '\')
  $marker = Join-Path $localDay "BACKUP_STATUS.json"
  $sumsLocal = Join-Path $localDay "SHA256SUMS.txt"

  # Skip if already present and verified locally
  if ((Test-Path -LiteralPath $marker) -and (Test-Path -LiteralPath $sumsLocal)) {
    $skipped++
    $latestLocal = $localDay
    continue
  }

  Log "FETCH $rel"
  # Do not create final day dir until PASS — use sibling .partial only
  $partial = "$localDay.partial"
  if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial -Recurse -Force }
  Ensure-Dir (Split-Path $localDay -Parent)
  Ensure-Dir $partial

  try {
    & scp -o BatchMode=yes -o ConnectTimeout=30 -r "${SshHost}:${rd}/." $partial
    if ($LASTEXITCODE -ne 0) { throw "scp failed for $rd" }

    $sumsPath = Join-Path $partial "SHA256SUMS.txt"
    $statusPath = Join-Path $partial "BACKUP_STATUS.json"
    if (-not (Test-Path -LiteralPath $sumsPath)) { throw "missing SHA256SUMS.txt" }
    if (-not (Test-Path -LiteralPath $statusPath)) { throw "missing BACKUP_STATUS.json" }

    $status = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
    if (-not $status.verified) { throw "remote BACKUP_STATUS.verified is not true" }

    $dumpPartial = Get-ChildItem -LiteralPath $partial -Filter "postgres_*.dump" | Select-Object -First 1
    $globalsPartial = Get-ChildItem -LiteralPath $partial -Filter "globals_*.sql" | Select-Object -First 1
    if (-not $dumpPartial -or $dumpPartial.Length -le 0) { throw "postgres dump missing or empty" }
    if (-not $globalsPartial -or $globalsPartial.Length -le 0) { throw "globals missing or empty" }

    # Verify SHA256 for every listed file
    Get-Content -LiteralPath $sumsPath | ForEach-Object {
      $line = $_.Trim()
      if (-not $line) { return }
      if ($line -notmatch '^([a-fA-F0-9]{64})\s+(.+)$') { throw "bad SHA256 line: $line" }
      $expect = $Matches[1].ToLowerInvariant()
      $name = $Matches[2].Trim()
      $fp = Join-Path $partial $name
      if (-not (Test-Path -LiteralPath $fp)) { throw "missing file $name" }
      if ((Get-Item -LiteralPath $fp).Length -le 0) { throw "zero-size file $name" }
      $got = Get-FileSha256 $fp
      if ($got -ne $expect) {
        $script:shaFailures++
        throw "SHA256 mismatch $name expect=$expect got=$got"
      }
    }

    # Optional local pg_restore -l
    $pg = Test-PgRestoreList $dumpPartial.FullName
    $pgRestoreResult = $pg
    if ($pg.Available -and ($pg.Pass -eq $false)) {
      throw "pg_restore -l FAILED: $($pg.Detail)"
    }

    # Promote: never overwrite existing verified day with a failed state (we only get here on PASS)
    if (Test-Path -LiteralPath $localDay) {
      # Only replace if previous copy was incomplete (no marker) — never clobber verified
      if (Test-Path -LiteralPath $marker) {
        throw "refusing to overwrite existing verified local backup at $localDay"
      }
      Remove-Item -LiteralPath $localDay -Recurse -Force
    }
    New-Item -ItemType Directory -Path $localDay -Force | Out-Null
    Copy-Item -Path (Join-Path $partial '*') -Destination $localDay -Recurse -Force
    Remove-Item -LiteralPath $partial -Recurse -Force

    $downloaded++
    $verified++
    $latestLocal = $localDay
    $latestStamp = [string]$status.stamp
    $latestSize = $dumpPartial.Length
    $latestShaOk = $true
    Log "PASS $rel size=$latestSize sha=OK pg_restore=$($pg.Available):$($pg.Pass)"
  }
  catch {
    $failed++
    Log "FAIL $rel :: $($_.Exception.Message)"
    if (Test-Path -LiteralPath $partial) {
      # leave evidence? User asked no partial left after success; on failure remove partial to avoid clutter
      Remove-Item -LiteralPath $partial -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

# Count any leftover *.partial under LocalRoot
$leftovers = @(Get-ChildItem -LiteralPath $LocalRoot -Recurse -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like '*.partial' -or $_.FullName -like '*.partial' })
$partialLeft = $leftovers.Count

# Refresh latest from disk if we only skipped
if (-not $latestLocal) {
  $all = Get-ChildItem -LiteralPath $LocalRoot -Directory -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\\d{4}\\\d{2}\\\d{2}$' -and (Test-Path (Join-Path $_.FullName 'BACKUP_STATUS.json')) } |
    Sort-Object FullName -Descending
  if ($all) {
    $latestLocal = $all[0].FullName
    $st = Get-Content (Join-Path $latestLocal 'BACKUP_STATUS.json') -Raw | ConvertFrom-Json
    $latestStamp = [string]$st.stamp
    $dump = Get-ChildItem -LiteralPath $latestLocal -Filter 'postgres_*.dump' | Select-Object -First 1
    if ($dump) { $latestSize = $dump.Length }
  }
} elseif (-not $latestStamp -and (Test-Path (Join-Path $latestLocal 'BACKUP_STATUS.json'))) {
  $st = Get-Content (Join-Path $latestLocal 'BACKUP_STATUS.json') -Raw | ConvertFrom-Json
  $latestStamp = [string]$st.stamp
  $dump = Get-ChildItem -LiteralPath $latestLocal -Filter 'postgres_*.dump' | Select-Object -First 1
  if ($dump) { $latestSize = $dump.Length }
  # Re-check SHA for latest when skipped
  if ($null -eq $latestShaOk) {
    try {
      Get-Content (Join-Path $latestLocal 'SHA256SUMS.txt') | ForEach-Object {
        $line = $_.Trim(); if (-not $line) { return }
        if ($line -match '^([a-fA-F0-9]{64})\s+(.+)$') {
          $e = $Matches[1].ToLowerInvariant(); $n = $Matches[2].Trim()
          $g = Get-FileSha256 (Join-Path $latestLocal $n)
          if ($e -ne $g) { throw "mismatch" }
        }
      }
      $latestShaOk = $true
    } catch { $latestShaOk = $false }
  }
}

# Retention REPORT only (no deletes)
if (-not $SkipRetentionReport) {
  $dayDirs = @(Get-ChildItem -LiteralPath $LocalRoot -Directory -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\\d{4}\\\d{2}\\\d{2}$' -and (Test-Path (Join-Path $_.FullName 'BACKUP_STATUS.json')) } |
    Sort-Object FullName -Descending)
  $reportPath = Join-Path $LocalRoot ("reports\retention-candidates-{0:yyyyMMdd}.txt" -f (Get-Date))
  $keep = New-Object 'System.Collections.Generic.HashSet[string]'
  if ($dayDirs.Count -gt 0) {
    [void]$keep.Add($dayDirs[0].FullName)
    $i = 0
    foreach ($d in $dayDirs) { if ($i -ge 30) { break }; [void]$keep.Add($d.FullName); $i++ }
    $weeks = @{}; $months = @{}
    foreach ($d in $dayDirs) {
      $parts = $d.FullName -split '[\\/]'
      $y = [int]$parts[-3]; $m = [int]$parts[-2]; $day = [int]$parts[-1]
      $dt = Get-Date -Year $y -Month $m -Day $day
      $cal = [cultureinfo]::InvariantCulture.Calendar
      $wk = "{0:D4}-W{1:D2}" -f $y, $cal.GetWeekOfYear($dt, [System.Globalization.CalendarWeekRule]::FirstFourDayWeek, [DayOfWeek]::Monday)
      if (-not $weeks.ContainsKey($wk)) { $weeks[$wk] = $d.FullName }
      $ym = "{0}-{1:D2}" -f $y, $m
      if (-not $months.ContainsKey($ym)) { $months[$ym] = $d.FullName }
    }
    $weeks.GetEnumerator() | Sort-Object Name -Descending | Select-Object -First 12 | ForEach-Object { [void]$keep.Add($_.Value) }
    $months.GetEnumerator() | Sort-Object Name -Descending | Select-Object -First 12 | ForEach-Object { [void]$keep.Add($_.Value) }
  }
  $candidates = @($dayDirs | Where-Object { -not $keep.Contains($_.FullName) } | ForEach-Object { $_.FullName })
  @(
    "Retention policy: keep 30 daily / 12 weekly / 12 monthly (REPORT ONLY - no deletes)"
    "Generated UTC: $((Get-Date).ToUniversalTime().ToString('u'))"
    "Total local verified days: $($dayDirs.Count)"
    "Keep set size: $($keep.Count)"
    "Candidates (not deleted): $($candidates.Count)"
    ""
  ) + $candidates | Set-Content -LiteralPath $reportPath -Encoding UTF8
  Log "RETENTION report written: $reportPath candidates=$($candidates.Count)"
}

Write-Host ""
Write-Status "======== DIN ERP BACKUP PULL SUMMARY ========" "Cyan"
Write-Status "Local folder:           $LocalRoot" "White"
Write-Status "New backups downloaded: $downloaded" "White"
Write-Status "Already present:        $skipped" "White"
Write-Status "Failed:                 $failed" $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Status "Partial files left:     $partialLeft" $(if ($partialLeft -gt 0) { "Yellow" } else { "Green" })
if ($latestLocal) {
  Write-Status "Latest backup folder:   $latestLocal" "Cyan"
  Write-Status "Latest stamp:           $latestStamp" "Cyan"
  $sizeMb = [math]::Round($latestSize / 1MB, 1)
  Write-Status "Latest dump size:       $sizeMb MB ($latestSize bytes)" "Cyan"
  Write-Status ("SHA256 status:          {0}" -f $(if ($latestShaOk) { "PASS" } elseif ($null -eq $latestShaOk) { "N/A" } else { "FAIL" })) $(if ($latestShaOk) { "Green" } else { "Yellow" })
}
if ($pgRestoreResult) {
  if (-not $pgRestoreResult.Available) {
    Write-Status "pg_restore -l:          SKIPPED ($($pgRestoreResult.Detail))" "Yellow"
  } elseif ($pgRestoreResult.Pass) {
    Write-Status "pg_restore -l:          PASS" "Green"
  } else {
    Write-Status "pg_restore -l:          FAIL" "Red"
  }
} else {
  Write-Status "pg_restore -l:          not run this session (skipped existing only)" "Yellow"
}

if ($failed -gt 0 -or $partialLeft -gt 0 -or ($latestShaOk -eq $false)) {
  Write-Status "" "White"
  Write-Status "DIN ERP BACKUP FAILED" "Red"
  Log "PULL end RESULT=FAILED"
  exit 1
}

Write-Status "" "White"
Write-Status "DIN ERP BACKUP PASS" "Green"
Log "PULL end RESULT=PASS downloaded=$downloaded skipped=$skipped"
exit 0
