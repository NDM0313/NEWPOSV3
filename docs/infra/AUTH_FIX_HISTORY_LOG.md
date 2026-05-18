# Auth / production login fix — history and handover log

This document records **every repo script and deploy file touched** while diagnosing and fixing the **ERP (`erp.dincouture.pk`) → Supabase Kong** authentication bridge, why earlier attempts did or did not resolve symptoms, and the **final operator pipeline** applied when production showed **401 / 502** and **anon key length mismatch**.

It is intended as a **handover** for the next engineer or model if login still fails after the documented final steps.

---

## Symptom summary (production)

- Browser login against same-origin `https://erp.dincouture.pk/auth/...` failed or behaved inconsistently.
- VPS audit (`scripts/vps-audit-auth-bridge.sh`) eventually showed:
  - **`erp_anon_length` ≠ `kong_anon_length`** — the SPA bundle / `.env.production` did not match the anon JWT Kong expects from `/root/supabase/docker/.env`.
  - **`502 Bad Gateway`** from **erp-frontend’s nginx** when calling `/auth/v1/health` — nginx could not obtain a valid response from upstream **`supabase-kong:8000`** (Docker DNS/network, Kong down, or Kong unhealthy), distinct from **401** (wrong/missing API key).

---

## Architecture reminder (locked design)

| Layer | Role |
|--------|------|
| Browser | Same-origin `https://erp.dincouture.pk`; `src/lib/supabase.ts` forces that origin in production. |
| `erp-frontend` nginx | [`deploy/nginx.conf`](../../deploy/nginx.conf) proxies `/auth/`, `/rest/`, etc. to `http://supabase-kong:8000` with `Host: supabase.dincouture.pk`. |
| Docker | [`deploy/docker-compose.prod.yml`](../../deploy/docker-compose.prod.yml): service **`erp`** (`container_name: erp-frontend`) attaches to **`default`**, external **`supabase_default`**, and **`dokploy-network`**. Kong must be reachable as hostname **`supabase-kong`** on **`supabase_default`**. |
| Canonical keys | `/root/supabase/docker/.env` → **`ANON_KEY`**. ERP build must consume the same value via `NEWPOSV3/.env.production` (`VITE_SUPABASE_ANON_KEY`), written only by [`deploy/write-erp-env-from-supabase-docker-env.sh`](../../deploy/write-erp-env-from-supabase-docker-env.sh). |

---

## Scripts and files modified (chronological, by concern)

### 1. [`deploy/write-erp-env-from-supabase-docker-env.sh`](../../deploy/write-erp-env-from-supabase-docker-env.sh)

**Purpose:** Single writer that copies **`ANON_KEY`** (or `SUPABASE_ANON_KEY`) from **`/root/supabase/docker/.env`** into **`NEWPOSV3/.env.production`** and **`erp-mobile-app/.env.production`**, with `VITE_SUPABASE_URL=${ERP_ORIGIN}` (default `https://erp.dincouture.pk`), preserving `VITE_DISABLE_REALTIME` when present.

**Parsing note:** The script strips wrapping `"` from the anon value and avoids naive `cut -d= -f2` for the **anon** line (uses `${line#*=}` after selecting the line). A **wrong or stale** `.env.production` **without** re-running this script **and** rebuilding the Docker image leaves a **short or mismatched** anon baked into Vite output.

**Critical bug fixed (post-audit):** Using **`grep -E '^ANON_KEY=|^SUPABASE_ANON_KEY=' … | head -1`** picks the **first matching line in file order**. On the Din Couture VPS, **`SUPABASE_ANON_KEY=`** (stale / shorter JWT, e.g. **169** chars) appeared **before** **`ANON_KEY=`** (canonical Kong JWT, e.g. **176** chars). The writer then synced the **wrong** key into `NEWPOSV3/.env.production`, so **`write-erp-env` itself preserved the mismatch** even when operators ran it. The script now **prefers `^ANON_KEY=`** if present, else falls back to **`^SUPABASE_ANON_KEY=`**.

