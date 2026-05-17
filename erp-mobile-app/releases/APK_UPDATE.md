# ERP Mobile — APK release log (fill on each build)

Copy this block for every new APK you ship. Keep the newest entry at the top.

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

---

## Latest build

| Field | Value |
|--------|--------|
| **Date** | _pending_ |
| **versionName** | 1.0 |
| **versionCode** | 1 |
| **Git commit** | _run `git rev-parse --short HEAD`_ |
| **Configuration** | _Debug or Release_ |
| **APK path** | _fill after `npm run android:debug:win` or release script_ |

### Changelog

- Initial template. Replace when you produce the first distributed APK.
