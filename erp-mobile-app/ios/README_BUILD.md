# iOS build (Mac only)

Build on a Mac with Xcode installed. Windows cannot produce iOS binaries.

## Prerequisites

- macOS with Xcode (from App Store)
- Node.js LTS
- Apple Developer account (for device install / TestFlight / App Store)
- Bundle ID: `com.dincouture.erp` (see `capacitor.config.ts`)

## Steps

From `erp-mobile-app`:

```bash
npm ci
cp .env.example .env   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (same as web ERP)
npm run build:mobile
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → Team + automatic signing.
2. Choose a simulator or connected iPhone.
3. **Product → Run** for debug, or **Product → Archive** for TestFlight / App Store.

## After web or native changes

```bash
npm run build:mobile && npx cap sync ios
```

Then rebuild in Xcode.

## Company modules (same as Android)

Enable POS, Rental, Studio, Accounting in Web ERP → **Settings → Module Toggles**.  
Packing: **Settings → Inventory → Enable Packing**.
