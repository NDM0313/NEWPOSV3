#!/bin/bash
# Add erp.dincouture.pk A record via Hostinger API
# Usage: API_TOKEN="your-token" ./deploy/add-erp-dns-hostinger.sh
# Or: export API_TOKEN from ~/.cursor/mcp.json

set -e
DOMAIN="dincouture.pk"
SUBDOMAIN="erp"
VPS_IP="${VPS_IP:-154.192.0.160}"  # ERP VPS - confirmed from DNS
API_BASE="https://developers.hostinger.com"

# Get token from env or mcp.json
if [ -z "$API_TOKEN" ]; then
  if [ -f "$HOME/.cursor/mcp.json" ]; then
    API_TOKEN=$(grep -o '"API_TOKEN":"[^"]*"' "$HOME/.cursor/mcp.json" | cut -d'"' -f4)
  fi
fi

if [ -z "$API_TOKEN" ]; then
  echo "ERROR: Set API_TOKEN or ensure ~/.cursor/mcp.json has hostinger API_TOKEN"
  exit 1
fi

echo "Adding A record: $SUBDOMAIN.$DOMAIN -> $VPS_IP"

# 1. Get current DNS records
echo "Fetching current DNS records..."
RECORDS=$(curl -s -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  "$API_BASE/api/dns/v1/zones/$DOMAIN")

if echo "$RECORDS" | grep -q "Unauthenticated"; then
  echo "ERROR: API token invalid or expired. Regenerate from hPanel: https://hpanel.hostinger.com/profile/api"
  exit 1
fi

if echo "$RECORDS" | grep -q "error"; then
  echo "API Error: $RECORDS"
  exit 1
fi

# 2. Build update payload - add erp A record (overwrite=false to keep existing)
if command -v jq &>/dev/null && [ -n "$RECORDS" ] && ! echo "$RECORDS" | grep -q "Unauthenticated"; then
  ZONE_UPDATE=$(echo "$RECORDS" | jq -c --arg name "$SUBDOMAIN" --arg ip "$VPS_IP" '
    (.zone // [] | map(select(.name != $name))) + [{ "name": $name, "records": [{ "type": "A", "content": $ip, "ttl": 300 }] }] |
    { zone: ., overwrite: false }
  ' 2>/dev/null)
fi

if [ -z "$ZONE_UPDATE" ] || [ "$ZONE_UPDATE" = "null" ]; then
  ZONE_UPDATE="{\"zone\":[{\"name\":\"$SUBDOMAIN\",\"records\":[{\"type\":\"A\",\"content\":\"$VPS_IP\",\"ttl\":300}]}],\"overwrite\":false}"
fi

# 3. Update DNS
echo "Updating DNS..."
RESP=$(curl -s -w "\n%{http_code}" -X PUT \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$ZONE_UPDATE" \
  "$API_BASE/api/dns/v1/zones/$DOMAIN")

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "OK: DNS A record added. Wait 5-10 min for propagation."
  echo "Verify: dig +short erp.dincouture.pk"
else
  echo "API returned $HTTP_CODE: $BODY"
  exit 1
fi
