# iOS Development IPA — Build 15 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 15 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`

---

## Status

**Code / pipeline:** Ready — provisioning CLI fix applied.  
**IPA file:** Run build after one-time Xcode account sign-in (see below).

---

## Changelog vs build 14

- **Provisioning CLI fix:** `build-ios-release-mac.sh` passes `-allowProvisioningUpdates` and `-allowProvisioningDeviceRegistration` so `xcodebuild` can refresh expired development profiles.
- **Signing hardening:** `DEVELOPMENT_TEAM = NLNZN84GX4` on NDM ERP target (Debug + Release).
- **Preflight:** `scripts/check-xcode-apple-account.sh` fails fast with clear steps if Xcode has no Apple ID.
- **ExportOptions seed:** Picks highest `ios-export-buildN` folder (not alphabetical `build9`).

---

## One-time blocker — Xcode Apple ID

Build 14 profile expired **2026-06-09**. A new profile requires an Apple ID in Xcode:

1. **Xcode → Settings (⌘,) → Accounts → + → Apple ID**
2. Sign in: **nadeem313khan@yahoo.com** (team **NLNZN84GX4**)
3. Target **NDM ERP** → **Signing & Capabilities** → Team selected, automatic signing ✓
4. Optional: **Download Manual Profiles** on the team row

Verify:

```bash
bash erp-mobile-app/scripts/check-xcode-apple-account.sh
# Expected: [check-xcode-apple-account] OK — Apple ID and development certificate present.
```

---

## Build commands (Mac)

```bash
cd erp-mobile-app
npm run ios:ipa:release:mac
```

**Output (after successful run):**

| File | Purpose |
|------|---------|
| `releases/erp-mobile-1.0.5-build15.ipa` | Install on registered iPhone |
| `releases/ios-export-build15/NDM ERP.ipa` | Xcode export output |
| `releases/ios-export-build15/ExportOptions.plist` | Re-export options |

---

## Quick test (UAT)

| # | Check |
|---|--------|
| 1 | Login → prod Supabase |
| 2 | Home header clears status bar; logout button tappable |
| 3 | iOS swipe: module → home |
| 4 | Sales → Add Products → Scan opens ML Kit camera (not stub) |
| 5 | Expense/sale photo attach from camera |

**Install:** Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build15.ipa` onto connected iPhone (Development profile; device UDID registered on team).
