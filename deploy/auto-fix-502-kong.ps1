# Auto-fix 502 on supabase.dincouture.pk (Kong restart loop / bad kong.yml).
# Run from repo root:  .\deploy\auto-fix-502-kong.ps1
# Requires: SSH access to dincouture-vps, git remote configured.

$ErrorActionPreference = "Stop"
$SSH_HOST = "dincouture-vps"
$REPO_DIR = "/root/NEWPOSV3"
$SUPABASE_DIR = "/root/supabase/docker"

Write-Host "[auto-fix-502] Step 1: Ensure deploy scripts are committed and pushed..." -ForegroundColor Cyan
$files = @("deploy/kong-logs.sh", "deploy/diagnose-502-auth.md", "deploy/fix-kong-502-auth.sh", "deploy/auto-fix-502-kong.ps1")
$status = git status --porcelain $files 2>$null
if ($status) {
    git add $files
    git commit -m "deploy: add Kong 502 diagnostic and auto-fix scripts"
    $pushOk = $false
    try { git push; $pushOk = $true } catch { Write-Host "[auto-fix-502] Push failed - run 'git push' manually then re-run this script." -ForegroundColor Yellow }
    if ($pushOk) { Write-Host "[auto-fix-502] Pushed. VPS will get scripts on pull." -ForegroundColor Green }
} else {
    Write-Host "[auto-fix-502] No changes to push." -ForegroundColor Gray
}

Write-Host "`n[auto-fix-502] Step 2: On VPS - pull and apply Kong CORS fix (FORCE_FIX=1)..." -ForegroundColor Cyan
ssh $SSH_HOST "cd $REPO_DIR && git pull && FORCE_FIX=1 bash deploy/fix-kong-502-auth.sh"

Write-Host "`n[auto-fix-502] Step 3: Restart Kong and Auth, then verify health..." -ForegroundColor Cyan
ssh $SSH_HOST "cd $SUPABASE_DIR && docker compose restart kong auth && echo 'Waiting 35s...' && sleep 35 && (source .env 2>/dev/null; code=\$(curl -sS -o /dev/null -w '%{http_code}' -H \"apikey: \$ANON_KEY\" https://supabase.dincouture.pk/auth/v1/health 2>/dev/null); echo \"auth/v1/health HTTP \$code\"; if [ \"\$code\" = '200' ]; then echo 'OK - Login should work now.'; else echo 'If still 502, run: ssh $SSH_HOST \"bash $REPO_DIR/deploy/kong-logs.sh\"'; fi)"

Write-Host "`n[auto-fix-502] Done. Test: https://erp.dincouture.pk or localhost login." -ForegroundColor Green
