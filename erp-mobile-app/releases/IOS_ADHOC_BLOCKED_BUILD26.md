# iOS Ad Hoc IPA — Build 26 (blocked)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 26 (`CURRENT_PROJECT_VERSION`)  
**Target export:** Ad Hoc (not Development)  
**Team:** NLNZN84GX4 (Nadeem Khan / nadeem313khan@yahoo.com)  
**Date:** 2026-07-31

---

## Why devices show “is No longer available”

Previous IPAs used **Development** (`method: debugging`). Those embeds a Development provisioning profile. Apple regenerates / expires those profiles often → installed apps die with **“No longer available”**.

**Deep fix:** ship **Ad Hoc** (or TestFlight / App Store) signed with **Apple Distribution**. Ad Hoc profiles last up to ~1 year and do not recycle like Development. True “never expires” only comes from **App Store** / ongoing TestFlight updates — sideloaded IPAs always have a profile lifetime.

---

## What we changed in the repo

- Default export is now **Ad Hoc**: `ios/ExportOptions-ad-hoc.plist` + `scripts/build-ios-release-mac.sh`
- Development kept only as override: `IOS_EXPORT_METHOD=debugging`
- Build **26** bumped in `ios/App/App.xcodeproj/project.pbxproj`
- Scripts fail fast if Distribution cert is missing (no long archive then opaque fail)

---

## Why build 26 Ad Hoc failed (Apple portal)

Archive succeeded. Export failed:

```
FORBIDDEN_ERROR
The selected team does not have a program membership that is eligible for this feature.
No signing certificate "iOS Distribution" found
Team does not have permission to create "iOS Ad Hoc" provisioning profiles
```

Keychain today has only:

- `Apple Development: nadeem313khan@yahoo.com` — **no** `Apple Distribution`

So team **NLNZN84GX4** can build Development IPAs, but is **not eligible** for Distribution / Ad Hoc until a **paid Apple Developer Program** membership is active on this team (or you switch Xcode to a paid company team).

---

## What you must do (one-time, Account Holder)

1. Enroll or renew: https://developer.apple.com/programs/enroll/ (~$99/year)
2. Confirm Membership shows **Active** for the same team used in Xcode (`NLNZN84GX4` or company team)
3. Xcode → **Settings → Accounts** → select that team → **Manage Certificates** → **+** → **Apple Distribution**
4. Developer portal → **Devices** → register every iPhone UDID that should install the IPA
5. Rebuild:

```bash
cd erp-mobile-app
IOS_EXPORT_METHOD=ad-hoc npm run ios:ipa:release:mac
```

IPA lands under `erp-mobile-app/releases/erp-mobile-1.0.5-build26.ipa`.

### Longer-term (least pain)

- **TestFlight** — users update in TestFlight; builds last 90 days but refresh is easy
- **App Store** (public or unlisted) — no “No longer available” for end users

### Interim only (still expires)

```bash
IOS_EXPORT_METHOD=debugging npm run ios:ipa:release:mac
```

Do **not** treat Development IPA as the deep fix.

---

## Status

| Item | Status |
|------|--------|
| Export method switched to Ad Hoc in scripts | Done |
| Build number 26 | Done |
| Apple Distribution cert | **Missing — needs paid membership** |
| Ad Hoc IPA artifact | **Not produced** |
