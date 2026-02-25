# Fix "Invalid email or password" (400) + Deploy TLS timeout

## A. Fix login 400 (run first – no Docker build)

On VPS, update auth passwords so quick login works:

```bash
cd ~/NEWPOSV3
git pull origin main
bash deploy/run-fix-login-auth.sh
```

Or if that script is missing: `bash deploy/fix-quick-login-users-vps.sh`

Passwords set: **admin** / **info** / **demo** → `AdminDincouture2026` / `InfoDincouture2026` / `demo123`

## B. Fix deploy (TLS timeout on python:3.11-alpine)

Deploy now builds **only the ERP** image, so Docker Hub timeout on studio-injector does not block.

```bash
cd ~/NEWPOSV3
git pull origin main
bash deploy/deploy.sh
```

Then test: https://erp.dincouture.pk and https://erp.dincouture.pk/m/

## C. If auth script fails (container not found)

Find Postgres: `docker ps --format '{{.Names}}' | grep -E 'db|postgres|supabase'`

Then (replace CONTAINER):  
`docker exec -i CONTAINER psql -U postgres -d postgres -v ON_ERROR_STOP=1 < deploy/fix-login-auth-only.sql`
