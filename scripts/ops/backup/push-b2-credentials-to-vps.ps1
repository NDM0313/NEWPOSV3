#Requires -Version 5.1
<#
.SYNOPSIS
  Securely write Backblaze B2 credentials to the VPS (never logs secrets).

.DESCRIPTION
  Prompts for Application Key ID and secret on the office PC (secret hidden),
  builds an LF-only UTF-8 restic-b2.env (no BOM), scp's to dincouture-vps,
  uploads an LF-only verifier shell script (avoids Windows CRLF -> bash),
  strips CR on the VPS via Python (never tr -d "\r" — that deletes letter r),
  sets mode 600 / root:root, shreds local temps.

  Presence checks print key NAMES only, never secret values.
#>
[CmdletBinding()]
param(
  [string]$SshHost = "dincouture-vps",
  [string]$RemoteEnv = "/root/.config/din-erp-backup/restic-b2.env",
  [string]$Repository = "s3:https://s3.us-east-005.backblazeb2.com/din-couture-erp-backups",
  [string]$PasswordFile = "/root/.config/din-erp-backup/restic.password"
)

$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "DIN Couture - secure B2 credential install" -ForegroundColor Cyan
Write-Host ("Target: {0}:{1}" -f $SshHost, $RemoteEnv) -ForegroundColor Cyan
Write-Host ("Repo:   {0}" -f $Repository) -ForegroundColor Cyan
Write-Host "Secrets are NOT printed and NOT committed." -ForegroundColor Yellow
Write-Host ""

$keyId = Read-Host "Backblaze Application Key ID"
if ([string]::IsNullOrWhiteSpace($keyId)) { throw "Key ID is required" }

$secure = Read-Host "Backblaze Application Key (secret)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if ([string]::IsNullOrWhiteSpace($secret)) { throw "Application Key secret is required" }

function Write-Utf8LfFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Text
  )
  $utf8 = New-Object System.Text.UTF8Encoding $false
  # Normalize any accidental CR to LF; do NOT treat the two-char sequence \r as CR.
  $normalized = $Text.Replace([string][char]13 + [string][char]10, "`n").Replace([string][char]13, "`n")
  if (-not $normalized.EndsWith("`n")) { $normalized += "`n" }
  [System.IO.File]::WriteAllBytes($Path, $utf8.GetBytes($normalized))
}

function Clear-DinResticB2TempFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  try {
    $len = (Get-Item -LiteralPath $Path).Length
    if ($len -gt 0) {
      $zeros = New-Object byte[] $len
      [System.IO.File]::WriteAllBytes($Path, $zeros)
    }
  } catch {}
  Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
}

$guid = [guid]::NewGuid().ToString("N")
$tmpEnv = Join-Path $env:TEMP ("din-restic-b2-{0}.env" -f $guid)
$tmpSh = Join-Path $env:TEMP ("din-restic-b2-{0}-verify.sh" -f $guid)
$remoteSh = "/tmp/din-restic-b2-{0}-verify.sh" -f $guid

try {
  $envBody = @(
    '# DIN Couture ERP - Backblaze B2 restic credentials (root-only). DO NOT COMMIT.',
    ("AWS_ACCESS_KEY_ID={0}" -f $keyId),
    ("AWS_SECRET_ACCESS_KEY={0}" -f $secret),
    'AWS_DEFAULT_REGION=us-east-005',
    ("RESTIC_REPOSITORY={0}" -f $Repository),
    ("RESTIC_PASSWORD_FILE={0}" -f $PasswordFile)
  ) -join "`n"
  Write-Utf8LfFile -Path $tmpEnv -Text $envBody

  # Verifier template: literal bash. Placeholders replaced below (paths only, no secrets).
  $verifyBody = @'
#!/bin/bash
set -euo pipefail
f='__REMOTE_ENV__'
want='__REPOSITORY__'
# Strip CR bytes only (safe). NEVER use: tr -d "\r"  (bash passes literal \ and r).
python3 -c 'import sys; p=sys.argv[1]; d=open(p,"rb").read().replace(b"\r",b""); open(p,"wb").write(d)' "$f"
chown root:root "$f"
chmod 600 "$f"
test -s "$f"
for k in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY RESTIC_REPOSITORY RESTIC_PASSWORD_FILE; do
  if grep -qE "^${k}=.+" "$f"; then
    echo "SET_NONEMPTY $k"
  else
    echo "BAD $k"
    exit 1
  fi
done
stat -c "mode=%a owner=%U:%G" "$f"
got=$(grep -E "^RESTIC_REPOSITORY=" "$f" | head -n1 | cut -d= -f2-)
if [ "$got" = "$want" ]; then
  echo REPO_OK
else
  echo REPO_BAD
  exit 1
fi
'@
  $verifyBody = $verifyBody.Replace('__REMOTE_ENV__', $RemoteEnv).Replace('__REPOSITORY__', $Repository)
  Write-Utf8LfFile -Path $tmpSh -Text $verifyBody

  & ssh -o BatchMode=yes $SshHost "mkdir -p /root/.config/din-erp-backup && chmod 700 /root/.config/din-erp-backup"
  if ($LASTEXITCODE -ne 0) { throw "ssh mkdir failed" }

  & scp -o BatchMode=yes $tmpEnv ("{0}:{1}" -f $SshHost, $RemoteEnv)
  if ($LASTEXITCODE -ne 0) { throw "scp env failed" }

  & scp -o BatchMode=yes $tmpSh ("{0}:{1}" -f $SshHost, $remoteSh)
  if ($LASTEXITCODE -ne 0) { throw "scp verify script failed" }

  $check = & ssh -o BatchMode=yes $SshHost ("bash {0}; ec=`$?; rm -f {0}; exit `$ec" -f $remoteSh) 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ("presence check failed: {0}" -f ($check | Out-String))
  }
  Write-Host ($check | Out-String).TrimEnd()
  Write-Host ""
  Write-Host "B2 credentials installed on VPS (secrets not shown)." -ForegroundColor Green
}
finally {
  $secret = $null
  Clear-DinResticB2TempFile -Path $tmpEnv
  Clear-DinResticB2TempFile -Path $tmpSh
  & ssh -o BatchMode=yes -o ConnectTimeout=10 $SshHost ("rm -f {0}" -f $remoteSh) 2>$null | Out-Null
}
