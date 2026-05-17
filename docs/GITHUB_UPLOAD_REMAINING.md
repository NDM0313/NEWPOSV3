# Remaining tasks after GitHub upload (handoff)

This file tracks **follow-ups** that are intentionally **not** fully closed in a single push. Use it as a checklist for the next session.

## Done in repo (reference)

- [x] **Git pull** — stay current with `main` (`git pull origin main`).
- [x] **Windows APK builder** — scripts and docs: [`docs/APK_BUILD_WINDOWS.md`](./APK_BUILD_WINDOWS.md), `erp-mobile-app/scripts/build-apk-windows.ps1`, `build-apk-windows.cmd`, npm scripts `android:*:win` and root `mobile:apk:*:win`.
- [x] **APK update log template** — [`erp-mobile-app/releases/APK_UPDATE.md`](../erp-mobile-app/releases/APK_UPDATE.md) (fill after each build).

## Permissions / cleanup (needs sign-off)

- [ ] Review [PERMISSION_DELETE_CANDIDATES.md](./PERMISSION_DELETE_CANDIDATES.md) and approve removal of unused components (`UserPermissionsTab`, `PermissionManagementPanel`) if still unreferenced.
- [ ] Decide fate of legacy `settings.user_permissions` writes (`SettingsContext.updatePermissions` + `SettingsPageComplete`) — confirm no production reliance, then deprecate or remove.
- [ ] Staging: enable mobile matrix editor only when ready: `localStorage.setItem('erp_mobile_feature_role_matrix_editor', 'true')` then reload (see `erp-mobile-app/src/config/featureFlags.ts`).

## Repo hygiene (optional)

- [ ] Add `graphify-out/cache/` to `.gitignore` if the team does not want AST cache JSON in git (large noise); keep `GRAPH_REPORT.md` / manifest policy as your team prefers.
- [ ] Decide whether `POS/` and `expo-mobile-new/` should be tracked, moved to another repo, or gitignored.

## Database / VPS

- [ ] Apply pending SQL under `migrations/` and `deploy/` on the target Supabase/VPS using your standard process (`npm run migrate` or manual SQL as owner).

## Android / native builds

- [ ] Local: `cd erp-mobile-app && npm run build:mobile && npx cap sync` when you are ready to refresh native projects; fix Gradle/SDK versions per your machine.
- [ ] After each distributed APK: update [`erp-mobile-app/releases/APK_UPDATE.md`](../erp-mobile-app/releases/APK_UPDATE.md) with version, path/URL, and changelog.

## Documentation

- [ ] Keep [APP.md](./APP.md) updated when major entrypoints or scripts change.
