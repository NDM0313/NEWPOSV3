# Kill Node/Vite holding ports 5174 and 5175 (Windows).
# Run from PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\kill-vite-ports.ps1
$ErrorActionPreference = 'SilentlyContinue'
Write-Host 'Stopping processes on ports 5174 / 5175...'

foreach ($port in 5174, 5175) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $pid = $c.OwningProcess
    if ($pid) {
      Write-Host "  Killing PID $pid (port $port)"
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
  }
}

# Nuclear option if ports still busy
$node = Get-Process -Name node -ErrorAction SilentlyContinue
if ($node) {
  Write-Host '  Also stopping all node.exe (Vite leftovers)...'
  Stop-Process -Name node -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 1
foreach ($port in 5174, 5175) {
  $still = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($still) { Write-Host "WARNING: port $port still in use" -ForegroundColor Yellow }
  else { Write-Host "OK: port $port free" -ForegroundColor Green }
}

Write-Host ''
Write-Host 'Next:'
Write-Host '  cd erp-mobile-app   # or erp-mobile-app-stage'
Write-Host '  Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue'
Write-Host '  npm run dev'
Write-Host 'Open http://localhost:5174 only (not 5175).'
