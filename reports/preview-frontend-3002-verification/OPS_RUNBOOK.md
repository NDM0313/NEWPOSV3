# Preview :3002 verification runbook (ops-run)

**Status:** Ready for workstation execution  
**Mode:** Zero-risk — frontend preview inspect only  
**Decisions:** (1B) ops runs docker/curl on VPS from office SSH; (2A) verify in-memory sidebar collapse only — no localStorage/cookie changes  
**Date:** 2026-10-11  
**Compose SoT:** [`deploy/docker-compose.preview.yml`](../../deploy/docker-compose.preview.yml)

Cloud Agent has no VPS SSH key. Run every shell command below from the office workstation (`ssh dincouture-vps` or an already-open root session).

---

## Isolation confirmation (repo — no mutation)

| Claim | Evidence |
|-------|----------|
| Parallel slot only | `container_name: erp-frontend-preview`, host **`3002:80`** |
| Does not bind prod ERP | Prod remains `erp-frontend` on **3001** / `erp.dincouture.pk` |
| No compose volumes | No `volumes:` on `erp-preview` service |
| Own bridge network | `networks.default` driver `bridge` — not joined to Traefik/Kong/Supabase networks in this file |
| Static nginx only | [`deploy/Dockerfile`](../../deploy/Dockerfile): build `dist` + mobile PWA → `nginx:alpine` on port 80 |
| No migrations | Compose header: do **not** run `deploy/deploy.sh` |

Inspecting or curling this container does **not** alter production volumes, live DB schemas, Traefik, Kong, or port 3001. Browser login after tunnel may call baked Supabase URLs (client→API only).

```text
Office browser --ssh -L 3002--> VPS 127.0.0.1:3002 --> erp-frontend-preview (nginx)
                                                      --> static dist + /m
Production erp-frontend :3001  (untouched)
```

---

## Part 1 — Diagnostics & health (on VPS)

### 1.1 Container presence

```bash
docker ps --filter name=erp-frontend --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
```

**Pass:**

- `erp-frontend-preview` Up, ports include `0.0.0.0:3002->80/tcp`
- `erp-frontend` still Up on `3001` (production untouched)

### 1.2 Logs

```bash
docker logs --tail 50 erp-frontend-preview
```

**Pass:** nginx started / workers ready; no repeated `connect() failed`, `host not found in upstream`, or crash loops. Normal access-log GET lines are OK.

### 1.3 Inspect (optional)

```bash
docker inspect erp-frontend-preview --format '{{.State.Health.Status}} binds={{json .HostConfig.Binds}} ports={{json .HostConfig.PortBindings}} image={{.Config.Image}}'
```

**Pass:** `Binds` null/empty; PortBindings map host **3002** → container 80; image `erp-frontend-preview:latest` (or your tagged build).

### 1.4 HTTP probes

Nginx routes ([`deploy/nginx.conf`](../../deploy/nginx.conf)):

- `/` → SPA `try_files` → `index.html`
- `location = /m` → **301** `/m/`
- `/m/` → mobile PWA alias
- Hashed `/assets/*` → long-cache static files

```bash
# Base SPA — expect HTTP 200
curl -sI http://127.0.0.1:3002/ | head -20

# Exact /m — expect 301 → /m/
curl -sI http://127.0.0.1:3002/m | head -20

# Mobile PWA — expect 200
curl -sI http://127.0.0.1:3002/m/ | head -20

# One real hashed asset — /assets/ alone may 403/404
ASSET=$(docker exec erp-frontend-preview sh -c 'ls /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1 | xargs -n1 basename')
echo "ASSET=$ASSET"
curl -sI "http://127.0.0.1:3002/assets/${ASSET}" | head -20
```

| Path | Expected |
|------|----------|
| `/` | **200**, `text/html` |
| `/m` | **301** → `/m/` |
| `/m/` | **200**, mobile HTML |
| `/assets/<hashed>.js` | **200** |

**Fail action:** capture `docker logs --tail 100 erp-frontend-preview` + failing `curl -vI`; do not start browser QA.

### 1.5 Ops checklist (tick when done)

