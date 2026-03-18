#!/bin/bash
# Test auth using Kong's anon key (run on VPS)
K=$(docker exec supabase-kong printenv SUPABASE_ANON_KEY 2>/dev/null | tr -d '\r\n')
echo "Testing admin login with Kong anon key..."
curl -sk -X POST "https://supabase.dincouture.pk/auth/v1/token?grant_type=password" \
  -H "apikey: $K" -H "Content-Type: application/json" \
  -d '{"email":"admin@dincouture.pk","password":"AdminDincouture2026"}'
