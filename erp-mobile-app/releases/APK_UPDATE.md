# ERP Mobile — release log (APK + iOS)

Copy a new block for every build. Keep the newest entry at the top.

---

## Next build — 1.0.5 (build 10) — recommended after auth fix

After pulling `main` with `fix(mobile): recover stale Supabase refresh tokens`, rebuild so the native bundle includes the updated `dist`:

```bash
cd erp-mobile-app
npm run cap:sync:android:prod && cd android && ./gradlew assembleRelease
npm run cap:sync:ios:prod   # then Archive in Xcode
```

Changelog: silent recovery when iOS logs `refresh_token_not_found` on cold start (login / PIN screen instead of console error).

---

## Latest build — 1.0.5 (build 9) — 2026-05-24

| Field | Value |
|--------|--------|
| **Date** | 2026-05-24 |
| **versionName** | 1.0.5 |
| **versionCode** | 9 |
| **Git commit** | `dc71f969` |
| **Android** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build9.apk` (~28 MB) |
| **Gradle source** | `android/app/build/outputs/apk/release/app-release.apk` |
| **iOS** | `cap:sync:ios:prod` + Archive/Export (Development signing) |
| **IPA path (local)** | `releases/erp-mobile-1.0.5-build9.ipa` (~3.4 MB) |
| **Built on** | Mac — `cap:sync:android:prod` + `./gradlew assembleRelease` |

### Changelog (user-facing) — build 9

- **Lead registration link:** company + branch in URL; WhatsApp / Email / Copy share from Contacts.
- **Public leads:** list shows `Ref: …` from link until approved; **Pending lead** badge; admin **Approve** assigns `CUS-xxxx`.
- **Products:** list thumb shows photo or “No photo”; tap opens preview.
- **Invoice PDF:** centered company header (table layout for print).
- **Counter PIN:** background-only re-lock; 7-day policy sync; email login hidden when counter slots exist.
- Includes build 8: sale stock RPC, negative stock setting, native barcode scan.

### Install notes — Android (build 9 release)

1. **Uninstall** any previous ERP Mobile app (especially debug builds 7/8 — different signing key).
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build9.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build9.apk`
3. Release signing uses `android/app/release-key.jks` (generated on build machine if missing). Keep keystore backup for future updates.
4. API base: `https://erp.dincouture.pk` (from `.env.production` at sync time).

### Install notes — iOS (build 9)

1. Install via Xcode **Devices**, Apple Configurator, or MDM: `releases/erp-mobile-1.0.5-build9.ipa` (Apple Development profile — device must be on your team).
2. Or: `npx cap open ios` → scheme **NDM ERP** → Run on connected iPhone.
3. Archive: `ios/build/App.xcarchive`. Ad Hoc / TestFlight needs **iOS Distribution** certificate in Xcode.

### Mobile test checklist (build 9)

| # | Area | Verify |
|---|------|--------|
| 1 | Contacts → link icon | Share link has `company` + `branch`; WhatsApp/Email work |
| 2 | Public register → Contacts (web) | New lead shows `Ref:`; Approve → `CUS-xxxx` |
| 3 | Products list | Thumb shows image or “No photo” |
| 4 | Sales invoice PDF | Centered company block |
| 5 | Counter PIN | No re-lock on in-app navigation; re-lock after background |

---

## Previous build — 1.0.5 (build 8) — 2026-05-24

