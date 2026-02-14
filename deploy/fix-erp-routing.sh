#!/bin/bash
# Fix ERP routing – Caddy config + restart. Run on VPS.
# Usage: sudo ./deploy/fix-erp-routing.sh

set -e
DOMAIN="erp.dincouture.pk"
ERP_PORT=3000

echo "Fixing Caddy config for $DOMAIN..."

# 1. Write Caddyfile
tee /etc/caddy/Caddyfile << 'EOF'
erp.dincouture.pk {
    reverse_proxy localhost:3000
}
EOF

# 2. Validate
caddy validate --config /etc/caddy/Caddyfile

# 3. Restart Caddy
systemctl restart caddy
systemctl status caddy --no-pager

echo ""
echo "Caddy restarted. Verify: curl -I https://$DOMAIN"
