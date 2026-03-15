# 502 on supabase.dincouture.pk/auth/v1/* – Diagnose & Fix

When the browser gets **502** on `https://supabase.dincouture.pk/auth/v1/token?grant_type=refresh_token`, the failure is on the **VPS**: Kong (API gateway) or the auth (GoTrue) service is down or misconfigured.

## 0. If Kong is in a restart loop ("Restarting (1) XX seconds ago")

Kong never stays up, so every request returns 502. **First capture the crash reason**:

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/kong-logs.sh"
```

Look in the Kong logs for:
- **"failed parsing declarative configuration"** → run `bash deploy/fix-kong-502-auth.sh` (it will apply the CORS fix and restart Kong).
- **"hide_credentials"** or other plugin errors → fix or remove that plugin in `kong.yml`.
- **OOM / killed** → increase memory or simplify Kong config.
- Any other **error** or **panic** line → fix that before restarting.

Then restart only after fixing the cause:  
`ssh dincouture-vps "cd /root/supabase/docker && docker compose restart kong"`

## 1. SSH and check containers

```bash
ssh dincouture-vps "docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep -E 'kong|auth|traefik'"
```

- If **Kong** or **auth** are `Exited` or `Restarting`, that’s the cause.
- If **Traefik** is down, `supabase.dincouture.pk` won’t reach Kong.

## 2. Run the Kong 502 fix script

Kong can crash with "failed parsing declarative configuration" (e.g. misplaced CORS in `kong.yml`). The fix script only changes config when Kong logs show that error.

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy/fix-kong-502-auth.sh"
```

If the script says it applied the fix, it restarts Kong and waits ~25s. Then test (see step 4).

## 3. If 502 persists: check Kong and auth logs

```bash
# Kong logs (look for parse errors or crashes)
ssh dincouture-vps "docker logs supabase-kong --tail 100"

# Auth (GoTrue) logs
ssh dincouture-vps "docker logs supabase-auth --tail 50"
```

- **Kong:** "failed parsing declarative configuration" → fix was for that; if you still get 502, ensure Kong restarted and Traefik routes to it.
- **Auth:** If auth is crashing or not listening, Kong will return 502 when proxying to it.

Restart if needed:

```bash
ssh dincouture-vps "cd /root/supabase/docker && docker compose restart kong auth"
# Wait ~30s then test
```

## 4. Test auth health from the VPS

```bash
# Get anon key from Supabase .env on VPS, then:
ssh dincouture-vps "source /root/supabase/docker/.env 2>/dev/null; curl -sS -o /dev/null -w '%{http_code}' -H \"apikey: \$ANON_KEY\" https://supabase.dincouture.pk/auth/v1/health"
```

- **200** → Auth is OK; if the browser still gets 502, check Traefik routing or try from another network.
- **502** → Kong or auth is still down; re-check container status and logs (steps 1 and 3).
- **401** → Auth is up; 401 is expected without a valid session (health endpoint may still return 401 depending on setup).

## 5. Traefik routing for supabase.dincouture.pk

Ensure Traefik routes `supabase.dincouture.pk` to the Kong container (same Docker network as Kong). If you use Dokploy:

```bash
ssh dincouture-vps "docker ps --format '{{.Names}}' | grep -E traefik|kong"
```

Kong must be on the network Traefik uses to route that host (e.g. `dokploy-network` or the Supabase network exposed to Traefik).

## Summary

| Step | Action |
|------|--------|
| 1 | Check Kong and auth container status |
| 2 | Run `deploy/fix-kong-502-auth.sh` on VPS |
| 3 | If still 502, check Kong and auth logs and restart `kong` + `auth` |
| 4 | Test `https://supabase.dincouture.pk/auth/v1/health` (with anon key) from VPS |
| 5 | Confirm Traefik routes supabase.dincouture.pk to Kong |

After Kong and auth are healthy, the app’s refresh-token and login requests should succeed without 502.
