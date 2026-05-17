# ERP Mobile App (Din Collection)

**Alag folder** – main ERP project (NEW POSV3) ke sath **mix nahi**. Ye app mobile (Android/iOS) ke liye design follow karta hai; design reference **mobile-design** (Figma export) folder se hai.

## Structure

- **erp-mobile-app/** – yahi mobile app (Vite + React + TypeScript + Tailwind).
- **mobile-design/** – Figma se export; reference only. Is folder se copy karke erp-mobile-app mein step-by-step implement karo.
- **Main project (src/)** – desktop ERP; is app se import mat karo.

## Run

```bash
cd erp-mobile-app
npm install
npm run dev
```

Browser open hoga `http://localhost:5174`

## Login / same database as web app

Mobile app aur **web app dono ko ek hi database** use karna hai (same users, same login). Iske liye:

1. **erp-mobile-app/.env** mein ye dono set karo (web app jaisa):
   - `VITE_SUPABASE_URL` – web jaisa (production: `https://supabase.dincouture.pk`, local: jis URL se web chal raha hai)
   - `VITE_SUPABASE_ANON_KEY` – **bilkul wahi** anon key jo main project ke `.env.production` ya `.env.local` mein hai (Kong anon key)

2. Agar abhi mobile par **Supabase Cloud** (wrwljqzckmnmuphwhslt.supabase.co) use ho raha tha to wahan users alag hain; web par jo user hai woh self-hosted (supabase.dincouture.pk) par hai. Same user/password se login ke liye mobile ko bhi **same URL + same anon key** do. (port 5174 taake main project 5173 par conflict na ho).

## Flow

1. **Login** → Demo Login ya email/password (mock).
2. **Branch selection** → Select branch.
3. **Home** → Dashboard + module grid. Bottom nav: Home, Sales, POS, Contacts, More (module drawer).
4. **Modules implemented:**
   - **Sales** – Home → New Sale → Select Customer → Add Products → Summary → Payment → Confirmation.
   - **POS** – Product grid, cart drawer, checkout (tax 16%). **Barcode:** Tap "Scan" to open camera, scan product barcode → product is looked up by barcode/SKU and added to cart (native Android/iOS only; uses `@capacitor-mlkit/barcode-scanning`).
   - **Contacts** – List, search, filter (all/customer/supplier/worker), stats, Add Contact, view detail.
   - **Settings** – User info, app version, Logout.
   - **Rest** (Purchase, Rental, Studio, Accounts, Expense, Products, Inventory, Reports) → Placeholder "Coming soon".

## Step-by-step modules

Har module ke liye:

1. **mobile-design/src/components/** mein dekhna (e.g. `sales/SalesModule.tsx`, `pos/POSModule.tsx`).
2. Usi flow/UI ko **erp-mobile-app/src/components/** mein nayi file banao (ya subfolder e.g. `modules/SalesModule.tsx`).
3. **App.tsx** mein us screen par real component render karo (abhi `PlaceholderModule` hai).
4. API baad mein connect karo (same backend/ERP API use karna hai).

## Production build — Play Store / signed APK+AAB (`com.dincouture.erp`)

**JDK:** Prefer **JDK 17** (`JAVA_HOME`); matches `compileOptions`/Gradle notes under `android/gradle.properties`.

1. **Vite env (Capacitor + real barcode):** Copy [`.env.production.example`](.env.production.example) → `.env.production` (gitignored). Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` exactly like web prod. **Do not omit `VITE_TARGET=capacitor`** — otherwise the barcode stub is bundled.
2. **Install & typecheck (optional gate):**

   ```bash
   npm ci && npm run typecheck
   ```

3. **Web bundle + sync Android:**

   ```bash
   npm run cap:sync:android:prod
   ```

4. **Version:** Bump `versionCode` (required for each Play upload) and optionally `versionName` in [`android/app/build.gradle`](android/app/build.gradle) under `defaultConfig`.

5. **Signing:** Copy [`android/keystore.properties.example`](android/keystore.properties.example) → `android/keystore.properties`, set passwords/alias/path to your `.jks` (paths relative to `android/`).  
   Omit `keystore.properties` only for internal Studio signing — **release `bundleRelease` / `assembleRelease` need signing for Play.**

6. **Gradle (from repo root):**

   ```bash
   npm run android:bundle           # AAB → Play Console
   npm run android:apk:release     # APK → sideload / testing
   ```

   Artifacts typically: `android/app/build/outputs/bundle/release/app-release.aab`, `android/app/build/outputs/apk/release/app-release.apk` (exact filename may include splits).

7. **Play:** Prefer **Google Play App Signing**; keep your **upload keystore** backup offline.

**Windows:** If `./gradlew` fails, open `android/` in Android Studio or run `gradlew.bat bundleRelease`.

## Build

```bash
npm run build
```

Output: `dist/`. PWA ya Capacitor ke liye same steps jo **docs/TASK_MOBILE_AND_PRODUCTION.md** mein hain.

## Settings module (permissions)

The **Settings** screen is gated like other modules: with permission V2, the role needs **`settings.view`** on the `settings` module (and **`settings.modify`** to edit printer/sync-related prefs where enforced). If users cannot see Settings in the grid or header shortcut, assign these permissions in the web ERP **Role / Permissions** UI for their role.

Production builds should use `npm run build` so developer-only panels stay hidden (`import.meta.env.DEV` is false).

For **connection debug** (Settings footer) and **verbose `[sync]` console logs** during local development, add to `erp-mobile-app/.env`:

`VITE_SHOW_ERP_DEV_TOOLS=true`

Both `npm run dev` and that flag are required; production users never see those tools.
