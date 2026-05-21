# ERP Mobile — APK release log (fill on each build)

Copy this block for every new APK you ship. Keep the newest entry at the top.

---

## Latest build

| Field | Value |
|--------|--------|
| **Date** | 2026-05-21 |
| **versionName** | 1.0.4 |
| **versionCode** | 5 |
| **Git commit** | (current HEAD) |
| **Configuration** | Release (signed) |
| **APK path (local)** | `releases/erp-mobile-1.0.4-build5.apk` |
| **Download URL** | GitHub release `mobile-v1.0.4-build5` (after upload) |

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