**Why “key sync” alone can fail:** Vite inlines `VITE_*` at **image build** time. Editing `.env.production` on disk does not change the running container until **`docker compose build`** (ideally **`--no-cache erp`**) and **`up`**.

---

### 2. [`deploy/deploy.sh`](../../deploy/deploy.sh)

**Changes relevant to auth / ERP stability:**

- Orchestrates: storage JWT fix → Kong domain / CORS → **`write-erp-env-from-supabase-docker-env.sh`** → loads `.env.production` → **`CACHEBUST=$(date +%s)`** appended to `.env.production` → **`docker compose -f deploy/docker-compose.prod.yml --env-file .env.production build --no-cache erp`** → tear down fixed-name containers / network → **`up -d --force-recreate erp`**.
- **Container name conflicts:** Repeated `docker compose up` sometimes failed with **`Conflict. The container name "/erp-frontend" is already in use`**. Mitigations added over time:
  - **`docker rm -f erp-frontend`** (and siblings) before `up`.
  - **`docker compose down --remove-orphans`** and **`docker network rm deploy_default`** when the default project network stuck around.
  - **`docker kill`** before **`docker rm -f`** and a short **`sleep 2`** after `down` so the name is released reliably.

**Why deploy could “succeed” but login still break:** If **`write-erp-env`** was skipped, failed, or pointed at the wrong `SUPABASE_ENV`, the **build** still ran with an old anon. If **`supabase-kong`** was unreachable, runtime would show **502** regardless of keys.

---

### 3. [`deploy/nginx.conf`](../../deploy/nginx.conf) (inside `erp-frontend` image)

**Changes (auth bridge hardening):**

- **`client_max_body_size 50m`** on the `server` block — reduces risk of truncated JSON on login or large API payloads vs strict defaults.
- **`proxy_buffering off`** on **`/auth/`** and **`/rest/`** (in addition to existing `/realtime/` behavior) — avoids nginx buffering oddities on long-lived or streaming-style responses.

**Why this did not fix 502:** **502** from this nginx means **upstream** (`supabase-kong:8000`) did not return a valid HTTP response (connection refused, timeout, no route). Buffering and body size do not fix a **dead or unreachable Kong**.

---

### 4. [`scripts/vps-audit-auth-bridge.sh`](../../scripts/vps-audit-auth-bridge.sh) (new; iterated)

**Evolution:**

1. **Initial version:** Grep JS bundles under `/usr/share/nginx/html/assets`; **`curl`** `GET /auth/v1/health` with **`apikey`** / **`Authorization`** from `.env.production`.
2. **Bug fix:** Reading `VITE_SUPABASE_ANON_KEY` with **`cut -d= -f2-`** **truncates JWTs** at the first **`=`** inside the payload (Base64 padding). Replaced with **`sed 's/^VITE_SUPABASE_ANON_KEY=//'`** for the ERP key only.
3. **Second iteration:** **`curl`** with **`Authorization: Bearer`** still produced confusing results on some shells; **401** vs **“No API key”** depended on header construction. **`-H @file`** mistakes (file contained only the raw JWT without `apikey:` prefix) produced **“No API key found in request”**.
4. **Current version:** Uses **Python 3** (`urllib.request`) to:
   - Parse `.env` lines by **first `=`** only and optional quotes.
   - Compare **ERP anon** vs **`/root/supabase/docker/.env`** **`ANON_KEY`** (override `SUPABASE_DOCKER_ENV`).
   - Print **`jwt_segments`** count and **WARN** when ERP and Docker keys differ.
   - Hit **`https://erp.dincouture.pk/auth/v1/health`** and **`http://127.0.0.1:3001/auth/v1/health`** (Traefik vs local nginx).

**Why the audit once showed “good” diagnosis but wrong HTTP codes:** Truncated anon (**`cut` bug**) → **401 Invalid authentication credentials**. After fixing parsing, **502** exposed the real **upstream** failure. **Key length mismatch** (e.g. 169 vs 176) was often **`write-erp-env` reading `SUPABASE_ANON_KEY` before `ANON_KEY`** (see [`AUTH_FIX_HISTORY_LOG.md`](AUTH_FIX_HISTORY_LOG.md)), while the audit script read **`ANON_KEY`** only for the “kong” side.

