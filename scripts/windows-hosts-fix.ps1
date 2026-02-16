# Run this script as Administrator (Right-click PowerShell -> Run as Administrator)
# Then: cd "path\to\NEW POSV3"; .\scripts\windows-hosts-fix.ps1

$HostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$Line = "72.62.254.176 erp.dincouture.pk"

# Check if running as Admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run PowerShell as Administrator (Right-click -> Run as administrator)" -ForegroundColor Red
    Write-Host "Then run this script again." -ForegroundColor Red
    exit 1
}

# Read current hosts
$content = Get-Content -Path $HostsPath -Raw -ErrorAction Stop

# Check if our line already exists (IP + domain)
if ($content -match "72\.62\.254\.176\s+erp\.dincouture\.pk") {
    Write-Host "[OK] Hosts file already has: $Line" -ForegroundColor Green
} else {
    # Remove any wrong/old line with erp.dincouture.pk (wrong IP etc)
    $lines = Get-Content -Path $HostsPath
    $newLines = $lines | Where-Object { $_ -notmatch "erp\.dincouture\.pk" }
    $newLines + "" + "# ERP (dincouture)" + $Line | Set-Content -Path $HostsPath -Encoding ASCII
    Write-Host "[DONE] Added to hosts file: $Line" -ForegroundColor Green
}

# Flush DNS
Write-Host "Flushing DNS cache..." -ForegroundColor Cyan
ipconfig /flushdns | Out-Null
Write-Host "[DONE] DNS cache flushed." -ForegroundColor Green

Write-Host ""
Write-Host "Now open in browser: https://erp.dincouture.pk" -ForegroundColor Yellow
Write-Host "If you see certificate warning, click Advanced -> Proceed to erp.dincouture.pk" -ForegroundColor Gray
Write-Host ""
Write-Host "If still not working:"
Write-Host "  1. Close ALL Chrome/Edge windows and open a new one."
Write-Host "  2. Run: ping erp.dincouture.pk  (should show 72.62.254.176). If ping works but browser fails, Chrome may be using 'Secure DNS' and ignoring hosts."
Write-Host "  3. Chrome: Settings -> Privacy and security -> Security -> Use secure DNS -> set to Off (or your ISP). Then retry."
Write-Host "  4. Try in Edge or Firefox, or use IP directly: https://72.62.254.176 (may show cert warning)." -ForegroundColor Gray
