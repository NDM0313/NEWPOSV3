#!/bin/bash
# =============================================================================
# ONE-SHOT: Seed data + link demo user + realtime WebSocket fix + rebuild ERP
# Run ONCE on VPS:  cd /root/NEWPOSV3 && bash deploy/COMPLETE_SEED_AND_REALTIME_VPS.sh
# Or from PC:  scp deploy/COMPLETE_SEED_AND_REALTIME_VPS.sh root@VPS_IP:/root/NEWPOSV3/deploy/
#              ssh root@VPS_IP "cd /root/NEWPOSV3 && bash deploy/COMPLETE_SEED_AND_REALTIME_VPS.sh"
# =============================================================================
set -e
cd /root/NEWPOSV3
mkdir -p deploy

echo "[1/5] Writing deploy/nginx.conf (realtime WebSocket headers + timeout)..."
cat > deploy/nginx.conf << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name erp.dincouture.pk;
    root /usr/share/nginx/html;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location /auth/ {
        proxy_pass http://supabase-kong:8000/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /rest/ {
        proxy_pass http://supabase-kong:8000/rest/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /realtime/ {
        proxy_pass http://supabase-kong:8000/realtime/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
    }
    location /storage/ {
        proxy_pass http://supabase-kong:8000/storage/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
NGINXEOF

echo "[2/5] Writing deploy/link_demo_user_and_seed_data.sql..."
cat > deploy/link_demo_user_and_seed_data.sql << 'SQLEOF'
INSERT INTO public.companies (id, name, email, phone, address, city, state, country, tax_number)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Din Collection',
  'info@dincollection.com',
  '+92-300-1234567',
  '123 Main Street, Saddar',
  'Karachi',
  'Sindh',
  'Pakistan',
  'NTN-123456789'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.branches (id, company_id, name, code, phone, address, city, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000011'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Main Branch (HQ)',
  'HQ',
  '+92-300-1234567',
  '123 Main Street, Saddar',
  'Karachi',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, company_id, email, full_name, role, is_active)
SELECT au.id, '00000000-0000-0000-0000-000000000001'::uuid, au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Demo Admin'), 'admin', true
FROM auth.users au WHERE au.email = 'demo@dincollection.com'
ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role = EXCLUDED.role, full_name = EXCLUDED.full_name, is_active = EXCLUDED.is_active;

DO $$
BEGIN
  INSERT INTO public.user_branches (user_id, branch_id, is_default)
  SELECT au.id, '00000000-0000-0000-0000-000000000011'::uuid, true
  FROM auth.users au WHERE au.email = 'demo@dincollection.com'
  ON CONFLICT (user_id, branch_id) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.contacts WHERE company_id = '00000000-0000-0000-0000-000000000001'::uuid) = 0 THEN
    INSERT INTO public.contacts (id, company_id, type, name, phone, email, address, city, opening_balance, current_balance, is_active)
    VALUES
      ('ct000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'customer', 'Ayesha Khan', '+92-300-1111111', 'ayesha@example.com', 'House 123, Block A, Gulshan-e-Iqbal', 'Karachi', 0, 0, true),
      ('ct000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'customer', 'Sara Ahmed', '+92-300-2222222', 'sara@example.com', 'Flat 456, DHA Phase 5', 'Karachi', 0, 0, true),
      ('ct000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'supplier', 'Fashion Fabrics Ltd', '+92-300-3333333', 'info@fashionfabrics.com', 'Shop 789, Cloth Market', 'Karachi', 0, 0, true),
      ('ct000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'supplier', 'Embroidery House', '+92-300-4444444', 'contact@embroideryhouse.com', 'Plaza ABC, Saddar', 'Karachi', 0, 0, true),
      ('ct000000-0000-0000-0000-000000000099'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'customer', 'Walk-in Customer', NULL, NULL, NULL, NULL, 0, 0, true);
  END IF;
END $$;
SQLEOF

echo "[3/5] Writing deploy/run_link_demo_and_seed.sh and running seed SQL..."
cat > deploy/run_link_demo_and_seed.sh << 'SCRIPTEOF'
#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/link_demo_user_and_seed_data.sql"
[ ! -f "$SQL_FILE" ] && { echo "Missing $SQL_FILE"; exit 1; }
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
[ -z "$CONTAINER" ] && { echo "No Postgres container found"; exit 1; }
echo "Using container: $CONTAINER"
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$SQL_FILE"
echo "Seed SQL done."
SCRIPTEOF
chmod +x deploy/run_link_demo_and_seed.sh
bash deploy/run_link_demo_and_seed.sh

echo "[4/5] Syncing Kong anon key and rebuilding ERP (this may take 1-2 min)..."
[ -x deploy/use-kong-anon-key.sh ] && bash deploy/use-kong-anon-key.sh || true
docker compose -f deploy/docker-compose.prod.yml --project-directory /root/NEWPOSV3 --env-file .env.production up -d --build --force-recreate

echo "[5/5] Connecting ERP to dokploy-network..."
docker network connect dokploy-network erp-frontend 2>/dev/null || true

echo ""
echo "=== DONE ==="
echo "1. Seed data + demo user link applied."
echo "2. nginx realtime WebSocket headers + timeout applied; ERP rebuilt."
echo "3. Refresh https://erp.dincouture.pk and check Contacts + Console (no 403 on realtime)."
