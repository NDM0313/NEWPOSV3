#!/bin/bash
# check-studio-api-keys-health.sh
# Verifies the Supabase Studio API Keys page bridge health.

INJECTOR_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' erp-studio-injector 2>/dev/null)
if [ -z "$INJECTOR_IP" ]; then
    echo "[FAIL] erp-studio-injector container not found or has no IP."
    exit 1
fi

echo "[INFO] Testing erp-studio-injector at $INJECTOR_IP:8080..."

# 1. Test Mock Org
if docker exec erp-studio-injector python3 -c 'import urllib.request; print(urllib.request.urlopen("http://localhost:8080/api/platform/organizations/default").read().decode())' | grep -q "Default Organization"; then
    echo "[OK] Mock Org route is working."
else
    echo "[FAIL] Mock Org route is broken."
fi

# 2. Test Mock Project
if docker exec erp-studio-injector python3 -c 'import urllib.request; print(urllib.request.urlopen("http://localhost:8080/api/platform/projects/default").read().decode())' | grep -q "Default Project"; then
    echo "[OK] Mock Project route is working."
else
    echo "[FAIL] Mock Project route is broken."
fi

# 3. Test Legacy Keys Bridge
if docker exec erp-studio-injector python3 -c 'import urllib.request; print(urllib.request.urlopen("http://localhost:8080/api/v1/projects/default/api-keys/legacy").read().decode())' | grep -q "anon"; then
    echo "[OK] Legacy keys bridge is working."
else
    echo "[FAIL] Legacy keys bridge is broken."
fi

# 4. Test Creation 405
if docker exec erp-studio-injector python3 -c 'import urllib.request; req = urllib.request.Request("http://localhost:8080/api/v1/projects/default/api-keys", method="POST"); 
try: urllib.request.urlopen(req)
except Exception as e: print(e.code)' | grep -q "405"; then
    echo "[OK] Creation 405 is correctly handled."
else
    echo "[FAIL] Creation 405 is not handled correctly."
fi

echo "[INFO] Health check complete."
