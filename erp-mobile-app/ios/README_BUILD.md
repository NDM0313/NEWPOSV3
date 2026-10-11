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

1. **One-time:** **Xcode → Settings → Accounts** → add Apple ID for team **NLNZN84GX4** (required for CLI archive / fresh provisioning profiles).
2. Select the **NDM ERP** target → **Signing & Capabilities** → Team + automatic signing.
3. Choose a simulator or connected iPhone.
4. **Product → Run** for debug, or **Product → Archive** for TestFlight / App Store.

CLI release IPA (same signing requirements):

```bash
npm run ios:ipa:release:mac
```

Preflight: `bash scripts/check-xcode-apple-account.sh` — must pass before archive.

Launch screen background matches app shell (`#111827`) — no white flash before WebView.

---

## Staging iOS (side-by-side with production)

Installs next to production without overwriting it.

| | Production | Staging |
|---|---|---|
| Bundle ID | `com.dincouture.erp` | `com.dincouture.erp.stage` |
| Home-screen name | Din Collection | **ERP Stage** |
| API | `https://api.ndmcore.com` | `https://api-stage.ndmcore.com` |
| Icon | Production art | Orange **STAGE** banner |
| In-app | — | Amber `[STAGING DB]` strip |

On Mac after `git pull`:

```bash
cd erp-mobile-app
npm ci
cp .env.staging.example .env.staging   # already filled with staging URL + anon
npm run ios:prep:mac:stage             # build:mobile:stage + STAGE icon + cap sync ios + pod install
npm run cap:ios                        # opens App.xcworkspace
```

Or step-by-step: `npm run build:mobile:stage` then `npm run cap:sync:ios:stage`.

Restore production icon/bundle before a prod IPA: unset `CAP_PROFILE` / use `npm run cap:sync:ios:prod`, and run `python3 scripts/badge-ios-stage-icon.py --restore-prod`.

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