| Field | Value |
|--------|--------|
| **Date** | 2026-05-24 |
| **versionName** | 1.0.5 |
| **versionCode** | 8 |
| **Git commit** | `74c847d0` (+ `versionCode` bump local) |
| **VPS migrations** | `20260527120000_get_company_negative_stock_allowed.sql`, `20260527140000_ensure_sale_stock_movements_rpc.sql` — **applied** |
| **Android** | Debug (unsigned test) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build8-debug.apk` (~30 MB) |
| **Gradle source** | `android/app/build/outputs/apk/debug/app-debug.apk` |
| **Built on** | Mac — `cap:sync:android:prod` + `./gradlew assembleDebug` |

### Changelog (user-facing) — build 8

- **Sale posting fix:** salesman Confirm Payment no longer fails with 403 on `stock_movements` (uses `ensure_sale_stock_movements` RPC).
- **Negative stock:** company-wide setting applies to all roles when admin enables it (Sales/POS product pickers).
- **Performance:** faster product/stock load; reduced Settings render loop; lighter app bootstrap.
- Includes build 7: native barcode scan (Add Products), Settings accordions, branch `"all"` UUID fix.

### Install notes — Android (build 8 debug)

1. **Uninstall** any previous ERP Mobile app (clears WebView cache and IndexedDB).
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build8-debug.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build8-debug.apk`
3. Debug builds use a different signing key than release build 5 — uninstall is required if install fails with signature conflict.
4. Cold boot: splash ~2s, then login. API base: `https://erp.dincouture.pk`.
5. One **email login** after VPS deploy if counter PIN vault expired.

### Mobile test checklist (build 8)

| # | Area | Verify |
|---|------|--------|
| 1 | Salesman → New Sale → Confirm Payment | Sale saves; no 403 on `stock_movements` |
| 2 | Negative stock ON (admin) → salesman Add Products | Out-of-stock items selectable |
| 3 | Cold boot | Login within ~15s |
| 4 | Sales → Scan / POS Scan | Native camera still works (build 7 regression) |
| 5 | All Branches payment | No `uuid: "all"` toast |
| 6 | Settings accordions | Counter + Printer expand OK |

---

## Previous build — 1.0.5 (build 7) — 2026-05-23

| Field | Value |
|--------|--------|
| **Date** | 2026-05-23 |
| **versionName** | 1.0.5 |
| **versionCode** | 7 |
| **Git commit** | `17a753e` |
| **Android** | Debug (unsigned test) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build7-debug.apk` (~30 MB) |
| **Gradle source** | `android/app/build/outputs/apk/debug/app-debug.apk` |
| **Built from** | `main` after pull `83262ae` + migrations commit |

### Changelog (user-facing) — build 7

- **Barcode scan (Add Products):** native ML Kit camera on Android/iOS — Sales → Add Items → **Scan** (no browser `BarcodeDetector` error).
- **Settings UX:** accordions — only **Account & branch** open by default; **Counter & lock screen** and **Printer & barcode** expand on tap.
- **Branch "all" UUID fix:** payment / expense with **All Branches** no longer sends `uuid: "all"` to RPCs.
- Includes build 6: My Activity, counter PIN session policy, Shipment & Cargo UI.

### Install notes — Android (build 7 debug)

1. **Uninstall** any previous ERP Mobile app (clears WebView cache and IndexedDB).
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build7-debug.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build7-debug.apk`
3. Debug builds use a different signing key than release build 5 — uninstall is required if install fails with signature conflict.
4. Cold boot: splash ~2s, then login. API base: `https://erp.dincouture.pk`.
5. Settings → **Printer & barcode** → method **Camera** for native scan.

### Mobile test checklist (build 7)

| # | Area | Verify |
|---|------|--------|
| 1 | Cold boot | Login within ~15s (not endless blue) |
| 2 | All Branches payment | No `uuid: "all"` toast |
| 3 | Settings | Accordions collapsed; Counter + Printer expand OK |
| 4 | Sales → Add Items → Scan | Native camera; EAN adds product |
| 5 | POS Scan | Regression OK |
| 6 | Counter PIN | One email login if vault expired after VPS deploy |

---

## Previous build — 1.0.5 (build 6) — 2026-05-23

