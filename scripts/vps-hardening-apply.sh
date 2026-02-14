#!/bin/bash
# VPS Hardening - Production ERP
# Run on VPS as root: bash vps-hardening-apply.sh
# Only SSH (22), HTTP (80), HTTPS (443) allowed.

set -e

echo "=== PHASE 1 – System Update ==="
apt update && apt upgrade -y
if [ -f /var/run/reboot-required ]; then
  echo "WARNING: Reboot required. Run: reboot"
fi

echo ""
echo "=== PHASE 2 – UFW Firewall ==="
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo ""
echo "=== PHASE 3 – Verify Ports ==="
echo "Listening (ss -tulnp):"
ss -tulnp

echo ""
echo "=== PHASE 4 – Docker (no changes, info only) ==="
docker ps 2>/dev/null || true

echo ""
echo "=== PHASE 5 – UFW Status ==="
ufw status verbose

echo ""
echo "=== DONE – Only 22, 80, 443 are allowed. Others blocked. ==="
