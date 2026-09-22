# iOS Development IPA — Build 14 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 14 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`

---

## Files

| File | Purpose |
|------|---------|
| `releases/erp-mobile-1.0.5-build14.ipa` | Install on registered iPhone |
| `releases/ios-export-build14/NDM ERP.ipa` | Xcode export output |
| `releases/ios-export-build14/ExportOptions.plist` | Re-export options (auto-seeded from prior build if missing) |

---

## Changelog vs build 13

- **Home screen:** Top header uses `flow-screen-header` safe-area (status bar / notch clearance).
- **Release pipeline:** `VITE_TARGET=capacitor` required (fail build if mlkit-stub would ship); iOS export folder auto-seed in `build-ios-release-mac.sh`.
- **Storage:** Safe session/local storage helpers on mobile (`pinLock`, Supabase auth).
- **Web parity:** Storage hardening + TopHeader logout fix deployed to `erp.dincouture.pk`.

**Android parity:** `versionCode 39` → `releases/erp-mobile-1.0.5-build39.apk`

---

## Build commands (Mac)

```bash
cd erp-mobile-app
npm run ios:ipa:release:mac
```

---

## Quick test (UAT)

| # | Check |
|---|--------|
| 1 | Login → prod Supabase |
| 2 | Home header clears status bar; logout button tappable |
| 3 | Android back / iOS swipe: module → home |
| 4 | Sales → Add Products → Scan opens ML Kit camera (not stub) |
| 5 | Expense/sale photo attach from camera |

**Install:** Xcode → Devices → drag `erp-mobile-1.0.5-build14.ipa` (Development profile; device registered on team).
