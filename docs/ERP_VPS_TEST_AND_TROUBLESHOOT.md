# ERP VPS — Test & Troubleshoot (Supabase self-hosted)

**Summary:** Supabase VPS par chal raha hai; ERP frontend ko Kong URL + anon key ke sath rebuild kiya gaya. Ab browser se login aur data verify karo.

---

## 0) DNS — erp.dincouture.pk resolve nahi ho raha (NXDOMAIN)

Agar browser me **"This site can't be reached"** / **DNS_PROBE_FINISHED_NXDOMAIN** aaye, domain resolve nahi ho raha.

### Use app abhi (2 min) — hosts file workaround

**Windows:** Notepad **Run as administrator** → Open `C:\Windows\System32\drivers\etc\hosts` (file type: All Files) → last line pe add karo:
```
72.62.254.176 erp.dincouture.pk
```
Save → PowerShell (Admin) me `ipconfig /flushdns` → browser me **https://erp.dincouture.pk** kholo. Certificate warning aaye to Advanced → Proceed.

**Full steps:** [docs/FIX_ERP_DOMAIN_NOW.md](FIX_ERP_DOMAIN_NOW.md)

### DNS permanently fix (Hostinger)

**1) Hostinger** → Domains → dincouture.pk → DNS / Manage DNS. Ensure nameservers Hostinger ke hain.

**2) A record add/edit:**

| Type | Name/Host | Value/Target        | TTL  |
|------|-----------|---------------------|------|
| **A** | `erp`     | `72.62.254.176`     | 300  |

Save. Propagation 5–30 min (kabhi 1–2 hr).

**3) VPS par verify:** `cd /root/NEWPOSV3 && bash scripts/vps-dns-verify.sh`  
**4) PC:** `ipconfig /flushdns`, phir https://erp.dincouture.pk

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

**Agar `scripts/deploy-erp-vps.sh` missing ho (e.g. branch sync nahi hua):** ye ek line chalao — branch sync karke deploy chalega:

```bash
cd /root/NEWPOSV3 && git fetch origin && git checkout before-mobile-replace 2>/dev/null; git reset --hard origin/before-mobile-replace && bash scripts/deploy-erp-vps.sh
```

Ya GitHub se one-liner run karo:
```bash
bash <(curl -sL https://raw.githubusercontent.com/NDM0313/NEWPOSV3/before-mobile-replace/docs/VPS_DEPLOY_ONE_LINE.txt)
```
(Note: cd /root/NEWPOSV3 wala line repo path use karta hai; agar repo kahin aur hai to pehle wala block use karo.)

**Jab script maujood ho:** repo root se `bash scripts/deploy-erp-vps.sh`. Anon key `/root/supabase/docker/.env` se auto load hoti hai.

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

## 4) erp.dincouture.pk load nahi ho raha — common causes

| Cause | Fix |
|-------|-----|
| **Traefik wrong network** | ERP aur Traefik dono `dokploy-network` par hon. `docker network inspect dokploy-network` se check karo. Compose me `traefik.docker.network=dokploy-network` label hai. |
| **Network missing** | Deploy script ab khud `dokploy-network` create karta hai agar nahi hai. Ya: `docker network create dokploy-network` |
| **Traefik container not on network** | Dokploy’s Traefik (e.g. `dokploy-traefik`) ko attach karo: `docker network connect dokploy-network <traefik_container>` |
| **Login redirect fail** | Supabase: `/root/supabase/docker/.env` me `SITE_URL=https://erp.dincouture.pk`. Phir `docker restart $(docker ps -q -f name=supabase-auth)` |

Deploy ke baad **diagnose** automatically chalta hai (`scripts/vps-erp-diagnose.sh`). Dobara manually: `bash scripts/vps-erp-diagnose.sh`

---

## 5) Agar ab bhi issue aaye

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

## 6) Quick checklist

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open ERP URL in browser | Page loads |
| 2 | Sign In | Login succeeds |
| 3 | Open Dashboard / data pages | Lists and data load |
| 4 | F12 → Console | No CORS / failed fetch |
| 5 | If CORS | Add redirect URLs, restart auth |
| 6 | If mixed content | Use same scheme (https recommended) |