| Field | Value |
|--------|--------|
| **Date** | 2026-05-23 |
| **versionName** | 1.0.5 |
| **versionCode** | 6 |
| **Git commit** | `2a5dad94` (VPS deployed); local mobile assets may include uncommitted `gradle.properties` fix |
| **VPS** | `dincouture-vps` — migrations + `deploy.sh` OK; `post_sale_shipment_journal` applied |
| **GoTrue audit** | PASS (4 checks, 0 WARN) — no auth `.env` changes |
| **Android** | Debug (unsigned test) |
| **APK path (local)** | `releases/erp-mobile-1.0.5-build6-debug.apk` (~31 MB) |
| **Gradle source** | `android/app/build/outputs/apk/debug/app-debug.apk` |
| **iOS** | `cap:sync:ios:prod` + Archive/Export OK |
| **IPA path (local)** | `releases/erp-mobile-1.0.5-build6.ipa` (Development signing) |

### Changelog (user-facing) — build 6

- **My Activity:** date presets (7 / 15 / month), **Created by** on rows and detail sheet, balance masking (`****`) for workers.
- **Accounts:** larger KPI typography; fund tiles masked when user cannot view balances.
- **Counter PIN / session:** vault token maintenance, configurable max age (Settings), advisories on lock screens; after VPS deploy do **one email login** per tablet if PIN shows expired vault.
- **Shipment & Cargo:** status/dates UI; backend `post_sale_shipment_journal` (requires VPS migration `20260526120000` — applied).

### Install notes — Android (build 6 debug)

1. **Uninstall** any previous ERP Mobile app (clears WebView cache and IndexedDB).
2. Install: `erp-mobile-app/releases/erp-mobile-1.0.5-build6-debug.apk`  
   `adb install -r releases/erp-mobile-1.0.5-build6-debug.apk`
3. Debug builds use a different signing key than release build 5 — uninstall is required if install fails with signature conflict.
4. Cold boot: splash ~2s, then login. API base: `https://erp.dincouture.pk` (from `.env.production` at sync time).
5. If counter PIN fails after deploy: **log in once with email/password**, then use PIN again.

### Install notes — iOS (build 6)

1. Install via Xcode **Devices** window, Apple Configurator, or MDM using `releases/erp-mobile-1.0.5-build6.ipa` (Development profile — device must be registered in your Apple team).
2. Or connect iPhone → `npx cap open ios` → scheme **NDM ERP** → **Product → Run**.
3. Archive on disk: `ios/build/App.xcarchive` (re-export with Xcode Organizer if you need Ad Hoc / TestFlight).

### Mobile test checklist (post-install)

| Area | Verify |
|------|--------|
| **Counter PIN** | Settings → session policy; PIN after hours; one email login if vault expired |
| **My Activity** | Date chips, Created by, masked balances (worker) |
| **Shipment & Cargo** | Dates/status; journal after dispatch (needs VPS migration — live) |
| **Accounts** | Larger KPIs (owner); `****` on fund tiles (worker) |

---

## Previous build — 1.0.4 (build 5)

