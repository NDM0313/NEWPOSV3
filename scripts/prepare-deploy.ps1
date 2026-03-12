# Auto-apply production deploy prep (build + migrate).
# Run from project root: .\scripts\prepare-deploy.ps1
# Optional: -Mobile to also build mobile app.

param([switch]$Mobile)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "[deploy:prepare] Running migrations (allow-fail)..." -ForegroundColor Cyan
node scripts/run-migrations.js --allow-fail
if (-not $?) { Write-Host "[deploy:prepare] Migrations skipped or failed (continuing)." -ForegroundColor Yellow }

Write-Host "[deploy:prepare] Building web (vite build)..." -ForegroundColor Cyan
npm run build
if (-not $?) { throw "Web build failed." }
Write-Host "[deploy:prepare] Web build OK. dist/ ready for deploy." -ForegroundColor Green

if ($Mobile) {
    Write-Host "[deploy:prepare] Syncing mobile env..." -ForegroundColor Cyan
    node scripts/sync-mobile-env.js
    Set-Location erp-mobile-app
    Write-Host "[deploy:prepare] Building mobile app..." -ForegroundColor Cyan
    npx vite build
    if (-not $?) { throw "Mobile build failed." }
    Set-Location ..
    Write-Host "[deploy:prepare] Mobile build OK. erp-mobile-app/dist/ ready." -ForegroundColor Green
}

Write-Host "[deploy:prepare] Done. Next: deploy dist/ to server (e.g. ssh dincouture-vps 'cd /path/to/NEWPOSV3 && git pull && bash deploy/deploy.sh')." -ForegroundColor Green
