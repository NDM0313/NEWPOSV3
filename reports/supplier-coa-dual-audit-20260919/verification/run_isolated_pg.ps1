# Windows PowerShell harness (same checks as run_isolated_pg.sh). No production writes.
$ErrorActionPreference = 'Continue'
$ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$DIR = $PSScriptRoot
$REPAIR = Join-Path $ROOT 'reports\supplier-coa-dual-audit-20260919\repair-package'
$MIG = Join-Path $ROOT 'migrations\20260919140000_journal_posting_account_guard_and_verified_remaps.sql'
$NAME = "posv3-je-guard-verify-$PID"
$EVIDENCE = Join-Path $DIR 'EVIDENCE.md'

docker ps -aq --filter "name=posv3-je-guard" | ForEach-Object { docker rm -f $_ 2>$null | Out-Null }

@"
# JE account guard — isolated Postgres evidence

- Generated: $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))
- Production writes: none
- Runner: Docker postgres:15 (PowerShell harness)
- Base commit focus: helper self-auth + non-destructive backup

"@ | Set-Content -Encoding utf8 $EVIDENCE

docker run -d --name $NAME -e POSTGRES_PASSWORD=test -e POSTGRES_USER=postgres -e POSTGRES_DB=je_guard postgres:15 | Out-Null
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  docker exec $NAME pg_isready -U postgres 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Milliseconds 500
}
if (-not $ready) { throw 'Postgres not ready' }

function Invoke-PsqlFile([string]$label, [string]$file) {
  $out = Join-Path $DIR "_out_$label.txt"
  cmd /c "type `"$file`" | docker exec -i $NAME psql -U postgres -d je_guard -v ON_ERROR_STOP=1 > `"$out`" 2>&1"
  if ($LASTEXITCODE -ne 0) {
    Add-Content $EVIDENCE "## $label FAILED`n$(Get-Content -Raw $out)"
    docker rm -f $NAME 2>$null | Out-Null
    throw "FAILED: $label"
  }
  Add-Content $EVIDENCE "## $label"
  Select-String -Path $out -Pattern 'NOTICE:|ERROR:|PASS:|ALL_|_PASSED|ALREADY_|MISSING_|ROLLBACK_|APPLY_|BACKUP_|HELPER_|ATOMIC_' | ForEach-Object { Add-Content $EVIDENCE $_.Line }
  Add-Content $EVIDENCE "- ${label}: OK`n"
}

Invoke-PsqlFile 'minimal_schema' (Join-Path $DIR '00_minimal_schema.sql')
$mout = Join-Path $DIR '_out_migrate.txt'
cmd /c "type `"$MIG`" | docker exec -i $NAME psql -U postgres -d je_guard -v ON_ERROR_STOP=1 > `"$mout`" 2>&1"
if ($LASTEXITCODE -ne 0) { throw "migration failed`n$(Get-Content -Raw $mout)" }
Select-String -Path $mout -Pattern 'ABSENT|COMMIT' | ForEach-Object { Add-Content $EVIDENCE $_.Line }
if (-not (Select-String -Path $mout -Pattern 'ABSENT' -Quiet)) { throw 'missing ABSENT notice' }

Invoke-PsqlFile 'cases' (Join-Path $DIR '02_cases.sql')
Invoke-PsqlFile 'seed_paths' (Join-Path $DIR '03_seed_paths.sql')
Invoke-PsqlFile 'acl_set_role' (Join-Path $DIR '04_acl_set_role.sql')
Invoke-PsqlFile 'helper_auth' (Join-Path $DIR '07_helper_auth_regression.sql')
Invoke-PsqlFile 'atomic_backup_fail' (Join-Path $DIR '10_backup_atomic_fail.sql')
Invoke-PsqlFile 'repair_preamble' (Join-Path $DIR '05_repair_preamble.sql')
Invoke-PsqlFile 'repair_01_backup' (Join-Path $REPAIR '01_backup.sql')
Invoke-PsqlFile 'repair_02_apply' (Join-Path $REPAIR '02_apply.sql')
Invoke-PsqlFile 'repair_02_apply_repeat' (Join-Path $REPAIR '02_apply.sql')
Invoke-PsqlFile 'backup_prerun' (Join-Path $DIR '08_backup_prerun_snapshot.sql')
Invoke-PsqlFile 'repair_01_backup_rerun' (Join-Path $REPAIR '01_backup.sql')
Invoke-PsqlFile 'backup_nondestructive' (Join-Path $DIR '09_backup_nondestructive.sql')
Invoke-PsqlFile 'repair_post' (Join-Path $DIR '06_repair_post_apply.sql')
Invoke-PsqlFile 'repair_03_rollback' (Join-Path $REPAIR '03_rollback.sql')
Invoke-PsqlFile 'repair_03_rollback_repeat' (Join-Path $REPAIR '03_rollback.sql')

Add-Content $EVIDENCE @"
## Scope notes
- AUTOMATIC remap scope: journal_account_verified_remaps
- HISTORICAL repair scope: IBRAHIM 2 lines (backup_coa_limited_ibrahim_v1)
- ID LACE: NOT_IMPLEMENTED
- Staging JWT/UI E2E: NOT EXECUTED / UNVERIFIED
- Production migrate/repair: NOT EXECUTED
"@

$fout = Join-Path $DIR '_out_final.txt'
cmd /c "docker exec -i $NAME psql -U postgres -d je_guard -c `"SELECT a.code, count(*) FROM journal_entry_lines jel JOIN accounts a ON a.id=jel.account_id WHERE jel.id IN ('677c74de-b677-4a6f-877f-b13e0ac66aaa','343c2586-2d86-4c24-9e03-3af493dada9d') GROUP BY 1;`" > `"$fout`" 2>&1"
Add-Content $EVIDENCE (Get-Content -Raw $fout)

docker rm -f $NAME | Out-Null
Get-ChildItem $DIR -Filter '_out_*.txt' | Remove-Item -Force
Write-Host "OK - see $EVIDENCE"
