#!/bin/bash
# Copy this to VPS and run: bash RUN_ON_VPS.sh
# Or: ssh user@154.192.0.160 'bash -s' < deploy/RUN_ON_VPS.sh

echo "=== VPS Hardening ==="
cd /tmp
curl -sL -o vps-harden.sh "https://raw.githubusercontent.com/your-repo/NEWPOSV3/main/deploy/vps-harden-and-verify.sh" 2>/dev/null || true

# If no curl from git, run inline checks
echo "[1] Ports"
ss -lntp 2>/dev/null | grep -E ':(80|443|3000|5678)\b' || netstat -lntp 2>/dev/null | grep -E '\.80 |\.443 |\.3000 |\.5678 '

echo ""
echo "[2] Docker"
docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E 'traefik|n8n|erp|dokploy'

echo ""
echo "[3] HTTPS"
curl -sI -o /dev/null -w "HTTPS: %{http_code}\n" https://erp.dincouture.pk 2>/dev/null || echo "HTTPS: (run from VPS)"

echo ""
echo "To run full hardening, copy deploy/vps-harden-and-verify.sh to VPS and execute."