| Field | Value |
|--------|--------|
| **Date** | 2026-05-21 |
| **versionName** | 1.0.4 |
| **versionCode** | 5 |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.4-build5.apk` |

### Changelog (user-facing) — build 5

- Physical device WebView boot fix: relative `./assets/` paths (not absolute `/assets/`), single inlined JS bundle (~2.4 MB), ES5-safe boot watchdog, splash auto-hides after 2s so login/fallback is visible.

### Install notes (build 5)

1. **Uninstall** any previous ERP Mobile app (clears WebView cache and IndexedDB).
2. Install `releases/erp-mobile-1.0.4-build5.apk`.
3. Cold boot: splash ~2s, then login screen OR boot fallback with **Reload app** button.
4. If still plain blue after 12s: `adb logcat | findstr /i "chromium capacitor ERP Failed"`

---

## Previous build (1.0.3 build 4)

| Field | Value |
|--------|--------|
| **Date** | 2026-05-21 |
| **versionName** | 1.0.3 |
| **versionCode** | 4 |
| **APK path (local)** | `releases/erp-mobile-1.0.3-build4.apk` |

### Changelog (user-facing) — build 4

- Fix release APK blank/blue boot screen: Vite WebView-compatible transpile targets, dist verification before cap sync, pre-React boot fallback UI, lazy-loaded modules, auth bootstrap timeout.
- Register native ErpPrinter plugin on Android startup (printing).

### Install notes (build 4)

1. **Uninstall** the old 1.0.2 app first (clears WebView cache and IndexedDB).
2. Install `releases/erp-mobile-1.0.3-build4.apk`.
3. Cold boot should show the login screen (dark UI). If startup fails, you should see a **Reload app** fallback instead of a blank screen.
4. If still blank: connect tablet via USB and run `adb logcat | findstr /i "chromium capacitor ERP"`.

---

## Previous build (1.0.2 build 3)

- Settings **Thermal / A4** now drives real printing (Sunmi built-in → Bluetooth ESC/POS → browser A4).
- **Test print** in Settings; Bluetooth printer picker for paired devices.
- **Auto-print receipt** after Sale and POS checkout when enabled.
- **Print labels** on Products (barcode/SKU) with thermal or A4 layout.
- Salesman can save printer settings (RLS fix for `auth_user_id` users).

---

## Previous build (1.0.1 build 2)

| Field | Value |
|--------|--------|
| **Date** | 2026-05-20 |
| **versionName** | 1.0.1 |
| **versionCode** | 2 |
| **Git commit** | `9912cfe` |
| **Configuration** | Release (signed) |
| **APK path (local)** | `android/app/build/outputs/apk/release/app-release.apk` (copy: `releases/erp-mobile-1.0.1-build2.apk` for uploads) |
| **Download URL** | Create release on GitHub (see below). Intended tag: `mobile-v1.0.1-build2`. |

### Create the GitHub Release (APK upload)

`gh` was not available on the Windows build machine. On any machine with [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`):

**Windows (from repo root):**

```powershell
powershell -ExecutionPolicy Bypass -File .\erp-mobile-app\releases\publish-github-release.ps1
```

**Or manually from repo root:**

```bash
gh release create mobile-v1.0.1-build2 \
  --title "ERP Mobile 1.0.1 (build 2) — Shared counter PIN" \
  --notes-file erp-mobile-app/releases/GH_RELEASE_NOTES_mobile-v1.0.1-build2.md \
  erp-mobile-app/releases/erp-mobile-1.0.1-build2.apk
```

Or use **GitHub → Releases → Draft a new release**: tag `mobile-v1.0.1-build2`, upload `erp-mobile-app/releases/erp-mobile-1.0.1-build2.apk`, paste the contents of `erp-mobile-app/releases/GH_RELEASE_NOTES_mobile-v1.0.1-build2.md` as the description.

### Changelog (user-facing)

- Shared counter / POS lock screen: enrolled users, device-bound refresh tokens in vault, logout → lock when enrolled.
- **Counter tablet PIN** in Settings is available to **all staff** with a concrete branch (not only owner/admin).
- **Unique 4-digit PIN per person** on the tablet: saving a PIN already used by another login is blocked (prevents overwriting the other user’s slot).
- First-login **Set PIN**: optional counter vault enroll when PIN is exactly 4 digits and branch resolves via profile.
- Skip POS lock immediately after interactive email login + Set PIN (where applicable).

### Notes for installers

- Uninstall old debug builds if package signature conflicts.
- After Web ERP module toggles change, users should **log out and log in** on mobile.
- Each cashier must pick a **different** 4-digit counter PIN on the same tablet.

---

## Build entry (template)

| Field | Value |
|--------|--------|
| **Date** | YYYY-MM-DD |
| **versionName** | e.g. 1.0.1 (must match `android/app/build.gradle` `defaultConfig`) |
| **versionCode** | integer (must match `android/app/build.gradle`) |
| **Git commit** | short SHA from `git rev-parse --short HEAD` |
| **Configuration** | Debug / Release |
| **APK path (local)** | e.g. `android/app/build/outputs/apk/release/app-release.apk` |
| **Download URL** | optional: Drive / portal / internal server |

### Changelog (user-facing)

- …

### Notes for installers

- Uninstall old debug builds if package signature conflicts.
- After Web ERP module toggles change, users should **log out and log in** on mobile.
