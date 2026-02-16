# 🚀 Production Deployment Runbook

Follow this order: **Web/PWA → Mobile test → Android APK**. PWA **sirf HTTPS** par kaam karega.

---

## STEP 1 – Production Deployment (Web / PWA)

### 1️⃣ Build

```bash
npm run build
```

Output: `dist/` folder.

### 2️⃣ Deploy on HTTPS

Pick one:

| Option | Notes |
|--------|--------|
| **Vercel** | Fastest: connect repo → build command `npm run build`, output `dist`. |
| **Netlify** | Same: build `npm run build`, publish `dist`. |
| **VPS** | Nginx + SSL (Let’s Encrypt). Serve `dist` as static. See **VPS Docker (Supabase)** below. |
| **Firebase Hosting** | `firebase init hosting` → build, deploy. |

⚠️ **PWA only works over HTTPS.** No exceptions.

#### VPS Docker (Traefik + Supabase)

ERP frontend uses **Supabase**; `VITE_SUPABASE_*` are **build-time** only (Vite). Image must be built with correct env.

1. **Keys:**
   - **Cloud:** Supabase Dashboard → Project Settings → API → **Project URL** + **anon public key**.
   - **Self-hosted (VPS):** API URL = Kong gateway (e.g. `https://72.62.254.176:8443`); anon key from `/root/supabase/docker/.env` → `ANON_KEY`.

2. **Build with env (on VPS or CI):**
   ```bash
   docker build \
     --build-arg VITE_SUPABASE_URL=https://YOUR_KONG_OR_PROJECT_URL \
     --build-arg VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY \
     -t erp-frontend:latest .
   ```

3. **Run:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --force-recreate
   ```

4. **Verify:** `curl -I https://erp.dincouture.pk` (or your ERP host) → HTTP/2 200. Then **browser test:** Sign In + Dashboard/data pages. See **docs/ERP_VPS_TEST_AND_TROUBLESHOOT.md** for steps and CORS/redirect fixes.

---

## STEP 2 – Real Mobile Test (Don’t skip)

On a **real phone**, open the **deployed HTTPS URL** in the browser. Check:

| Check | Expected |
|-------|----------|
| **Add to Home Screen** | Browser shows “Add to Home Screen” or install prompt. |
| **Offline** | Turn off WiFi/data, open app from home screen → cached shell loads. |
| **Version** | Settings → About System → Version + Build Date visible. |
| **Icons** | App icon on home screen (add `public/icons/icon-192.png`, `icon-512.png` if missing). |

Fix any failure before moving to APK.

---

## STEP 3 – Android APK Build (Capacitor)

Capacitor is installed only when you need native builds. One-time setup:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Modern ERP POS" "com.ndm.erppos" --web-dir dist
npx cap add android
```

Every time you want a new build:

```bash
npm run build
npx cap copy
npx cap open android
```

In **Android Studio**:

- **Build → Build Bundle(s) / APK(s) → Build APK(s)** (debug/signed APK)
- For Play Store: **Build App Bundle(s) / AAB**

---

## 🍎 iOS (Later)

Requires **Mac + Xcode**. Same idea:

```bash
npx cap add ios
npm run build
npx cap copy
npx cap open ios
```

Then in Xcode: select team, device/simulator, Archive or Run.

---

## 🧠 Three Professional Rules

### 1️⃣ Version bump discipline

Before every release:

- Update **`version`** in `package.json`.
- Build date updates automatically on `npm run build`.
- Settings → About System shows both.

### 2️⃣ Migration discipline

- Har DB change → **new migration file** in `supabase-extract/migrations/`.
- Kabhi production DB ko **direct edit** mat karo.
- Migrations = source of truth.

### 3️⃣ No feature without branch

- **main** = stable / release.
- New work → **feature branch** → PR → merge after review.
- Release tags from main (e.g. `v1.0.0`).

---

## 🔥 Optional Advanced Upgrades

When you’re ready, you can add:

| Upgrade | Purpose |
|---------|--------|
| **Auto-update notification** | “New version available” when app version &lt; server version. |
| **Push notifications** | Capacitor Push Notifications plugin. |
| **Background sync** | Service worker background sync for offline actions. |
| **App update checker** | Periodic check + prompt to refresh or reinstall. |
| **Crash logging** | e.g. Sentry (web + Capacitor). |

---

## 🏁 Final Professional Verdict

A solid architect review would see:

| Area | Status |
|------|--------|
| Modular structure | ✅ |
| Config-driven (env, company settings) | ✅ |
| Permission hardened (RLS + UI) | ✅ |
| Multi-company ready | ✅ |
| PWA ready | ✅ |
| Mobile wrapper ready (Capacitor) | ✅ |
| Version disciplined | ✅ (About System + package.json) |
| Migration safe | ✅ (migrations in repo) |

**Summary:** Properly architected ERP SaaS – version control, controlled releases, migration tracking, and mobile packaging in place.
