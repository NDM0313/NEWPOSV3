# Phase 4: Release Freeze + PWA + Capacitor

**Role:** Senior Full-Stack + DevOps Architect  
**Status:** Implemented

---

## PART 1 – RELEASE FREEZE ✅

| Item | Status | Location |
|------|--------|----------|
| No console in production | ✅ | `vite.config.ts` → `build.esbuild.drop: ['console', 'debugger']` in production mode |
| No dev-only configs | ✅ | Version/build injected at build time; logger uses `VITE_ENABLE_LOGGING` / `DEV` |
| APP_VERSION constant | ✅ | `src/app/config/version.ts` + Vite `define.__APP_VERSION__` (from package.json version) |
| Build timestamp | ✅ | `define.__BUILD_TIMESTAMP__` (ISO string at build time) |
| Settings → About System | ✅ | SettingsPageNew → tab "About System" shows Version + Build Date |

**Usage:** Bump `version` in `package.json` for each release. Build date updates automatically on `npm run build`.

---

## PART 2 – PWA ENABLEMENT ✅

| Item | Status | Location |
|------|--------|----------|
| manifest.json | ✅ | `public/manifest.json` – name, short_name, start_url, display standalone, theme_color, icons |
| App icons 192 / 512 | ✅ | `public/icons/` – add `icon-192.png` and `icon-512.png` (see `public/icons/README.md`) |
| Service worker | ✅ | `public/sw.js` – install, fetch (cache-first for cached, network-first then cache fallback) |
| Offline basic caching | ✅ | SW caches `/`, `/index.html`, `/manifest.json`; caches successful GET responses |
| Installable / Add to Home Screen | ✅ | `index.html` – manifest link, theme-color, apple-touch-icon; main.tsx registers SW in production |

**Mobile:** Open app in mobile browser (HTTPS) → browser should show "Add to Home Screen" or install prompt when criteria are met.

---

## PART 3 – CAPACITOR SETUP

Capacitor is **not** installed by default so the repo stays web-first. Use the steps below when you want Android/iOS builds.

### Prerequisites

- Node 18+
- Android: Android Studio, JDK 17, ANDROID_HOME
- iOS: Xcode (Mac only), CocoaPods

### 1. Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Modern ERP POS" "com.ndm.erppos" --web-dir dist
```

> **Full step-by-step:** See **DEPLOYMENT_RUNBOOK.md** (Step 1 Web/PWA → Step 2 Mobile test → Step 3 Android APK, plus 3 rules and optional upgrades).

### 2. Add platforms

```bash
npm run build
npx cap add android
npx cap add ios
```

### 3. Sync and open

```bash
npm run build
npx cap copy
npx cap open android
# or
npx cap open ios
```

### 4. Android build (APK / AAB)

1. `npx cap open android` → Android Studio.
2. Build → Build Bundle(s) / APK(s) → Build APK(s) (or AAB for Play Store).
3. Or CLI: `cd android && ./gradlew assembleDebug` (debug APK in `android/app/build/outputs/apk/`).

### 5. iOS build

1. `npx cap open ios` → Xcode.
2. Select team and device/simulator.
3. Product → Archive for release, or Run for simulator.

### 6. Routing and env (mobile-safe)

- **Routing:** App uses client-side routing (React, no Node-only APIs). Ensure `start_url` and router base work when served from `file://` or Capacitor’s web server (default config is usually fine).
- **Env:** Use `import.meta.env.VITE_*` only; no `process.env` in frontend. Secrets: keep in env, not in repo; for Capacitor use Capacitor’s config or inject at build.
- **No Node APIs:** Frontend already uses browser + Supabase; no `fs`/`path` in client code.

### Optional: package.json scripts

```json
"scripts": {
  "build": "vite build",
  "cap:sync": "npm run build && npx cap copy",
  "cap:android": "npm run cap:sync && npx cap open android",
  "cap:ios": "npm run cap:sync && npx cap open ios"
}
```

---

## PART 4 – FINAL CHECKLIST

### 1. PWA readiness status

| Check | Status |
|-------|--------|
| manifest.json valid | ✅ |
| Service worker registered (production) | ✅ |
| HTTPS (required for install) | ⚠️ Use in production with HTTPS |
| Icons 192/512 | ⚠️ Add files in `public/icons/` or install uses default |
| "Add to Home Screen" on mobile | ✅ When served over HTTPS and criteria met |

**Verdict:** PWA ready. Add real icons and deploy on HTTPS for full install experience.

### 2. Android readiness status

| Check | Status |
|-------|--------|
| Capacitor not yet added | ⚠️ Run steps in Part 3 when needed |
| Build succeeds (`npm run build`) | ✅ |
| No Node-only APIs in frontend | ✅ |
| Env vars (VITE_*) only | ✅ |

**Verdict:** Ready for Capacitor. Run `cap init`, `cap add android`, then build.

### 3. iOS readiness status

| Check | Status |
|-------|--------|
| Capacitor not yet added | ⚠️ Run steps in Part 3 when needed |
| Build succeeds | ✅ |
| Mac + Xcode required | Required for iOS build |

**Verdict:** Ready for Capacitor. Run `cap init`, `cap add ios`, then open in Xcode.

### 4. Final production verdict

| Area | Verdict |
|------|--------|
| Release freeze | ✅ Version + build date in Settings → About; console stripped in prod build |
| PWA | ✅ Installable; add icons and use HTTPS |
| Android | ✅ Add Capacitor and build when needed |
| iOS | ✅ Add Capacitor and build when needed (Mac) |

**Deployment strategy (recommended):**

1. **Step 1 – PWA first:** Deploy to HTTPS → test in mobile browser → "Add to Home Screen" → verify offline basics.
2. **Step 2 – Capacitor:** Install Capacitor, add android/ios, `cap copy` after each `npm run build`.
3. **Step 3 – Build APK:** From Android Studio or Gradle; for store use AAB.

**Discipline from here:** Version control (tag releases), controlled releases (changelog + version bump), migration tracking (DB migrations in repo), mobile packaging (Capacitor sync after every build).

---

## Files touched (Phase 4)

| File | Change |
|------|--------|
| `vite.config.ts` | define `__APP_VERSION__`, `__BUILD_TIMESTAMP__`; production `esbuild.drop` |
| `src/app/config/version.ts` | New – APP_VERSION, BUILD_TIMESTAMP, getBuildDateDisplay() |
| `src/app/components/settings/SettingsPageNew.tsx` | About System tab + Version + Build Date |
| `index.html` | theme-color, manifest link, apple-touch-icon, viewport-fit |
| `src/main.tsx` | Register service worker in production |
| `public/manifest.json` | PWA fields, local icon paths |
| `public/sw.js` | skipWaiting, network-first with cache fallback |
| `public/icons/README.md` | Icon instructions |
| `PHASE4_DEPLOYMENT.md` | This document |
