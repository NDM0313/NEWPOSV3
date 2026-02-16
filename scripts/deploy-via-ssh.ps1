# Run from your PC (PowerShell): SSH to VPS and run deploy. Needs Host dincouture-vps in $env:USERPROFILE\.ssh\config
# Usage: .\scripts\deploy-via-ssh.ps1

$sshHost = if ($env:SSH_HOST) { $env:SSH_HOST } else { "dincouture-vps" }
$cmd = "cd /root/NEWPOSV3 && git fetch origin && git reset --hard origin/before-mobile-replace && bash scripts/deploy-erp-vps.sh"
& ssh -o ConnectTimeout=15 $sshHost $cmd
