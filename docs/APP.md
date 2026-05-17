# NEW POSV3 — Application overview

This repository contains the **web ERP** (Vite + React at the repo root) and the **mobile ERP PWA** under `erp-mobile-app/` (Capacitor-ready). Other folders (for example `POS/` or `expo-mobile-new/`) may exist for experiments; treat them as optional unless your team promotes them.

## Projects

| Area | Path | Role |
|------|------|------|
| Web ERP | `src/app/…` | Main ERP UI: sales, purchases, accounting, settings, permissions UI |
| Mobile | `erp-mobile-app/` | Same Supabase backend; offline/sync flows; permission-driven module visibility |

## Prerequisites

- Node.js (LTS)
- npm
- Environment variables for Supabase (web + mobile builds). See each app’s `.env` / deployment docs.

## Web ERP — local dev

From the repository root:

```bash
npm install
npm run dev
```

Other scripts (migrations, health checks, etc.) are listed in root `package.json`.

## Mobile (`erp-mobile-app`)

```bash
cd erp-mobile-app
npm install
npm run dev
```

Use your team’s env sync script from the repo root when applicable (for example `npm run sync:mobile-env` if configured).

## Mobile web PWA (`/m/` on the same host as Web ERP)

The mobile web app is built into **`/m/`** (see [`deploy/Dockerfile`](../deploy/Dockerfile) `mobile-builder` stage). **Before any production build**, ensure real Supabase vars are present: run `npm run sync:mobile-env` locally, and on the VPS rely on [`deploy/deploy.sh`](../deploy/deploy.sh) (it validates anon key and runs `verify-mobile-build-env.mjs` before `docker compose build`).

If login shows **demo anon key** or **user profile not found**, see **[MOBILE_WEB_LOGIN.md](./MOBILE_WEB_LOGIN.md)**.

## Permissions (summary)

- **Database source of truth:** `role_permissions` and `user_branches` (Postgres).
- **Web runtime:** `permissionService` / `permissionEngine` → `SettingsContext` → `checkPermission` / `useCheckPermission`.
- **Do not casually edit** `src/app/utils/checkPermission.ts` (active engine). Prefer matrix changes in DB + tests.
- **Mobile:** `PermissionContext` and `erp-mobile-app/src/api/permissions.ts`. Optional on-device matrix editing for admin/owner is **feature-flagged** and limited to **manager / user** engine roles; see `erp-mobile-app/src/config/featureFlags.ts` and `UserPermissionsScreen.tsx`.

**Inventory:** [PERMISSION_SYSTEM_INVENTORY.md](./PERMISSION_SYSTEM_INVENTORY.md)  
**Cleanup candidates (sign-off before delete):** [PERMISSION_DELETE_CANDIDATES.md](./PERMISSION_DELETE_CANDIDATES.md)

## Tests

From repo root:

```bash
npm run test:permissions
```

Covers mobile permission helpers / guard and selected `checkPermission` behaviour.

## Native Android / iOS

Gradle / Xcode projects under `erp-mobile-app/android` and `erp-mobile-app/ios` are maintained with Capacitor. Regenerate or open locally with `npx cap sync` / IDE workflows as needed; not every machine needs native folders for web-only work.

**Windows APK builds:** [APK_BUILD_WINDOWS.md](./APK_BUILD_WINDOWS.md) — quick commands: `cd erp-mobile-app && npm run android:debug:win`, or from repo root `npm run mobile:apk:debug:win`. Release log template: [`erp-mobile-app/releases/APK_UPDATE.md`](../erp-mobile-app/releases/APK_UPDATE.md).

## Contributing

- Prefer small, scoped commits.
- Do not commit secrets (`.env`, private keys).
- If your workflow uses Graphify, run `graphify update .` after substantive code edits (see `.cursor/rules`).
