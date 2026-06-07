# iOS build (Mac only)

Build on a Mac with Xcode installed. **Windows cannot produce iOS binaries** — only refresh web assets (see below).

## Prerequisites

- macOS with Xcode (from App Store)
- Node.js LTS
- Apple Developer account (for device install / TestFlight / App Store)
- Bundle ID: `com.dincouture.erp` (see `capacitor.config.ts`)
- Supabase env: same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as web ERP ([`docs/infra/MOBILE_APK_LOCKED_PATTERN.md`](../../docs/infra/MOBILE_APK_LOCKED_PATTERN.md))

---

## Step A — Windows (prep for GitHub / Mac pull)

From `erp-mobile-app` on the Windows dev machine:

```powershell
npm ci
# Copy .env.example → .env and set VITE_SUPABASE_* if not already present
npm run cap:sync:ios:prod
```

This runs production Vite build + copies `dist/` into `ios/App/App/public` (gitignored locally; regenerated on Mac after pull).

**Do not** run `npx cap add ios` — the Xcode project already exists under `ios/`.

Commit and push source changes (`index.html`, `package.json`, `ios/` boilerplate, docs). Mac pulls and continues at Step B.

---

## Step B — Mac (Xcode run / TestFlight)

From `erp-mobile-app` on the MacBook:

```bash
git pull
npm ci
cp .env.example .env   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run cap:sync:ios:prod
cd ios/App && pod install
```

Or one command:

```bash
npm run ios:prep:mac
```

**ML Kit barcode (required):** `@capacitor-mlkit/barcode-scanning` uses CocoaPods on iOS (not SPM). After sync, `pod install` is required (`App/Pods` is gitignored).

**Important:** Open **`ios/App/App.xcworkspace`** — never `App.xcodeproj` alone (Pods will not build → “Search path Capacitor not found” errors). From `erp-mobile-app`: `npm run cap:ios`.

If Xcode still shows stale SPM warnings (CapacitorHaptics, etc.): **Product → Clean Build Folder**, quit Xcode, reopen `App.xcworkspace`.

In Xcode:

1. Select the **NDM ERP** target → **Signing & Capabilities** → Team + automatic signing.
2. Choose a simulator or connected iPhone.
3. **Product → Run** for debug, or **Product → Archive** for TestFlight / App Store.

Launch screen background matches app shell (`#111827`) — no white flash before WebView.

---

## After web or native changes

```bash
npm run cap:sync:ios:prod
```

Then rebuild in Xcode.

Dev bundle (non-prod URL bake):

```bash
npm run cap:sync:ios
```

---

## Company modules (same as Android)

Enable POS, Rental, Studio, Accounting in Web ERP → **Settings → Module Toggles**.  
Packing: **Settings → Inventory → Enable Packing**.
