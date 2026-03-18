# Master Runbook – Auth, 502, 401, Kong & supabase.dincouture.pk

**Use case:** Office mein sab theek tha; ghar par use karte waqt error / supabase.dincouture.pk “kam nahi kar raha”. Ye runbook saari fix docs ko ek jagah ready karta hai aur step-by-step batata hai kya karna hai.

---

## 1. Pehle ye samajh lo

| Cheez | Baat |
|-------|------|
| **supabase.dincouture.pk root** | Browser mein open karne par sirf ek **JSON line** dikhegi: `{"service":"Supabase API","message":"Use /auth/v1/health..."}`. Ye **error nahi** hai – API live hai. |
| **Console errors** | `Host validation failed`, `Host is not supported`, `Host is not in insights whitelist` – ye **browser extensions** (Reader/Insights) ke hain. Inhe ignore karein; app/Supabase fix nahi chahiye. |
| **Data use kahan karein** | Asli data **ERP** se use hota hai: **https://erp.dincouture.pk** → Login → yahi Supabase backend use hota hai. |
| **Office vs Home** | Backend ek hi hai (VPS). Office mein chal raha hai to backend theek hai. Ghar par agar nahi chale to **network/DNS** check karein (niche dekho). |

---

## 2. Quick check – backend live hai ya nahi?

Apne machine se (jahan error aa raha hai):

```bash
# Replace YOUR_ANON_KEY with actual key (VPS .env se ya .env.production se)
curl -sI -H "apikey: YOUR_ANON_KEY" https://supabase.dincouture.pk/auth/v1/health
```

- **200** → Backend live hai; agar ERP phir bhi fail kare to ERP URL / cache / same network check karein.
- **502** → Kong down/restart loop; Section 3 chalao.
- **401** → Key wrong ya Kong key-auth/ACL; Section 4 chalao.
- **Connection refused / timeout** → DNS ya firewall (ghar/office network); Section 6.

---

## 3. 502 Bad Gateway / AuthRetryableFetchError (Kong down)

**Lakshan:** ERP login pe 502, ya `supabase.dincouture.pk` pe auth/rest 502.

**Step 1 – VPS par diagnostic (optional):**

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/diagnose-auth-full.sh"
```

**Step 2 – Kong repair (standard fix):**

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/kong-safe-repair.sh"
```

Ye script: backup → kong.yml se malformed CORS blocks hataata hai → Kong restart → verify.  
Agar scripts VPS par nahi hon to pehle:

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull"
```

phir dubara `kong-safe-repair.sh` chalao.

**Detail / doosri 502 wajah:**  
- **`docs/KONG_502_PERMANENT_FIX_RUNBOOK.md`** – CORS YAML, kong-doctor, rollback.  
- **`docs/LOGIN_502_RESULT.md`** – analytics/auth routes malformed (plugin 'X' not enabled, 404 no Route matched); fix scripts: `fix-kong-analytics-plugin-error.py`, `fix-kong-auth-routes.py`.

---

## 4. 401 Unauthorized (login / health dono 401)

**Lakshan:** Health check ya token dono 401 de rahe hain (anon key bhejne ke baad bhi).

**Kaam:** Kong auth/rest routes par **key-auth** hona chahiye; anon key Supabase `.env` aur ERP `.env.production` mein same hona chahiye.

**Steps:**

1. VPS: `bash deploy/diagnose-auth-full.sh` – keys match?
2. Kong mein key-auth: `deploy/add-kong-key-auth-to-auth-rest.py` (ya manually kong.yml mein auth-v1 / rest-v1 ke `plugins:` mein key-auth add karein).
3. Kong recreate: `cd /root/supabase/docker && docker compose up -d kong --force-recreate`

**Detail:**  
- **`docs/LOGIN_401_RESULT.md`** – kya change kiya, verify commands.  
- **`docs/LOGIN_401_ANALYSIS.md`**, **`docs/LOGIN_401_FIX_LOCALHOST.md`**, **`docs/LOGIN_401_UNAUTHORIZED.md`** – analysis aur localhost fix.

---

## 5. Login to ho jaye lekin “You’re signed in but don’t have a business yet”

**Lakshan:** Login success, lekin ERP “no business” dikhata hai (jabke user/company DB mein hai).

**Kaam:** Profile fetch fail (transient) ko “no business” na banao – iske liye fix already code mein hai: retry + `profileLoadComplete`.  
**Zaroori:** Wahi build **deployed** ho (VPS par latest ERP build). Agar deploy purana hai to purana behavior rahega.

**Verify:**  
- **`docs/ERP_POST_LOGIN_BUSINESS_PROFILE_FIX_REPORT.md`** – root cause, files changed, verification.

---

## 6. Office se chal raha hai, ghar se nahi (connection / DNS)

**Lakshan:** Office mein erp.dincouture.pk / supabase.dincouture.pk chal raha hai; ghar par same browser/ERP se 502 ya “connection failed”.

**Check:**

1. **DNS:** Ghar ke network se: `nslookup supabase.dincouture.pk` → IP **72.62.254.176** (VPS) aani chahiye.
2. **HTTPS:** Browser mein `https://supabase.dincouture.pk/` open karein – agar JSON message dikhe to reach ho raha hai; agar “connection refused” / timeout to firewall/ISP/port 443.
3. **ERP:** Ghar se directly **https://erp.dincouture.pk** open karke login try karein; agar sirf supabase.dincouture.pk open kiya hai to wahan sirf JSON hi dikhega (ye normal hai).

