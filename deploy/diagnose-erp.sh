#!/bin/bash
# ERP Domain Routing Diagnostic – run on VPS (Ubuntu 24.04)
# Usage: chmod +x deploy/diagnose-erp.sh && ./deploy/diagnose-erp.sh

set -e
DOMAIN="erp.dincouture.pk"
ERP_PORT=3000

echo "=========================================="
echo "ERP Domain Diagnostic: $DOMAIN"
echo "=========================================="

# 1. DNS CHECK
echo ""
echo "[1] DNS CHECK"
echo "---"
VPS_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "UNKNOWN")
DNS_IP=$(dig +short "$DOMAIN" 2>/dev/null | head -1)
if [ -z "$DNS_IP" ]; then
  echo "❌ DNS: $DOMAIN returns NXDOMAIN (no A record)"
  echo ""
  echo "FIX: Add A record in your DNS provider:"
  echo "  Type: A"
  echo "  Name: erp (or erp.dincouture.pk depending on provider)"
  echo "  Value: $VPS_IP"
  echo "  TTL: 300"
  echo ""
  echo "Your VPS public IP: $VPS_IP"
  echo "After adding, wait 5–10 min for propagation."
else
  echo "✅ DNS: $DOMAIN → $DNS_IP"
  if [ "$VPS_IP" != "UNKNOWN" ] && [ "$DNS_IP" != "$VPS_IP" ]; then
    echo "⚠️  WARNING: DNS ($DNS_IP) != VPS IP ($VPS_IP). Update A record to $VPS_IP"
  fi
fi

# 2. LISTENING PORTS
echo ""
echo "[2] LISTENING PORTS"
echo "---"
ss -lntp 2>/dev/null | grep -E ':80|:443|:3000' || echo "No listeners on 80/443/3000"
if ! ss -lntp 2>/dev/null | grep -q ':80'; then
  echo "⚠️  Port 80 not listening (Caddy/Nginx?)"
fi
if ! ss -lntp 2>/dev/null | grep -q ':443'; then
  echo "⚠️  Port 443 not listening (Caddy/Nginx?)"
fi
if ! ss -lntp 2>/dev/null | grep -q ':3000'; then
  echo "⚠️  Port 3000 not listening (ERP container?)"
fi

# 3. DOCKER CONTAINERS
echo ""
echo "[3] DOCKER CONTAINERS"
echo "---"
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" 2>/dev/null || echo "Docker not running or not installed"
if docker ps 2>/dev/null | grep -q erp; then
  echo "✅ ERP container running"
else
  echo "❌ ERP container not running"
  echo ""
  echo "To start ERP (from project root):"
  echo "  docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build"
fi

# 4. CADDY CONFIG
echo ""
echo "[4] CADDY CONFIG"
echo "---"
if [ -f /etc/caddy/Caddyfile ]; then
  echo "Current /etc/caddy/Caddyfile:"
  cat /etc/caddy/Caddyfile
  if grep -q "reverse_proxy.*$ERP_PORT" /etc/caddy/Caddyfile 2>/dev/null; then
    echo "✅ Caddy proxies to port $ERP_PORT"
  else
    echo "❌ Caddyfile missing reverse_proxy to localhost:$ERP_PORT"
  fi
else
  echo "❌ /etc/caddy/Caddyfile not found"
fi

# 5. CADDY STATUS
echo ""
echo "[5] CADDY STATUS"
echo "---"
systemctl is-active caddy 2>/dev/null && echo "✅ Caddy active" || echo "❌ Caddy not active"
systemctl status caddy --no-pager 2>/dev/null | head -5 || true

# 6. LOCAL ERP CHECK
echo ""
echo "[6] LOCAL ERP (localhost:$ERP_PORT)"
echo "---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:$ERP_PORT 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ ERP responds 200 on localhost:$ERP_PORT"
else
  echo "❌ ERP not responding (got $HTTP_CODE)"
fi

# 7. HTTPS CHECK (only if DNS resolves)
echo ""
echo "[7] HTTPS CHECK"
echo "---"
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -k https://$DOMAIN 2>/dev/null || echo "000")
if [ "$HTTPS_CODE" = "200" ]; then
  echo "✅ HTTPS returns 200"
else
  echo "HTTPS response: $HTTPS_CODE"
  if [ "$HTTPS_CODE" = "502" ]; then
    echo "  502 = Caddy can't reach ERP on 3000. Start ERP container."
  elif [ "$HTTPS_CODE" = "504" ]; then
    echo "  504 = Timeout. Check firewall (UFW 80, 443)."
  elif [ "$HTTPS_CODE" = "000" ]; then
    echo "  Connection failed. DNS may not resolve or firewall blocking."
  fi
fi

# 8. FIREWALL
echo ""
echo "[8] FIREWALL (UFW)"
echo "---"
sudo ufw status 2>/dev/null | head -15 || echo "UFW not available"

# 9. SUMMARY
echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo "DNS:        ${DNS_IP:-NOT RESOLVED}"
echo "VPS IP:     $VPS_IP"
echo "Caddy:      $(systemctl is-active caddy 2>/dev/null || echo 'inactive')"
echo "ERP local:  $HTTP_CODE"
echo "HTTPS:      $HTTPS_CODE"
echo ""
echo "Next steps:"
echo "  1. If DNS NXDOMAIN: Add A record erp.dincouture.pk → $VPS_IP"
echo "  2. If ERP not on 3000: docker compose -f deploy/docker-compose.prod.yml up -d --build"
echo "  3. If Caddy wrong: sudo tee /etc/caddy/Caddyfile << 'EOF'"
echo "erp.dincouture.pk {"
echo "    reverse_proxy localhost:3000"
echo "}"
echo "EOF"
echo "  4. sudo systemctl restart caddy"
echo ""
