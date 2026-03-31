#!/bin/bash
# rollback-studio-api-keys-fix.sh
# Reverts the Supabase Studio API Keys page bridge changes.

# 1. Update Traefik config to point back to Studio
if [ -f /etc/dokploy/traefik/dynamic/supabase.yml ]; then
    sed -i 's/url: http:\/\/erp-studio-injector:8080/url: http:\/\/studio:3000/' /etc/dokploy/traefik/dynamic/supabase.yml
    echo "[OK] Traefik configuration reverted to point to studio:3000."
fi

# 2. Stop and remove the injector container
if docker ps -a | grep -q erp-studio-injector; then
    docker stop erp-studio-injector
    docker rm erp-studio-injector
    echo "[OK] erp-studio-injector container stopped and removed."
fi

# 3. Clean up the deployment directory
if [ -d /root/NEWPOSV3/deploy/studio-injector ]; then
    rm -rf /root/NEWPOSV3/deploy/studio-injector
    echo "[OK] erp-studio-injector deployment files removed."
fi

echo "[INFO] Rollback complete."
