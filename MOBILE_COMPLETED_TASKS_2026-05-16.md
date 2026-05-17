# Mobile / build — completed tasks (16 May 2026)

## Production Android pipeline

- `erp-mobile-app/package.json`: `build:mobile:prod`, `cap:sync:android:prod`, `android:bundle`, `android:apk:release`, `android:debug` using `./gradlew`.
- `erp-mobile-app/.env.example` + `.gitignore`: `.env.production` pattern; production Vite mode documented.
- `erp-mobile-app/android/app/build.gradle`: optional `keystore.properties` release signing.
- `erp-mobile-app/android/keystore.properties.example`, `android/.gitignore` for secrets.
- `erp-mobile-app/README.md`, `android/README_BUILD.md`, `docs/MOBILE_APP_ARCHITECTURE.md`: production build + JDK notes.

## Database (purchase create RPC)

- `migrations/20260513120000_global_document_numbering_rpcs.sql`: `create_purchase_document_header` inserts `purchase_status` / `payment_status` enums correctly (not `TEXT`).
- `migrations/20260516200000_fix_create_purchase_document_header_enum_casts.sql`: idempotent `CREATE OR REPLACE` for DBs that already applied the older function body.
- Live VPS Postgres was updated earlier with the same function fix (`supabase_admin`).

## Offline read-cache (IndexedDB)

- New `erp-mobile-app/src/lib/listCache.ts` (`erp_mobile_list_cache` DB).
- `getPaymentAccounts`, `getBranches`, `getProducts`, `getContacts`, and offline path for `getProductByBarcodeOrSku` cache on success / read when offline.
- `App.tsx`: online prefetch warms payment accounts, branches, products, contacts after `companyId` + branch are known.

## UI

- `MobilePaymentSheet.tsx`: native `<select>` replaced with themed bottom-sheet account picker.

## Verification

- `npm run typecheck` in `erp-mobile-app` passes.
- `npm run cap:sync:android:prod` succeeds on MacBook (production Vite + Capacitor sync).
