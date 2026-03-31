#!/bin/bash
# Idempotent health-check script for Supabase Studio API Keys routes

INJECTOR_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' erp-studio-injector)

echo "Checking Studio API Keys health..."

# 1. Check organization mock
if curl -s "http://$INJECTOR_IP:8080/api/platform/organizations/default" | grep -q "Default Organization"; then
    echo "[OK] Organization mock is working."
else
    echo "[FAIL] Organization mock is broken!"
    exit 1
fi

# 2. Check project mock
if curl -s "http://$INJECTOR_IP:8080/api/platform/projects/default" | grep -q "Default Project"; then
    echo "[OK] Project mock is working."
else
    echo "[FAIL] Project mock is broken!"
    exit 1
fi

# 3. Check legacy keys bridge
if curl -s "http://$INJECTOR_IP:8080/api/v1/projects/default/api-keys/legacy" | grep -q "anon"; then
    echo "[OK] Legacy keys bridge is working."
else
    echo "[FAIL] Legacy keys bridge is broken!"
    exit 1
fi

# 4. Check POST creation error
if curl -s -X POST "http://$INJECTOR_IP:8080/api/v1/projects/default/api-keys" | grep -q "not supported"; then
    echo "[OK] POST creation handler is working."
else
    echo "[FAIL] POST creation handler is broken!"
    exit 1
fi

echo "All Studio API Keys health checks passed!"
