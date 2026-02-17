#!/bin/bash
set -e
ANON_KEY=$(grep '^ANON_KEY=' /root/supabase/docker/.env | cut -d= -f2-)
curl -sk -X POST "https://erp.dincouture.pk/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d '{"email":"demo@dincollection.com","password":"demo123"}'
