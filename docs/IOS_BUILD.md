# iOS Build

## Prerequisites

- Mac with Xcode
- Apple Developer account

## Steps

### 1. Build web assets

```bash
cd erp-mobile-app
npm run build:mobile
```

### 2. Sync to iOS

```bash
npx cap sync
```

### 3. Open in Xcode

```bash
npx cap open ios
```

### 4. Configure in Xcode

1. Select **App** target
2. **Signing & Capabilities** → select your Team (Apple ID)
3. **Bundle Identifier**: `com.dincouture.erp` (or your custom)

### 5. Build

- **Simulator**: Product → Run (select simulator)
- **Device**: Connect device, select it, Product → Run
- **Archive (IPA)**: Product → Archive → Distribute

## Output

- Simulator: runs in iOS Simulator
- Device: installs on connected iPhone/iPad
- Archive: IPA for TestFlight / App Store

## Script

See `scripts/build-ios.sh` for instructions (Xcode must be run manually for signing).
