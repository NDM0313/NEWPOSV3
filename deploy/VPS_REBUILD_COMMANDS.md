# VPS Rebuild – Commands (no script needed)

Run these on the VPS from the project root `~/NEWPOSV3`:

```bash
cd ~/NEWPOSV3

# 1. Ensure .env.production exists (create if not)
# VITE_SUPABASE_URL=https://erp.dincouture.pk
# VITE_SUPABASE_ANON_KEY=<your-anon-key>

# 2. Build and start (Docker runs npm build inside container)
docker compose -f deploy/docker-compose.prod.yml --project-directory /root/NEWPOSV3 --env-file .env.production up -d --build
```

If your project root is different, replace `/root/NEWPOSV3` with `$(pwd)`:

```bash
cd ~/NEWPOSV3
docker compose -f deploy/docker-compose.prod.yml --project-directory "$(pwd)" --env-file .env.production up -d --build
```

Then hard-refresh the browser (Ctrl+Shift+R).