---

### 5. [`deploy/hard-rebuild-erp.sh`](../../deploy/hard-rebuild-erp.sh) (added in final fix)

**Purpose:** Run on the **VPS** only: bumps **`CACHEBUST`**, kills/removes fixed-name compose containers, **`docker compose … build --no-cache erp`**, **`up -d --force-recreate erp`**. Uses a **bash array** for `docker compose` so commands are not broken by **Windows OpenSSH clients** mangling **`$VAR`**.

---

### 6. Other related deploy work (referenced; not exhaustive)

Commits and scripts in the same era (from `git log` on auth-touched paths): **`deploy/docker-compose.prod.yml`** (fixed `container_name`, external networks), smoke / mobile rebuild guards (`d412b50`, `27ef296`, etc.), **`fix(deploy): auth smoke retries; rebuild /m/ only on 401/403 not 502`** — **502** intentionally does **not** trigger the same rebuild path as **401**, because 502 is infrastructure, not anon mismatch.

---

## Root causes (as confirmed on VPS)

1. **Key mismatch:** `VITE_SUPABASE_ANON_KEY` baked into the ERP image did not match the **canonical** Kong anon. Often this was **`SUPABASE_ANON_KEY=` vs `ANON_KEY=` order** in `/root/supabase/docker/.env` combined with **`grep -E '…|…' | head -1`** in `write-erp-env` (see above). The VPS audit’s Python reader used **`ANON_KEY=`** only, so it reported **`kong_anon_length=176`** while **`write-erp-env` wrote 169** from the other line — not a mysterious “cache” bug.
2. **Upstream / network:** **`erp-frontend` nginx → `supabase-kong:8000`** can return **502** when Kong is restarting, unhealthy, or not reachable; **`erp-frontend`** must be attached to **`supabase_default`** (it was on the Din Couture VPS: **`deploy_default`**, **`dokploy-network`**, **`supabase_default`**). Idempotent **`docker compose up -d`** in **`/root/supabase/docker`** clears transient stack issues.

---

## Final fix pipeline (this session — operator checklist)

Run on the VPS as **root** (paths assume [`vps-ssh.mdc`](../../.cursor/rules/vps-ssh.mdc) host **`dincouture-vps`** and repo **`/root/NEWPOSV3`**).

### Step 1 — Upstream / Docker network

```bash
docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep -iE "kong|erp-frontend" || true
docker network ls | grep -E "supabase_default|deploy_default|dokploy" || true
# erp-frontend must list supabase_default among its networks:
docker inspect erp-frontend --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null || true
# Kong container (name may vary) must be on supabase_default and listening:
docker ps --format '{{.Names}}' | grep -i kong | head -1 | xargs -I{} docker inspect {} --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

If **Kong** is missing or **unhealthy**, restart the self-hosted Supabase stack (typical location):

```bash
cd /root/supabase/docker && docker compose ps && docker compose up -d
```

Confirm **`supabase_default`** exists (`docker network inspect supabase_default`). [`deploy/docker-compose.prod.yml`](../../deploy/docker-compose.prod.yml) declares **`supabase_default: external: true`** — the ERP stack **does not create** it; the Supabase project must create it.

### Step 2 — Force key sync (overwrite ERP Vite env from Docker `.env`)

Requires a `write-erp-env-from-supabase-docker-env.sh` that **prefers `ANON_KEY=`** over `SUPABASE_ANON_KEY=` when both exist (see repo `main` after the auth-fix handover commit). Then:

```bash
cd /root/NEWPOSV3
git fetch origin && git reset --hard origin/main   # optional: match repo scripts/docs
bash deploy/write-erp-env-from-supabase-docker-env.sh
# Expect: anon length matches full Kong JWT (e.g. 176), not a stale shorter SUPABASE_ANON_KEY line
```

Optional: `SUPABASE_ENV=/path/to/docker/.env` if non-default.

### Step 3 — Hard rebuild `erp` (no cache) and recreate container

Match **`deploy/deploy.sh`** compose invocation (includes **`--env-file .env.production`** and **`CACHEBUST`** so Docker does not reuse stale Vite layers).

**Windows / PowerShell over SSH:** do **not** paste blocks that use **`$COMPOSE_CMD`** or **`$(date …)`** — the **local** shell may strip or rewrite them before the remote sees the command (symptom: `compose: command not found`). On the VPS, run the checked-in helper:

```bash
cd /root/NEWPOSV3
git fetch origin && git reset --hard origin/main
bash deploy/hard-rebuild-erp.sh
```

Equivalent manual block (run **on the VPS** in an interactive root shell, not from PowerShell):

```bash
cd /root/NEWPOSV3
CACHEBUST=$(date +%s)
grep -v '^CACHEBUST=' .env.production > .env.production.tmp 2>/dev/null || cp .env.production .env.production.tmp
echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
mv .env.production.tmp .env.production