- [ ] `docker ps` shows preview :3002 and prod :3001
- [ ] Logs clean (no upstream/crash errors)
- [ ] `curl -I` `/` → 200
- [ ] `curl -I` `/m` → 301
- [ ] `curl -I` `/m/` → 200
- [ ] One `/assets/*.js` → 200

---

## Part 2 — Safe exposure / tunnel (office workstation)

### 2.1 Canonical SSH tunnel

Matches compose comment and Phase 2.9A-3 preview plan:

```bash
ssh -N -L 3002:127.0.0.1:3002 dincouture-vps
```

Browser: **http://localhost:3002** (not `https://erp.dincouture.pk`).

Keep mapping **local 3002 → VPS 127.0.0.1:3002**. Do not use older phase scripts that tunnel to **:3003** unless `docker ps` shows preview on 3003.

### 2.2 Cursor / IDE port forward

If Cursor (or VS Code) Remote-SSH is attached to the VPS:

1. Open Ports / Port Forwarding
2. Forward remote port **3002** → local port **3002**
3. Open http://localhost:3002

Same semantics as `ssh -N -L 3002:127.0.0.1:3002`. No Cloud Agent port-forward setting is required.

### 2.3 Ops checklist

- [ ] Tunnel or IDE forward active
- [ ] http://localhost:3002 loads login/app shell
- [ ] Production site on :3001 / erp.dincouture.pk still serves independently

---

## Part 3 — Sidebar & navigation (code findings + browser)

### 3.1 Code findings (verify-only — no code changes)

| Item | Finding |
|------|---------|
| Live shell | [`src/app/components/layout/Layout.tsx`](../../src/app/components/layout/Layout.tsx) mounts `Sidebar` |
| State | [`NavigationContext.tsx`](../../src/app/context/NavigationContext.tsx): `const [isSidebarOpen, setIsSidebarOpen] = useState(true)`; `toggleSidebar` uses functional updater |
| UI | [`Sidebar.tsx`](../../src/app/components/layout/Sidebar.tsx): Framer `animate={{ width: isSidebarOpen ? 260 : 80 }}`; chevron calls `toggleSidebar` |
| Collapsed nav | Parent item click while collapsed auto-expands (`if (!isSidebarOpen) toggleSidebar()`) |
| Persistence | **None** on live path — hard refresh resets to expanded |
| Hydration | Collapse state does not read `localStorage`/cookie on init → no SSR mismatch from persistence |
| Unused kit | [`ui/sidebar.tsx`](../../src/app/components/ui/sidebar.tsx) cookie `sidebar_state` is **not** wired into Layout |

### 3.2 Browser checklist (http://localhost:3002)

1. Login (baked `VITE_SUPABASE_*` — staging/prod API as configured at image build).
2. Desktop: chevron collapse → icon rail (~80px); expand → labels (~260px).
3. Hard refresh → sidebar **expanded** again (expected under 2A).
4. DevTools Console: no React hydration mismatch when toggling.
5. Narrow viewport: hamburger → `MobileNavDrawer` (separate from desktop rail).
6. Optional UI smoke (no flag/DB writes): `/?view=accounting`, `/?view=party-ledger`.

### 3.3 Ops checklist

- [ ] 260 ↔ 80 toggle works
- [ ] Refresh resets to open
- [ ] No console hydration errors on toggle
- [ ] Optional accounting / party-ledger views render

---

## Ready-for-inspection gate

Port **3002** is ready for E2E browser inspection when all are true:

1. `erp-frontend-preview` Up on `0.0.0.0:3002->80/tcp`; `erp-frontend` still on 3001  
2. Logs show clean nginx start  
3. HTTP probe table passes  
4. Tunnel up → http://localhost:3002 loads app  
5. Sidebar 260↔80 works with no hydration errors  

If any gate fails, paste command outputs back for diagnosis. Do not rebuild or restart production containers as part of this runbook.

---

## Out of scope

- Cloud Agent VPS SSH
- Image rebuild / compose edits / `deploy/deploy.sh`
- Migrations, RLS, volume mounts, production restarts
- Sidebar localStorage or cookie persistence
