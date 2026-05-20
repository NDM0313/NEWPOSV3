# MacBook handoff — ERP Mobile (after Windows 2026-05-20)

Work completed on **Windows** and released as **ERP Mobile 1.0.1 (versionCode 2)** — shared counter / POS lock screen, staff Counter tablet PIN, duplicate-PIN guard, login Set PIN counter enroll path, and related wiring.

## Before you start (Mac)

```bash
git checkout main
git pull origin main
cd erp-mobile-app && npm ci && npm run typecheck
```

## Get the APK

- **After GitHub Release exists:** download **`erp-mobile-1.0.1-build2.apk`** from release tag **`mobile-v1.0.1-build2`** on [NEWPOSV3 releases](https://github.com/NDM0313/NEWPOSV3/releases).
- **If the release is not created yet:** the signed file should still be on the Windows machine at `erp-mobile-app/releases/erp-mobile-1.0.1-build2.apk` (or rebuild from `main`). Publish the release using GitHub CLI or the web UI — see [`erp-mobile-app/releases/APK_UPDATE.md`](../erp-mobile-app/releases/APK_UPDATE.md) section **Create the GitHub Release**.

### Publish release from Mac (example)

```bash
# Install: https://cli.github.com/
gh auth login
cd /path/to/NEWPOSV3
git pull origin main
gh release create mobile-v1.0.1-build2 \
  --title "ERP Mobile 1.0.1 (build 2) — Shared counter PIN" \
  --notes-file erp-mobile-app/releases/GH_RELEASE_NOTES_mobile-v1.0.1-build2.md \
  erp-mobile-app/releases/erp-mobile-1.0.1-build2.apk
```

If the `.apk` is only on Windows, copy it to the Mac first (AirDrop / Drive / `scp`), then run `gh release create` with that local path.

**Windows shortcut:** from repo root run `powershell -ExecutionPolicy Bypass -File .\erp-mobile-app\releases\publish-github-release.ps1` (requires `gh` on PATH).

### Or rebuild signed Release on Mac

Copy `android/keystore.properties` from a secure channel (never commit it), then:

```bash
cd erp-mobile-app
npm run cap:sync:android:prod
cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Manual QA checklist

1. **Two users, different PINs:** Owner signs in → Settings → **Counter tablet PIN** → save 4-digit PIN A. Sign out (or switch). Salesman signs in → same → PIN B (different from A). Both names appear under **Who shows on the lock / home screen**.
2. **Duplicate PIN blocked:** Try to save the same 4-digit PIN as another enrolled user → error; first user still listed.
3. **Shared Counter Mode:** Toggle on → cold boot and logout show POS lock when at least one user is enrolled; PIN switch restores session.
4. **First login Set PIN:** New user, single branch, 4-digit quick PIN → counter list should include them without visiting Settings enroll first (unless PIN already taken on device).
5. **Env:** No **demo anon key** banner — confirm [`erp-mobile-app/.env`](erp-mobile-app/.env) / production build keys match VPS ([`docs/infra/MOBILE_APK_LOCKED_PATTERN.md`](infra/MOBILE_APK_LOCKED_PATTERN.md)).

## Remaining / deferred (roadmaps)

| Item | Where |
|------|--------|
| RPC duplicate `create_business_transaction` — drop older overload in Supabase | [`docs/mobile_phase4_polish.plan.md`](mobile_phase4_polish.plan.md) |
| Inventory products list — pagination / virtualization | [`docs/mobile_phase5_core_inventory.plan.md`](mobile_phase5_core_inventory.plan.md) (deferred) |
| Optional: auto-enable Shared Counter Mode when first counter enroll happens from **Login Set PIN** (Settings path already auto-enables on first slot) | Product choice |
| Optional: restrict **Shared Counter Mode** toggle to admin only | Product choice |

## Reference

- Phase 6 roadmap: [`docs/mobile_phase6_pos_lockscreen.plan.md`](mobile_phase6_pos_lockscreen.plan.md)
- APK log: [`erp-mobile-app/releases/APK_UPDATE.md`](../erp-mobile-app/releases/APK_UPDATE.md)

## If Android build fails on Mac

- **JDK 17** (`JAVA_HOME`)
- `android/local.properties` with `sdk.dir`
- Signing: `android/keystore.properties` + `.jks` path (not in git)
