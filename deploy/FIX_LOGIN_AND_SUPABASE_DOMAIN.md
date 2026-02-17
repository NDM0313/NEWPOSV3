# Fix: Login 401 + supabase.dincouture.pk Not Working

## 1. Invalid authentication credentials (401) – FIXED

**Root cause:** The anon key in `.env.production` and `/root/supabase/docker/.env` was **different** from the key **Kong** uses. Kong gets `SUPABASE_ANON_KEY` from its own env (set when the Supabase stack starts). The frontend and scripts were using the key from the Supabase `.env` file, which had a different JWT signature. Kong rejected requests and returned 401.

**Fix applied:** Run `deploy/use-kong-anon-key.sh` on the VPS to copy Kong’s anon key into `.env.production` and Supabase `.env`, then rebuild the ERP frontend. Login with `demo@dincollection.com` / `demo123` now works.

### Fix on VPS

1. **Generate a new anon key** with your current JWT_SECRET:

```bash
# On VPS, from Supabase docker dir
cd /root/supabase/docker
# Use Supabase CLI or generate JWT with payload: {"role":"anon","iss":"supabase-demo","iat":1641769200,"exp":1799535600}
# Or re-run Supabase init to regenerate keys:
docker compose exec kong env | grep -i jwt
# Then in Supabase repo: docker compose run --rm auth gotrue gen keys --secret <your JWT_SECRET>
```

2. **Or** use the script that comes with self-hosted Supabase to regenerate keys (see [Supabase self-host docs](https://github.com/supabase/supabase/tree/master/docker)).

3. **Update** `/root/supabase/docker/.env`:
   - Set `ANON_KEY=<new_anon_jwt>`
   - Restart Supabase stack: `cd /root/supabase/docker && docker compose restart kong auth`

4. **Update** ERP frontend env and rebuild:
   - On VPS: edit `/root/NEWPOSV3/.env.production` and set `VITE_SUPABASE_ANON_KEY=<same_new_anon_jwt>`
   - Rebuild: `cd /root/NEWPOSV3 && docker compose -f deploy/docker-compose.prod.yml --project-directory /root/NEWPOSV3 --env-file .env.production up -d --build`
   - Reconnect to network: `docker network connect dokploy-network erp-frontend`

5. **Demo user password** (once Kong accepts the key):
   - Run: `cat /root/NEWPOSV3/deploy/verify_and_fix_demo.sql | docker exec -i supabase-db psql -U postgres -d postgres`
   - Then login with `demo@dincollection.com` / `demo123`

---

## 2. supabase.dincouture.pk – connection refused (DNS is correct)

You already have an **A record** for `supabase` → `72.62.254.176`. If the browser still shows "Connection refused":

### Checks on VPS

1. **Firewall (UFW)**  
   Allow 443 (and 80 if using HTTP-01 for certs):
   ```bash
   sudo ufw allow 443/tcp
   sudo ufw allow 80/tcp
   sudo ufw status
   ```

2. **Traefik**  
   Reload so it picks up `supabase.dincouture.pk` and requests a cert:
   ```bash
   docker restart dokploy-traefik
   ```
   Wait 1–2 minutes, then try https://supabase.dincouture.pk again.

3. **Certificate**  
   Traefik uses Let’s Encrypt. For `supabase.dincouture.pk` it must be able to complete the challenge (HTTP on 80 or DNS). If 80 is open and the domain points to the VPS, the cert should be issued on first request.

4. **Test from the server**  
   ```bash
   curl -sI https://supabase.dincouture.pk/auth/v1/health
   ```
   If this returns 401 or JSON, the host and routing work; the problem is then only from the client (firewall, DNS cache, or wrong URL).

---

## Summary

| Issue | Likely cause | Action |
|-------|----------------|--------|
| 401 on login/signup | Anon key JWT not signed with server JWT_SECRET | Regenerate anon key, update Supabase + ERP .env, restart Kong/auth, rebuild ERP |
| supabase.dincouture.pk refused | Firewall or Traefik/cert | UFW allow 80/443, restart Traefik, test with curl from VPS |

After fixing the anon key, run `verify_and_fix_demo.sql` so the demo user’s password is `demo123`.
