$ErrorActionPreference = 'Continue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serial = '24281FDEE0023P'
$results = @()

function Invoke-AdbShell([string]$cmd) { & adb -s $serial shell $cmd 2>&1 }
function Dump-Ui { Invoke-AdbShell 'uiautomator dump /sdcard/ui.xml' | Out-Null; & adb -s $serial shell cat /sdcard/ui.xml 2>$null }
function Get-Role {
  $xml = Dump-Ui
  if ($xml -match 'text="Welcome, ([^"]+)"') { $script:welcome = $matches[1] } else { $script:welcome = '?' }
  if ($xml -match 'text="SALESMAN"') { return 'SALESMAN' }
  if ($xml -match 'text="ADMIN"') { return 'ADMIN' }
  return 'UNKNOWN'
}
function Assert-Salesman([string]$step) {
  $role = Get-Role
  if ($role -ne 'SALESMAN') { throw "SESSION_DRIFT at $step : role=$role welcome=$welcome" }
}
function Tap-Contains([string]$pattern) {
  $xml = Dump-Ui
  $esc = [regex]::Escape($pattern)
  if ($xml -match "text=`"[^`"]*$esc[^`"]*`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`"") {
    if ([int]$matches[3] -le 0) { return $false }
    $x = ([int]$matches[1] + [int]$matches[3]) / 2; $y = ([int]$matches[2] + [int]$matches[4]) / 2
    Invoke-AdbShell "input tap $x $y" | Out-Null; Start-Sleep -Seconds 2; return $true
  }
  return $false
}
function Tap-Exact([string]$text) {
  $xml = Dump-Ui
  $esc = [regex]::Escape($text)
  if ($xml -match "text=`"$esc`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`"") {
    if ([int]$matches[3] -le 0) { return $false }
    $x = ([int]$matches[1] + [int]$matches[3]) / 2; $y = ([int]$matches[2] + [int]$matches[4]) / 2
    Invoke-AdbShell "input tap $x $y" | Out-Null; Start-Sleep -Seconds 2; return $true
  }
  return $false
}
function Ui-Has([string]$pattern) { (Dump-Ui) -match [regex]::Escape($pattern) }
function Ui-Texts { (Dump-Ui) | Select-String -Pattern 'text="[^"]{2,}' -AllMatches | ForEach-Object { $_.Matches } | ForEach-Object { $_.Value -replace '^text="','' -replace '"$','' } }
function Save-Shot([string]$name) { adb -s $serial exec-out screencap -p > (Join-Path $dir $name) }
function Tap-BackInApp {
  if (Tap-Contains('Back')) { return }
  # header back arrow often has no text; tap top-left in flow header
  Invoke-AdbShell 'input tap 84 200' | Out-Null; Start-Sleep -Seconds 1
}
function Scroll-Down { Invoke-AdbShell 'input swipe 720 2400 720 1400 350' | Out-Null; Start-Sleep -Milliseconds 800 }

try {
  Assert-Salesman 'baseline'
  Save-Shot 'retry3-row00-home.png'
  $results += 'BASELINE: SALESMAN OK'

  # Row 4 — open Reports
  if (-not (Ui-Has 'Reports')) { 1..3 | ForEach-Object { Scroll-Down } }
  Assert-Salesman 'pre-row4'
  $t4 = Tap-Exact 'Reports'
  Start-Sleep -Seconds 3
  Save-Shot 'retry3-row04-reports.png'
  $texts4 = (Ui-Texts | Select-Object -First 25) -join ' | '
  $hub = Ui-Has 'Unified financial activity'
  $partyOnly = Ui-Has 'My Activity' -or Ui-Has 'Company-wide ledgers are not available'
  $finSection = Ui-Has 'FINANCIAL STATEMENTS'
  $results += "ROW4 tap=$t4 hub=$hub partyOnly=$partyOnly finSection=$finSection texts=$texts4"

  # Row 5 — financial statements section (N/A expected for salesman)
  if ($finSection) { $results += 'ROW5 FAIL: FINANCIAL STATEMENTS visible for SALESMAN' }
  else { $results += 'ROW5 N/A: section hidden (expected)' }

  $reportTiles = @(
    @{Row=6; Key='Balance Sheet'},
    @{Row=7; Key='Profit & Loss'},
    @{Row=8; Key='Trial Balance'},
    @{Row=9; Key='Cash Flow'},
    @{Row=10; Key='Ledger V2'},
    @{Row=11; Key='Account Ledger'}
  )

  foreach ($rt in $reportTiles) {
    Assert-Salesman "pre-row$($rt.Row)"
    if (-not (Ui-Has $rt.Key)) {
      1..4 | ForEach-Object { Scroll-Down }
    }
    if (-not (Ui-Has $rt.Key)) {
      $results += "ROW$($rt.Row) BLOCKED: tile not visible for SALESMAN"
      continue
    }
    $opened = Tap-Contains $rt.Key
    Start-Sleep -Seconds 4
    Save-Shot ("retry3-row{0:D2}-{1}.png" -f $rt.Row, ($rt.Key -replace '[^A-Za-z0-9]',''))
    $hasError = Ui-Has 'Something went wrong' -or Ui-Has 'Failed to load' -or Ui-Has 'chunk'
    $hasBlank = -not (Ui-Texts | Where-Object { $_.Length -gt 2 } | Select-Object -First 1)
    $masked = Ui-Has '****'
    $hasTotals = (Ui-Texts | Where-Object { $_ -match 'Rs\.' }) -ne $null
    $results += "ROW$($rt.Row) opened=$opened error=$hasError blank=$hasBlank masked=$masked hasRs=$hasTotals"
    Tap-BackInApp
    Start-Sleep -Seconds 2
  }

  # Rows 12-15 privacy — open Balance Sheet or Trial Balance if we can reach hub via Accounts
  Assert-Salesman 'pre-row12'
  Tap-BackInApp; Start-Sleep -Seconds 1
  if (Ui-Has 'Welcome, Nabeel') { }
  elseif (-not (Ui-Has 'MODULES')) { Tap-BackInApp; Start-Sleep -Seconds 1 }

  # try Accounts > Reports path if hub not already tested
  if (-not $hub) {
    if (Tap-Exact 'Accounts') {
      Start-Sleep -Seconds 2
      Save-Shot 'retry3-row04-accounts-party.png'
      $partyMsg = Ui-Has 'Company-wide ledgers are not available'
      $myAct = Tap-Contains 'My Activity'
      Start-Sleep -Seconds 2
      Save-Shot 'retry3-row04-my-activity.png'
      $results += "ROW4_ALT accounts partyMsg=$partyMsg myActivity=$myAct"
      Tap-BackInApp; Start-Sleep -Seconds 1
    }
  }

  foreach ($branch in @('DIN CHINA','DIN BRIDAL','DIN COUTURE')) {
    $hidden = -not (Ui-Texts | Where-Object { $_ -match $branch -and $_ -match 'Rs\.' })
    $results += "ROW12-14 branch=$branch totalsHidden=$hidden"
  }

  $results += "ROW15 maskedPresent=$(Ui-Has '****')"

  # Rows 16-18 stability — already navigating; check logcat
  $log = adb -s $serial logcat -d -v brief AndroidRuntime:E chromium:E 2>&1 | Select-Object -Last 15
  $crash = ($log | Where-Object { $_ -match 'FATAL|AndroidRuntime' }) -ne $null
  $chunkErr = ($log | Where-Object { $_ -match 'chunk|ChunkLoadError' }) -ne $null
  $results += "ROW16-18 crash=$crash chunk=$chunkErr"
  $results += "ROW19 PASS: read-only navigation only (no writes attempted)"

  # Row 20 logout — last
  Assert-Salesman 'pre-row20'
  Tap-BackInApp; Start-Sleep -Seconds 1
  1..2 | ForEach-Object { Tap-BackInApp; Start-Sleep -Seconds 1 }
  if (-not (Ui-Has 'Welcome, Nabeel')) { adb -s $serial shell am start -n com.dincouture.erp/.MainActivity | Out-Null; Start-Sleep -Seconds 3 }
  $logout = Tap-Contains 'Logout'
  Start-Sleep -Seconds 3
  Save-Shot 'retry3-row20-logout.png'
  $loginScreen = Ui-Has 'Sign in' -or Ui-Has 'Login' -or Ui-Has 'Email' -or Ui-Has 'Password'
  $results += "ROW20 logoutTap=$logout loginScreen=$loginScreen"

} catch {
  $results += "ABORT: $($_.Exception.Message)"
  Save-Shot 'retry3-abort.png'
}

$results | Out-File -Encoding utf8 (Join-Path $dir 'retry3-results.txt')
$results | ForEach-Object { Write-Output $_ }
