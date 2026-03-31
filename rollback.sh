#!/bin/bash
# Rollback script for Supabase Studio API Keys fix

echo "Rolling back Supabase Studio API Keys fix..."

# 1. Revert Traefik config
if [ -f /etc/dokploy/traefik/dynamic/supabase.yml ]; then
    sed -i 's/url: http:\/\/erp-studio-injector:8080/url: http:\/\/supabase-studio:3000/' /etc/dokploy/traefik/dynamic/supabase.yml
    echo "[OK] Traefik config reverted."
fi

echo "Rollback complete. Studio is now hitting supabase-studio:3000 directly again."
