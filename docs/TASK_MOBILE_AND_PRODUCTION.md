# Task: ERP Production + Mobile (Step-by-Step)

**Goal:** ERP system complete hai; ab (1) data migration complete karna, (2) subdomain mobile par kaam kare, (3) SSL "Not secure" fix, (4) Android/iOS design + PWA → native integrate aur mobile par test karna.

---

## Current state (summary)

| Item | Status |
|------|--------|
| ERP on erp.dincouture.pk | ✅ Deployed (VPS, Traefik, Docker) |
| Login / API (same-origin) | ✅ Build uses erp.dincouture.pk; nginx proxy to Kong |
| PWA (Add to Home Screen, offline) | ✅ manifest + sw.js; **sirf HTTPS par** |
| Data migration | ⚠️ Incomplete – products/data empty ya partial |
| Subdomain on mobile | ❌ Mobile par erp.dincouture.pk kaam nahi karta |
| SSL "Not secure" | ❌ Certificate issue (self-signed / Traefik not issuing) |
| Android / iOS app | ❌ Capacitor not installed; design + build pending |

---

## Phase 1 – Data & API (pehle ye fix)

### 1.1 Products page crash fix (done in code)

- **Issue:** API fail ya data undefined hone par `Cannot read properties of undefined (reading 'map')`.
- **Fix:** `ProductsPage.tsx` mein `(data || []).map` aur `(overviewRows || []).forEach` use ho chuka hai.
- **Action:** Deploy latest code (PC se: `.\scripts\deploy-via-ssh.ps1` ya VPS par: `bash scripts/deploy-erp-vps.sh`).

### 1.2 Data migration complete karna

- **Issue:** Data complete migrate nahi hua – products/contacts/sales etc. empty ya purana.
- **Steps:**
  1. **Source of truth decide karo:** Kaunsa DB/export final hai (Supabase Cloud export, ya koi SQL dump).
  2. **VPS Supabase DB target:** Self-hosted Supabase on VPS (PostgreSQL + Kong). Tables: `products`, `product_categories`, `contacts`, `sales`, `purchases`, `stock_movements`, etc.
  3. **Migration script/tool:**  
     - Option A: Supabase Cloud se **Backup** → VPS Supabase restore (pg_restore / SQL).  
     - Option B: Agar seed/migration scripts hain (`scripts/run-migrations.js`, `scripts/run-seed.js`, `scripts/run-phases.js`) to unko VPS par **ek baar** run karo (Supabase connection VPS wala hona chahiye – seed script ko VPS Supabase URL + key chahiye).
  4. **Verify:** Browser mein https://erp.dincouture.pk → Login → Products, Contacts, Sales pages – data dikhna chahiye.

- **Reference:** Repo mein `scripts/run-migrations.js`, `scripts/run-seed.js`, `PHASE_*.md` – dekhna kaunse scripts VPS DB ke liye safe hain (destructive na hon).

---

## Phase 2 – Subdomain mobile par + SSL ("Not secure" fix)

### 2.1 Subdomain mobile par kyon nahi chal raha

- **Possible causes:**
  1. **DNS:** Mobile network (cellular) ka DNS alag ho sakta hai – `erp.dincouture.pk` resolve nahi ho raha (NXDOMAIN).
  2. **SSL:** Certificate invalid / self-signed – mobile browser block karta hai ya "Not secure" dikhata hai; kabhi-kabhi page load hi nahi hota.
  3. **Firewall / ISP:** Port 443 block ya throttle.

- **Steps (order se):**

#### Step 2.1.1 – DNS verify (mobile par)

- Mobile **WiFi** pe rakho (same network jahan PC pe erp.dincouture.pk chal raha hai).
- Mobile browser mein open karo: `https://erp.dincouture.pk`.
- Agar "This site can't be reached" / "DNS probe finished" aaye → DNS mobile par resolve nahi ho raha.  
  - **Fix:** Hostinger pe **A record** confirm karo: `erp` → `72.62.254.176`. Propagation 30 min–2 hr.  
  - **Temporary:** Mobile WiFi ko same DNS use karne do (e.g. 8.8.8.8) – Router DHCP me DNS set karo, ya mobile pe Private DNS / DNS override (e.g. 8.8.8.8) use karo.

#### Step 2.1.2 – SSL "Not secure" fix (Traefik + Let's Encrypt)

