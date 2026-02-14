#!/bin/bash
# PRODUCTION SSL & ERP ROUTING FIX
# Run on VPS as root: bash production-ssl-erp-fix.sh
# Do NOT break Traefik or existing services.

set -e
# Allow some steps to fail without exiting
DOMAIN="erp.dincouture.pk"
EXPECTED_IP="72.62.254.176"

echo "=============================================="
echo "PRODUCTION SSL & ERP ROUTING FIX"
echo "=============================================="

# STEP 1 – Verify DNS
echo ""
echo "[STEP 1] DNS Resolution"
echo "---"
DNS_IP=$(dig +short $DOMAIN | head -1)
echo "erp.dincouture.pk -> $DNS_IP"
if [ -z "$DNS_IP" ]; then
  echo "FAIL: DNS does not resolve. Stop."
  exit 1
fi
if [ "$DNS_IP" != "$EXPECTED_IP" ]; then
  echo "WARN: Expected $EXPECTED_IP, got $DNS_IP. Continue anyway."
fi

# STEP 2 – Traefik
echo ""
echo "[STEP 2] Traefik"
echo "---"
docker ps | grep -i traefik || echo "No traefik container found"
ss -lntp | grep -E ':80|:443' || netstat -lntp | grep -E '\.80 |\.443 '

# STEP 3 – ERP container
echo ""
echo "[STEP 3] ERP Container"
echo "---"
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -v postgres
ERP_CONTAINER=$(docker ps --format '{{.Names}}' | grep -iE 'erp|nginx|frontend' | head -1)
if [ -n "$ERP_CONTAINER" ]; then
  echo "ERP container: $ERP_CONTAINER"
  docker inspect "$ERP_CONTAINER" --format '{{json .Config.Labels}}' | jq -r 'to_entries[] | "\(.key): \(.value)"' 2>/dev/null | grep traefik || echo "No Traefik labels"
else
  echo "No ERP frontend container found. Check: docker ps"
fi

# STEP 4 – Traefik labels (if Swarm service)
# Exclude din-erp-production (postgres) - we want erp-frontend (nginx)
ERP_SVC=$(docker service ls --format '{{.Name}} {{.Image}}' 2>/dev/null | grep -i erp | grep -v postgres | awk '{print $1}' | head -1)
if [ -n "$ERP_SVC" ]; then
  echo ""
  echo "[STEP 4] Updating ERP service ($ERP_SVC) with Traefik labels..."
  docker service update "$ERP_SVC" \
    --label-add "traefik.enable=true" \
    --label-add "traefik.http.routers.erp.rule=Host(\`$DOMAIN\`)" \
    --label-add "traefik.http.routers.erp.entrypoints=web,websecure" \
    --label-add "traefik.http.routers.erp.tls=true" \
    --label-add "traefik.http.routers.erp.tls.certresolver=letsencrypt" \
    --label-add "traefik.http.services.erp.loadbalancer.server.port=80" || echo "Label update failed"
else
  echo "[STEP 4] No ERP Swarm service found. If using standalone container, add labels on recreate."
fi

# STEP 5 – ACME storage (Dokploy mounts from host)
echo ""
echo "[STEP 5] ACME Storage"
echo "---"
for ACME_PATH in /etc/dokploy/traefik/dynamic/acme.json /var/lib/dokploy/traefik/acme.json; do
  if [ -d "$(dirname $ACME_PATH)" ]; then
    if [ ! -f "$ACME_PATH" ]; then
      touch "$ACME_PATH" && chmod 600 "$ACME_PATH" && echo "Created $ACME_PATH"
    fi
    ls -la "$ACME_PATH" 2>/dev/null
    break
  fi
done
# Restart Traefik only if we just created acme (optional - may cause brief downtime)
# docker restart $(docker ps -q --filter name=traefik) 2>/dev/null || true

# STEP 6 – HTTP test
echo ""
echo "[STEP 6] HTTP Test"
echo "---"
curl -sI --connect-timeout 5 "http://$DOMAIN" | head -5

# STEP 7 – HTTPS test
echo ""
echo "[STEP 7] HTTPS Test"
echo "---"
curl -sI --connect-timeout 10 "https://$DOMAIN" | head -10

# STEP 8 – Final Report
echo ""
echo "=============================================="
echo "FINAL REPORT"
echo "=============================================="
echo "DNS: $DOMAIN -> $DNS_IP"
echo "ERP container: ${ERP_CONTAINER:-none}"
echo "ERP service: ${ERP_SVC:-none}"
echo ""
echo "HTTPS response:"
curl -sI --connect-timeout 5 "https://$DOMAIN" 2>/dev/null | head -8
echo ""
