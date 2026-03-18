# Login 401 Unauthorized – Detail Analysis

**Last updated:** 2026-03-18  
**Issue:** Har account se login pe **401 Unauthorized** (ndm313@yahoo.com, ndm313@live.com, Admin, Demo) – localhost:5173 aur production dono pe.

---

## 1. Problem Summary

| Item | Detail |
|------|--------|
| **Symptom** | Sign In pe red error: "Unauthorized", console mein `[AUTH ERROR] Sign in failed`, status `401` |
| **Endpoint** | `POST https://supabase.dincouture.pk/auth/v1/token?grant_type=password` |
| **App config** | `VITE_SUPABASE_URL=https://supabase.dincouture.pk`, `VITE_SUPABASE_ANON_KEY=<JWT>` |
| **Affected** | Localhost (localhost:5173) + VPS se curl dono pe 401 |

---

## 2. Request Flow (Short)

```
Browser/curl
  → POST .../auth/v1/token (apikey: ANON_KEY, body: email + password)
  → Reverse proxy (supabase.dincouture.pk)
  → Kong (key-auth: apikey match)
  → GoTrue (password check, JWT issue)
  → 200 + access_token YA 401
```

**401 ka matlab:** Ya to Kong apikey reject kar raha hai, ya GoTrue (password / JWT) reject kar raha hai.

---

## 3. Kya Check Kiya / Kya Fix Kiya

### 3.1 Anon key sync

- **Kya tha:** Local `.env` ka key aur VPS Kong ka key different ho sakte the.
- **Kya kiya:** VPS se key nikal kar local `.env` mein `VITE_SUPABASE_ANON_KEY` set kiya.
- **Command:**  
  `ssh dincouture-vps "grep VITE_SUPABASE_ANON_KEY /root/NEWPOSV3/.env.production"`
- **Result:** Key match karta hai (174 char wala JWT), phir bhi 401.

### 3.2 Kong config mein key corruption ($ expansion)

- **Kya tha:** `.env` likhte waqt `echo "ANON_KEY=$ANON_VAL"` use hone se JWT ke andar `$i`, `$iss`, `$n` expand ho rahe the → key corrupt (e.g. `InR5cCI6` → `IR5cCI6`).
- **Kya kiya:**  
  - `deploy/fix-supabase-storage-jwt.sh` mein `echo` ki jagah `printf 'ANON_KEY=%s\n' "$NEW_ANON"` use kiya.  
  - `deploy/fix-anon-key-no-expand.sh` aur `deploy/vps-write-anon-key.py` bana kar safe write ensure kiya.
- **Result:** Kong config ab sahi key dikhata hai, lekin health/token dono pe ab bhi 401.

### 3.3 Passwords reset (auth.users)

- **Kya tha:** GoTrue galat password hash ki wajah se reject kar sakta tha.
- **Kya kiya:** `scripts/vps-reset-passwords-now.sql` run kiya – admin, ndm313@yahoo.com, ndm313@live.com, demo sab ke passwords reset (bcrypt).
- **Result:** Passwords update ho gaye; login ab bhi 401.

### 3.4 Auth health check

- **Test:** `GET https://supabase.dincouture.pk/auth/v1/health` with header `apikey: <ANON_KEY>`.
- **Result:** 401 (health pe bhi password nahi hota, isliye 401 = Kong ya upstream apikey reject kar raha hai).

### 3.5 Kong direct (127.0.0.1:8000)

- **Test:** VPS pe `curl -H 'apikey: <exact key>' -H 'Host: supabase.dincouture.pk' http://127.0.0.1:8000/auth/v1/health`.
- **Result:** 401.  
  Matlab 401 **Kong khud de raha hai**, proxy ki wajah se nahi.

### 3.6 Kong config verify

- **Check:** `docker exec supabase-kong cat /home/kong/kong.yml` → anon consumer ke andar key exact wahi JWT hai jo app bhej rahi hai.
- **Conclusion:** Config file mein key sahi hai, phir bhi Kong 401 de raha hai → key-auth match fail ho raha hai (possible: env vs file mismatch, ya key-auth plugin behavior).

---

## 4. Current State (Summary)