- **Reason:** Valid certificate nahi hai – Traefik self-signed use kar raha hai ya ACME (Let's Encrypt) configure nahi.
- **Steps:**
  1. **Traefik (Dokploy) mein ACME enable karo** – domain `erp.dincouture.pk` ke liye certificate auto-issue ho.  
     - Dokploy/Traefik docs dekhna: **TLS / Let's Encrypt** (HTTP-01 challenge ke liye port 80 open hona chahiye).
  2. **VPS pe ports:** 80 (HTTP), 443 (HTTPS) open hon.
  3. **Certificate verify:** Browser (PC/mobile) mein https://erp.dincouture.pk → padlock green / "Secure" – phir PWA bhi trusted hoga.

- **Docs:** `docs/DOKPLOY_ERP_TRAEFIK_SETUP.md`, `docs/ERP_VPS_TEST_AND_TROUBLESHOOT.md` – agar Traefik TLS example hai to use karo.

#### Step 2.1.3 – Mobile data (cellular) par test

- DNS + SSL fix ke baad mobile **cellular data** se bhi open karo: `https://erp.dincouture.pk`.  
- Agar phir bi fail ho to:  
  - Public DNS (8.8.8.8) mobile pe set karo, ya  
  - Hostinger DNS propagation wait karo.

---

## Phase 3 – PWA on mobile (already working, ensure)

- PWA **sirf HTTPS** par install hota hai. SSL fix (Phase 2) ke baad:
  1. Mobile browser (Chrome/Safari) mein `https://erp.dincouture.pk` kholo.
  2. **Add to Home Screen** / **Install app** use karo.
  3. Home screen icon se app kholo – fullscreen, standalone.
  4. **Offline:** WiFi/data band karke open karo – cached shell load hona chahiye (sw.js).

- **Checklist:** `public/manifest.json`, `public/sw.js`, `public/icons/icon-192.png`, `icon-512.png` – ye sab deploy ke sath serve ho rahe hon (already set in repo).

---

## Phase 4 – Android & iOS design + native build (Capacitor)

- **Goal:** PWA ke baad Android/iOS ke liye **design** aur **native wrapper** (Capacitor) se APK/IPA build karna, taake app store / device par test ho.

### 4.1 Capacitor install (one-time)

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Modern ERP POS" "com.ndm.erppos" --web-dir dist
npx cap add android
npx cap add ios
```

- **Note:** iOS ke liye **Mac + Xcode** zaroori hai. Sirf Android bhi kar sakte ho pehle.

### 4.2 Build and sync

```bash
npm run build
npx cap copy
npx cap open android
# or
npx cap open ios
```

- **Android:** Android Studio → Build → Build APK(s) / AAB.  
- **iOS:** Xcode → Team select → Run/Archive.

### 4.3 Mobile-specific design check

- **Viewport / touch:** `index.html` mein already `viewport-fit=cover`, `width=device-width` hai – theek.
- **Safe area:** Agar notch / status bar ke niche content kaat raha ho to CSS `env(safe-area-inset-*)` use karo.
- **Touch targets:** Buttons/links kam se kam 44px height (Apple HIG) – check karo Products, Sales, POS screens.
- **Offline / slow network:** PWA cache + error messages ("No connection", "Retry") – already partial; agar koi page fail ho to user ko clear message.

### 4.4 App config (Capacitor)

- **android/app/src/main/res/** – app icon, splash (replace default).
- **capacitor.config.ts** (after init) – `server.url` mat set karo production ke liye (bundle same origin use karega); agar dev me live reload chahiye to alag.

- **Reference:** `DEPLOYMENT_RUNBOOK.md` (Step 3 Android APK), `PHASE4_DEPLOYMENT.md` (Capacitor setup).

---

## Phase 5 – Testing checklist (mobile)

| # | Task | Expected |
|---|------|----------|
| 1 | DNS (mobile WiFi + cellular) | erp.dincouture.pk resolve ho |
| 2 | SSL | "Secure" / green padlock, no "Not secure" |
| 3 | Login | Email/password se sign in ho |
| 4 | Products page | List load (empty ya data); no "Failed to load products" crash |
| 5 | Add to Home Screen | PWA install prompt / manual add |
| 6 | Offline (PWA) | Shell load from cache |
| 7 | Android APK (Capacitor) | APK install → open → login → same UI |
| 8 | iOS (if Mac available) | Same as Android |

---

## Quick reference – commands

| Action | Where | Command |
|--------|--------|---------|
| Deploy ERP (latest code) | PC | `.\scripts\deploy-via-ssh.ps1` |
| Deploy ERP | VPS (already SSH) | `cd /root/NEWPOSV3 && bash scripts/deploy-erp-vps.sh` |
| Supabase auth fix | VPS | `cd /root/NEWPOSV3 && bash scripts/vps-supabase-fix-fetch.sh` |
| DNS verify | VPS | `bash scripts/vps-dns-verify.sh` |
| Capacitor sync | Local | `npm run build && npx cap copy` |
| Open Android | Local | `npx cap open android` |

---

## File references

- **VPS/SSH:** `docs/VPS_SSH.md`, `docs/ssh-config-dincouture-vps.example`
- **Deploy:** `scripts/deploy-erp-vps.sh`, `scripts/deploy-via-ssh.ps1`
- **SSL/DNS:** `docs/ERP_VPS_TEST_AND_TROUBLESHOOT.md`, `docs/FIX_ERP_DOMAIN_NOW.md`
- **PWA/Capacitor:** `DEPLOYMENT_RUNBOOK.md`, `PHASE4_DEPLOYMENT.md`
- **Failed to fetch / cache:** `docs/FIX_FAILED_TO_FETCH.md`

---

**Order recommend:**  
1 → Phase 1 (data + products crash fix deploy)  
2 → Phase 2 (SSL + DNS so mobile par subdomain work)  
3 → Phase 3 (PWA on mobile verify)  
4 → Phase 4 (Capacitor + Android/iOS design + build)  
5 → Phase 5 (full testing checklist)