COMPOSE_CMD='docker compose -f deploy/docker-compose.prod.yml --env-file .env.production'
docker kill erp-frontend 2>/dev/null || true
docker rm -f erp-frontend erp-backup-page erp-studio-injector 2>/dev/null || true
$COMPOSE_CMD down --remove-orphans 2>/dev/null || true
docker network rm deploy_default 2>/dev/null || true
sleep 2
$COMPOSE_CMD build --no-cache erp
$COMPOSE_CMD up -d --force-recreate erp
```

(If other services such as **`backup-page`** / **`studio-injector`** are required, run the full **`bash deploy/deploy.sh`** after the above; the minimum for login is **`erp`** healthy.)

### Step 4 — Verification

```bash
cd /root/NEWPOSV3 && bash scripts/vps-audit-auth-bridge.sh
```

**Expected:** `erp_anon_length` equals `kong_anon_length` (e.g. **176**), no WARN for key mismatch, **`public_erp_http=200`** and **`local_3001_http=200`** for `/auth/v1/health` (JSON body, not nginx 502 HTML).

**Post-fix check (Din Couture VPS, after `efbeb4b` + `2ccbb38`):** `erp_anon_length=176`, `kong_anon_length=176`, `public_erp_http=200`, `local_3001_http=200` (GoTrue JSON).

---

## If this pipeline still fails

| Observation | Likely cause | Next check |
|---------------|--------------|------------|
| Still **502** | Kong not on `supabase_default`, wrong hostname, or Kong crashloop | `docker logs` on Kong; `docker compose ps` in `/root/supabase/docker`; verify **`supabase-kong`** DNS from inside **`erp-frontend`**: `docker exec erp-frontend wget -qO- http://supabase-kong:8000/` or health route. |
| **200** on VPS but browser **401** | CDN/service worker caching old JS | Hard refresh, disable cache, bump `CACHEBUST`, confirm new asset hash in Network tab. |
| Lengths match but **401** | JWT corrupt in **`/root/supabase/docker/.env`** (rare) or Kong DB desync | Compare first/last 8 chars of anon only (do not paste full keys); run **`deploy/fix-supabase-storage-jwt.sh`** only with ops approval (rotates keys). |

---

## Commit references (main — auth bridge / deploy touchpoints)

Recent commits touching this area (non-exhaustive): `efbeb4b` (prefer **`ANON_KEY=`** in `write-erp-env` + this log), `2ccbb38` (`hard-rebuild-erp.sh`), `16e1d12`, `5bd2525`, `a2c251d`, `19dcfe4` (audit script + nginx + deploy teardown), plus earlier compose / name-conflict and smoke-test commits.

---

*Last updated: added `write-erp-env` **ANON_KEY-first** selection fix and expanded root-cause notes (`SUPABASE_ANON_KEY` vs `ANON_KEY` line order); amend when new root causes are found.*