| Component | Status |
|-----------|--------|
| Local `.env` | `VITE_SUPABASE_ANON_KEY` = 174 char JWT (VPS wala) |
| VPS `.env` (Supabase) | `ANON_KEY` = same JWT |
| Kong `kong.yml` | anon keyauth_credentials mein same JWT |
| Kong env | `SUPABASE_ANON_KEY` length 177 (174 + newline) |
| auth.users | Passwords reset (admin, ndm313, demo) |
| Health endpoint | 401 with correct apikey |
| Token endpoint | 401 with correct apikey (VPS curl se bhi) |

**Open point:** Kong config file mein key sahi dikh raha hai, lekin request pe key-auth 401 de raha hai – isko resolve karna baaki hai (Kong logs, key-auth config, env vs file precedence).

---

## 5. Important Paths & Scripts

| Purpose | Path / Command |
|--------|-----------------|
| Local env | `.env` (root) – `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| VPS Supabase env | `/root/supabase/docker/.env` – `ANON_KEY`, `JWT_SECRET` |
| VPS ERP env | `/root/NEWPOSV3/.env.production` – `VITE_SUPABASE_ANON_KEY` |
| Kong config (in container) | `/home/kong/kong.yml` |
| JWT key generator | `deploy/gen-jwt-keys.cjs` (JWT_SECRET se anon/service key) |
| JWT fix (regen + printf) | `deploy/fix-supabase-storage-jwt.sh` |
| Safe anon key write | `deploy/fix-anon-key-no-expand.sh`, `deploy/vps-write-anon-key.py` |
| Password reset SQL | `scripts/vps-reset-passwords-now.sql` |
| Login fix doc | `docs/LOGIN_401_FIX_LOCALHOST.md` |

---

## 6. Commands (Copy-Paste)

### 6.1 VPS se anon key nikalna

```powershell
ssh dincouture-vps "grep '^ANON_KEY=' /root/supabase/docker/.env | cut -d= -f2- | tr -d '\n\r'"
```

### 6.2 Local .env update

- Jo value upar aaye, use `.env` mein daalen:  
  `VITE_SUPABASE_ANON_KEY=<paste>`
- Dev server restart: `npm run dev`

### 6.3 Auth health check (VPS)

```bash
KEY=$(grep '^ANON_KEY=' /root/supabase/docker/.env | cut -d= -f2- | tr -d '\n\r')
curl -s -o /dev/null -w '%{http_code}' -H "apikey: $KEY" https://supabase.dincouture.pk/auth/v1/health
```

- **200** = apikey accept; **401** = Kong/upstream reject.

### 6.4 Kong config dekhna (VPS)

```bash
docker exec supabase-kong cat /home/kong/kong.yml | head -20
```

### 6.5 Passwords dobara reset (VPS)

```powershell
Get-Content "scripts\vps-reset-passwords-now.sql" -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres"
```

---

## 7. Passwords (Quick reference)

| Email | Password |
|-------|----------|
| admin@dincouture.pk | AdminDincouture2026 |
| ndm313@yahoo.com / ndm313@live.com | 123456 |
| demo@dincollection.com | demo123 |

---

## 8. Next Steps (Analysis ke liye)

1. **Kong logs:**  
   `ssh dincouture-vps "docker logs supabase-kong --tail 100"`  
   – 401 aate waqt koi key-auth / credential message ho to note karein.

2. **GoTrue logs:**  
   `ssh dincouture-vps "docker logs supabase-auth --tail 100"`  
   – Invalid token / password errors dikhen to unko link karein.

3. **Kong key-auth plugin:**  
   - Kong version aur key-auth plugin config (key name, credentials) verify karein.  
   - Ho sakta hai key comparison trim/case/encoding se fail ho.

4. **Production vs localhost:**  
   - https://erp.dincouture.pk pe login try karein.  
   - Agar wahan 200 aaye aur localhost pe 401 rahe to CORS/redirect/origin check karein.

5. **JWT secret alignment:**  
   - Anon key ko VPS ke `JWT_SECRET` se hi generate karke Kong + .env dono pe same key use karein (`deploy/fix-supabase-storage-jwt.sh` ya `vps-write-anon-key.py`).

---

## 9. Related Docs

- `docs/LOGIN_401_FIX_LOCALHOST.md` – Localhost ke liye anon key steps  
- `docs/LOGIN_401_UNAUTHORIZED.md` – General 401 causes  
- `deploy/FIX_LOGIN_AND_SUPABASE_DOMAIN.md` – Kong/domain fix context

---

*Ye file sirf analysis aur debugging ke liye hai; fix apply karne se pehle backup / staging pe test karein.*