---

## 7. studio.dincouture.pk 502 (Studio not loading)

**Lakshan:** https://studio.dincouture.pk returns **502 Bad Gateway** (Kong/API OK).

**Cause:** Traefik cannot reach `supabase-studio:3000` (Studio on `supabase_default`, Traefik on `dokploy-network` only).

**Fix:**  
`ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/ensure-studio-traefik-network.sh"`

**Detail:** **`docs/STUDIO_502_AND_ERP_AUTOLOGOUT_RUNBOOK.md`**.

---

## 8. ERP login ke baad turant logout (auto-logout)

**Lakshan:** User login karta hai, ~1 second baad wapas login screen par aa jata hai.

**Cause:** Spurious session=null from Supabase client; app was clearing state.

**Fix:** Code fix in SupabaseContext (verify with getSession before clear). **Deploy new ERP build** on VPS (pull, rebuild erp-frontend, restart).

**Detail:** **`docs/STUDIO_502_AND_ERP_AUTOLOGOUT_RUNBOOK.md`**.

---

## 9. Saari related docs (index)

| Doc | Kab use karein |
|-----|-----------------|
| **STUDIO_502_AND_ERP_AUTOLOGOUT_RUNBOOK.md** | Studio 502, ERP auto-logout, host mapping |
| **KONG_502_PERMANENT_FIX_RUNBOOK.md** | 502, Kong restart loop, CORS YAML fix, kong-safe-repair, kong-doctor |
| **LOGIN_502_RESULT.md** | 502 phase-2: analytics/auth routes malformed, fix scripts, office apply steps |
| **LOGIN_401_RESULT.md** | 401 fix: key-auth, anon key sync, verify |
| **LOGIN_401_ANALYSIS.md** | 401 analysis |
| **LOGIN_401_FIX_LOCALHOST.md** | Localhost 401 fix |
| **LOGIN_401_UNAUTHORIZED.md** | 401 symptoms / reference |
| **LEDGER_BACKEND_DATABASE_FIX.md** | User Ledger RLS (ledger_master insert/update) – accounting feature |
| **ERP_POST_LOGIN_BUSINESS_PROFILE_FIX_REPORT.md** | “No business yet” false state, profile retry |
| **SUPABASE_LIVE_STATUS.md** | supabase.dincouture.pk live hai, data kaise use karein (ERP / Studio) |

---

## 10. Ek line summary

- **supabase.dincouture.pk pe sirf JSON dikhe** → Normal; data use karne ke liye **erp.dincouture.pk** use karein.  
- **Console “Host validation” / “not supported”** → Browser extension; ignore.  
- **502 (Kong/auth)** → `kong-safe-repair.sh` + **KONG_502_PERMANENT_FIX_RUNBOOK.md**. **502 (Studio only)** → `ensure-studio-traefik-network.sh`; **STUDIO_502_AND_ERP_AUTOLOGOUT_RUNBOOK.md**.  
- **401** → Key sync + Kong key-auth; **LOGIN_401_RESULT.md**.  
- **Office OK, ghar fail** → DNS / network; Section 6.
