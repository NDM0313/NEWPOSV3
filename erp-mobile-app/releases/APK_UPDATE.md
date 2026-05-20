# ERP Mobile — APK release log (fill on each build)

Copy this block for every new APK you ship. Keep the newest entry at the top.

---

## Latest build

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
