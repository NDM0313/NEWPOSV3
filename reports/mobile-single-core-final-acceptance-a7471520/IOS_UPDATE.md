# IOS_UPDATE.md

Generated: 2026-07-17 — Single Core iOS sync for product HEAD `a7471520`

## What was done

| Step | Result |
|------|--------|
| Align `CURRENT_PROJECT_VERSION` with Android `versionCode` | **39** (was 21) |
| `MARKETING_VERSION` | **1.0.5** (unchanged; matches Android `versionName`) |
| `npm run ios:prep:mac` (prod Vite build + `cap sync ios` + `pod install`) | **PASS** |
| Simulator build `NDM ERP` / iPhone 17 / Debug / `CODE_SIGNING_ALLOWED=NO` | **BUILD SUCCEEDED** |
| Bundle ID | `com.dincouture.erp` |
| Product HEAD baked into web assets | `a7471520` Single Core build |

## How to run on Mac

```bash
cd erp-mobile-app
npm run ios:prep:mac
npm run cap:ios   # opens App.xcworkspace
```

Open **`ios/App/App.xcworkspace`** (not `.xcodeproj`). Sign with team **NLNZN84GX4** for device/TestFlight.

## Not done (release-gated)

- TestFlight / App Store archive upload
- Production signing IPA distribution
- Physical iPhone device QA checklist

## Acceptance gates still open (not iOS-specific)

See `reports/mobile-single-core-final-acceptance-a7471520/` — Salesman credentials, Path A/B, physical Android QA, merge phrase remain external.
