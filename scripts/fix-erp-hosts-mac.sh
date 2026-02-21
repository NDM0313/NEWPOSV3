#!/bin/bash
# Add subdomains to /etc/hosts so they resolve before DNS propagates.
# Run: sudo bash scripts/fix-erp-hosts-mac.sh

VPS_IP="72.62.254.176"
LINE="$VPS_IP erp.dincouture.pk supabase.dincouture.pk studio.dincouture.pk n8n.dincouture.pk"

if grep -q "erp.dincouture.pk" /etc/hosts 2>/dev/null; then
  echo "✓ Subdomains already in /etc/hosts"
  grep "dincouture.pk" /etc/hosts
  exit 0
fi

echo "Adding: $LINE"
echo "$LINE" | sudo tee -a /etc/hosts
echo ""
echo "Test: open https://erp.dincouture.pk"
echo "If certificate warning: Advanced → Proceed to erp.dincouture.pk"
