# ERP VPS — Test & Troubleshoot (Supabase self-hosted)

**Summary:** Supabase VPS par chal raha hai; ERP frontend ko Kong URL + anon key ke sath rebuild kiya gaya. Ab browser se login aur data verify karo.

---

## 0) DNS — erp.dincouture.pk resolve nahi ho raha (NXDOMAIN)

Agar browser me **"Can't reach this page"** / **DNS_PROBE_FINISHED_NXDOMAIN** aaye, to domain ka DNS set nahi hai.

**Kya karna hai:** Apne domain (dincouture.pk) ke DNS provider (e.g. Cloudflare, Namecheap, GoDaddy) me:

| Type | Name/Host | Value/Target        | TTL  |
|------|-----------|---------------------|------|
| **A** | `erp`     | `72.62.254.176`     | 300  |

- **Name:** `erp` (subdomain; full domain `erp.dincouture.pk` ban jayega).
- **Value:** VPS ka IP `72.62.254.176`.
- Save karo; propagation 5–30 min (kabhi 1–2 ghante) le sakta hai.

**Verify:** `ping erp.dincouture.pk` ya browser me `https://erp.dincouture.pk` — DNS resolve hone ke baad Traefik + ERP frontend serve karenge (agar VPS par `docker-compose.prod.yml` me `Host(erp.dincouture.pk)` set hai).

---

## 1) VPS status (jo fix hua)

| Item | Detail |
|------|--------|
| **Supabase stack** | supabase-db, supabase-auth, supabase-kong, supabase-rest, supabase-studio, etc. (self-hosted) |
| **Data** | supabase.com se import kiya hua |
| **Problem (pehle)** | ERP frontend bina Supabase URL/key ke build tha → "Failed to fetch" / data nahi aa raha tha |
| **Fix** | Kong = API URL, anon key from `/root/supabase/docker/.env`; ERP image build-args ke sath rebuild; container `--force-recreate` |

---

## 2) Build / run (reference)

**Supabase API:** Kong gateway = `https://72.62.254.176:8443`  
**Anon key:** `/root/supabase/docker/.env` → `ANON_KEY`

**ERP image build (VPS par):**
```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://72.62.254.176:8443 \
  --build-arg VITE_SUPABASE_ANON_KEY=<VPS_wala_anon_key> \
  -t erp-frontend:latest .
```

**Run:**
```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### Auto-apply (ek command)

VPS par repo root se ye script chalao — ye **git pull**, **build** (Supabase env ke sath), aur **container recreate** khud karega. Anon key `/root/supabase/docker/.env` se auto load hoti hai.

```bash
cd /root/NEWPOSV3   # ya jahan repo clone hai
bash scripts/deploy-erp-vps.sh
```

Pehli dafa: `chmod +x scripts/deploy-erp-vps.sh` (optional). Agar anon key alag path pe hai to `SUPABASE_ENV=/path/to/.env bash scripts/deploy-erp-vps.sh`.

---

## 3) Ab aap test karo (browser)

1. **ERP kholo**  
   - `https://72.62.254.176` (ya jis URL se ERP serve ho raha hai, e.g. `https://erp.dincouture.pk` / `https://pos.dincouture.pk`).

2. **Sign In**  
   - Login chalna chahiye (Supabase Auth via Kong).

3. **Dashboard / data pages**  
   - Lists / data load ho rahe hon; koi "Failed to fetch" ya blank list nahi.

4. **Console**  
   - F12 → Console: CORS ya network errors nahi hone chahiye.

---

## 4) Agar ab bhi issue aaye

### CORS (browser console me CORS error)

Supabase Auth ko app origin allow karna hoga.

- **File:** `/root/supabase/docker/.env`
- **SITE_URL** ab `https://erp.dincouture.pk` hai.
- Agar app **IP** se open kar rahe ho (`72.62.254.176`), to **Additional Redirect URLs** me add karo:
  - `http://72.62.254.176`
  - `https://72.62.254.176`
- Ye Supabase Auth / GoTrue config me hota hai (env vars ya Kong/Auth config).
- **Phir auth container restart:**  
  `docker restart <supabase-auth-container-name>` (ya jo stack use kar rahe ho).

### Mixed content

- App **http** se open hai aur API **https://72.62.254.176:8443** pe hai → browser block kar sakta hai.
- **Fix:** Same scheme use karo — dono http ya dono https (recommended: dono https).

### Exact error chahiye

Agar ab bhi issue aaye to bhejo:
- Browser console ka **exact error message** (copy-paste), ya
- **Screenshot** of console / network tab.

---

## 5) Quick checklist

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open ERP URL in browser | Page loads |
| 2 | Sign In | Login succeeds |
| 3 | Open Dashboard / data pages | Lists and data load |
| 4 | F12 → Console | No CORS / failed fetch |
| 5 | If CORS | Add redirect URLs, restart auth |
| 6 | If mixed content | Use same scheme (https recommended) |
