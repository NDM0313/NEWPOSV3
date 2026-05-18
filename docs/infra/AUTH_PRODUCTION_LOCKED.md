# Production authentication pipeline (LOCKED)

This document defines the **canonical** way Supabase keys reach the Din Couture ERP web app and mobile PWA (`/m/`). **Do not change** this flow in drive-by refactors.

## Single source of truth

| Artifact | Role |
|----------|------|
| `/root/supabase/docker/.env` on the VPS | **`JWT_SECRET`**, **`ANON_KEY`** / **`SERVICE_ROLE_KEY`** (JWTs signed for self-hosted Supabase). Kong and GoTrue load from here. |
| `NEWPOSV3/.env.production` | **`VITE_SUPABASE_*`** used at **Docker build** time for the main SPA and `erp-mobile-app` (see [`deploy/Dockerfile`](../../deploy/Dockerfile)). Must match the anon JWT in the Supabase file. |

## Scripts (allowed touch points)

1. [`deploy/fix-supabase-storage-jwt.sh`](../../deploy/fix-supabase-storage-jwt.sh) — Regenerates `ANON_KEY` / `SERVICE_ROLE_KEY` from `JWT_SECRET`, writes **only** `/root/supabase/docker/.env`, recreates Kong/Studio/Storage/Functions and restarts Auth/Rest. Does **not** write `NEWPOSV3/.env.production`.
2. [`deploy/fix-supabase-kong-domain.sh`](../../deploy/fix-supabase-kong-domain.sh) — `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, GoTrue **`SITE_URL`**, redirect allow-list for `https://erp.dincouture.pk`. **Default:** does **not** copy Kong’s runtime anon into ERP env (opt-in: `SYNC_KONG_ANON_TO_ERP_ENV=1` for debugging only).
3. [`deploy/add-kong-cors-erp-origin.sh`](../../deploy/add-kong-cors-erp-origin.sh) — Kong `kong.yml` CORS for `https://erp.dincouture.pk`.
4. [`deploy/write-erp-env-from-supabase-docker-env.sh`](../../deploy/write-erp-env-from-supabase-docker-env.sh) — **Only** script that writes `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_DISABLE_REALTIME` into **`NEWPOSV3/.env.production`** and **`erp-mobile-app/.env.production`**, by **reading anon from the Supabase docker `.env` file** (not `docker exec` Kong).

[`deploy/deploy.sh`](../../deploy/deploy.sh) orchestrates **once per full deploy**: (1) storage JWT fix → (2) Kong domain / GoTrue URLs → (3) Kong CORS → (4) `write-erp-env-from-supabase-docker-env.sh` → verify → Docker `build --no-cache erp` → `up`.

## Client runtime (locked behavior)

- [`src/lib/supabase.ts`](../../src/lib/supabase.ts) and [`erp-mobile-app/src/lib/supabase.ts`](../../erp-mobile-app/src/lib/supabase.ts) force **same-origin** `https://erp.dincouture.pk` in production so `/auth` and `/rest` go through ERP nginx → Kong (avoids cross-origin CORS on the browser).

## After changing keys

- Run a **full** `bash deploy/deploy.sh` on the VPS (not only “fixes-only”) so Vite rebakes anon into `dist` and `/m/`.
- Operators: **hard refresh** or clear site data once (PWA/service worker can retain old hashed assets).

## ERP Nginx → Kong (same-origin bridge)

- [`deploy/nginx.conf`](../../deploy/nginx.conf) proxies `/auth/`, `/rest/`, `/storage/`, `/realtime/` to `supabase-kong:8000` with `Host: supabase.dincouture.pk`. `client_max_body_size` and `proxy_buffering off` on `/auth/` and `/rest/` reduce risk of truncated or buffered JSON bodies on login and large filters.

## VPS bridge audit (read-only)

- Run on the VPS from the repo: `bash scripts/vps-audit-auth-bridge.sh` — prints `VITE_SUPABASE_URL`, anon length, which JS chunks reference `erp.dincouture.pk`, and HTTP status for `GET /auth/v1/health` via **public** `https://erp.dincouture.pk` and **local** `http://127.0.0.1:3001` (uses `--header` so JWTs are not mangled by shell quoting).

**Localhost dev vs production:** dev uses the Vite `/supabase` proxy ([`vite.config.ts`](../../vite.config.ts)); production uses same-origin `erp.dincouture.pk` and this Nginx path. Same database does not imply the same HTTP hop.

## Console noise (not Supabase)

Messages such as **“Host validation failed”** / **“insights whitelist”** often come from **third-party analytics or browser extensions**, not GoTrue. Confirm in **Network** that requests to your own origin fail before attributing to this pipeline.

## Change policy

Changes to Kong auth env, GoTrue `SITE_URL` / redirect lists, CORS, JWT regeneration, or ERP `.env.production` writing require **explicit product owner approval** and an update to this document.
