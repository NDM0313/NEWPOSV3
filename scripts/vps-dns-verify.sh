#!/usr/bin/env bash
# Run on VPS: verify if erp.dincouture.pk resolves globally and if site responds.
# Usage: bash scripts/vps-dns-verify.sh

DOMAIN="erp.dincouture.pk"
IP_EXPECTED="72.62.254.176"

echo "=== DNS + site verify for $DOMAIN ==="
echo ""

# 1) Resolve via Google DNS (global view)
echo "1) Resolving $DOMAIN (via 8.8.8.8)..."
RESOLVED=$(dig +short "$DOMAIN" @8.8.8.8 2>/dev/null | tail -1)
if [ -z "$RESOLVED" ]; then
  echo "   [FAIL] No A record. Fix DNS at Hostinger: A record name=erp value=$IP_EXPECTED"
  echo "   Run: nslookup $DOMAIN 8.8.8.8"
else
  echo "   [OK] Resolves to: $RESOLVED"
  if [ "$RESOLVED" != "$IP_EXPECTED" ]; then
    echo "   [WARN] Expected $IP_EXPECTED. Update A record to $IP_EXPECTED at Hostinger."
  fi
fi

# 2) Resolve via Cloudflare DNS
echo ""
echo "2) Resolving $DOMAIN (via 1.1.1.1)..."
RESOLVED2=$(dig +short "$DOMAIN" @1.1.1.1 2>/dev/null | tail -1)
if [ -z "$RESOLVED2" ]; then
  echo "   [FAIL] No A record from 1.1.1.1 either. DNS not propagated or record missing."
else
  echo "   [OK] Resolves to: $RESOLVED2"
fi

# 3) From this server, curl (will use server's resolver)
echo ""
echo "3) Curl https://$DOMAIN from this server..."
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 8 "https://$DOMAIN/" 2>/dev/null || echo "000")
if [ "$HTTP" = "200" ]; then
  echo "   [OK] Site returns 200"
elif [ "$HTTP" = "000" ]; then
  echo "   [FAIL] Connection failed (DNS or Traefik/SSL). Fix DNS first, then run deploy script."
else
  echo "   [??] HTTP $HTTP"
fi

echo ""
echo "--- If 1 or 2 shows [FAIL]: add A record at Hostinger (erp -> $IP_EXPECTED)."
echo "--- To use app NOW from your PC: add to hosts file (see docs/FIX_ERP_DOMAIN_NOW.md)."
