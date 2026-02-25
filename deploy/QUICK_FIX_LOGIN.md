# Fix "Invalid email or password" (400) – Quick login users

Supabase Auth must have the same passwords as the app. Run this **on the VPS** (SSH as root).

## 1. Pull latest code (so the script exists)

```bash
cd ~/NEWPOSV3
git pull origin main
```

## 2. Run the auth fix script

```bash
bash deploy/fix-quick-login-users-vps.sh
```

This updates `auth.users` for:
- **admin@dincouture.pk** → password `AdminDincouture2026`
- **info@dincouture.pk** → password `InfoDincouture2026`
- **demo@dincollection.com** → password `demo123`

## 3. If script fails (e.g. "container not found")

Find the Postgres container name:

```bash
docker ps --format '{{.Names}}' | grep -E 'db|postgres|supabase'
```

Then run SQL manually (replace `CONTAINER` with the name, e.g. `supabase-db` or `db`):

```bash
docker exec -i CONTAINER psql -U postgres -d postgres << 'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE auth.users SET encrypted_password = crypt('InfoDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'info@dincouture.pk';
UPDATE auth.users SET encrypted_password = crypt('AdminDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'admin@dincouture.pk';
UPDATE auth.users SET encrypted_password = crypt('demo123', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'demo@dincollection.com';
SQL
```

## 4. Test

Open the mobile app, use **Info (info@dincouture.pk)** or **Admin** or **Demo** quick login. The 400 should stop after the script runs.
