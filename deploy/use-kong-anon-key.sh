#!/bin/bash
# Set .env.production and Supabase .env to use the same anon key as Kong
set -e
KONG_ANON=$(docker exec supabase-kong sh -c 'echo "$SUPABASE_ANON_KEY"' | tr -d '\n\r')
echo "Updating /root/NEWPOSV3/.env.production with Kong anon key..."
sed -i "s|^VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=$KONG_ANON|" /root/NEWPOSV3/.env.production
grep VITE_SUPABASE /root/NEWPOSV3/.env.production
echo "Updating /root/supabase/docker/.env ANON_KEY..."
sed -i "s|^ANON_KEY=.*|ANON_KEY=$KONG_ANON|" /root/supabase/docker/.env
echo "Done. Rebuild ERP and restart auth if needed."
