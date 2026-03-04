#!/bin/bash
# Fix n8n "SecurityError: Failed to read the 'localStorage' property from 'Window': Access is denied"
# Run on VPS: ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/fix-n8n-localstorage.sh"
#
# Two cases:
# 1) Webhook HTML responses: n8n sandboxes iframes without allow-same-origin. Set env below.
# 2) Main n8n UI (editor at https://n8n.dincouture.pk): usually browser blocking storage.
#    → Allow cookies/site data for n8n.dincouture.pk; try without extensions or in another browser.

set -e
echo "=== Fix n8n localStorage / sandbox ==="

# [1] Env: webhook HTML can use localStorage (disables iframe sandbox)
echo "[1] Adding N8N_INSECURE_DISABLE_WEBHOOK_IFRAME_SANDBOX..."
docker service update dincouture-n8n --env-add "N8N_INSECURE_DISABLE_WEBHOOK_IFRAME_SANDBOX=true" 2>/dev/null || true

# Note: Permissions-Policy "storage" is not a valid feature (Chrome error: Unrecognized feature).
# sessionStorage/localStorage "Access is denied" on the main editor = browser blocking; fix in Chrome only.

echo "[2] Forcing n8n update so env is applied..."
docker service update --force dincouture-n8n 2>/dev/null || true

echo ""
echo "=== Server-side change applied ==="
echo ""
echo "If the error is on the MAIN n8n editor (not a webhook page), the browser is blocking storage:"
echo "  • Chrome: click lock icon → Site settings → Cookies and site data → Allow"
echo "  • Or: Settings → Privacy and security → Cookies → Allow all (or add n8n.dincouture.pk)"
echo "  • Try Incognito with third-party cookies allowed, or another browser"
echo "  • Disable extensions (e.g. strict privacy/analytics blockers) for this site"
echo ""
echo "Then hard refresh: https://n8n.dincouture.pk (Ctrl+Shift+R)"
