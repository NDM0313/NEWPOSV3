# 10 — Production Release Checklist

Flutter ERP APK release gates. **No direct production writes until approved.**

## Pre-release requirements

### Staging test required

- [ ] Full pass of [08_TESTING_QA_CHECKLIST.md](08_TESTING_QA_CHECKLIST.md) on **staging company** or isolated test company
- [ ] Optional: read-only smoke on production (login, list products, no writes)
- [ ] Money flows (sale final, payment) tested on **non-production** data first

### Backup required

- [ ] Database backup before any server-side change related to release
  - Example: `supabase db dump` to `backups/` (see [`studio-implementation-safety.mdc`](../../.cursor/rules/studio-implementation-safety.mdc))
- [ ] Flutter v1 should **not** require new migrations — if it does, separate migration review required

### No production writes until approved

- [ ] Explicit user sign-off for production APK distribution
- [ ] No automated sync to production VPS from CI without approval
- [ ] No `git push` to production deploy branch without review ([`GIT_WORKFLOW_RULES.txt`](../../GIT_WORKFLOW_RULES.txt))

## Side-by-side comparison with Capacitor app

Run same scenarios on **Capacitor** (`erp-mobile-app`) and **Flutter** with identical:

| Scenario | Compare |
|----------|---------|
| Login + branch | Same branches visible |
| Product count | Same branch filter |
| Sale final | Same SL number sequence (different numbers OK; same totals logic) |
| Payment | RCV reference format; paid/due on sale |
| Salesman list | Same row count for `view_own` |
| Ledger sample | Same AR balance for one contact |

Document discrepancies before prod release.

## Rollback plan

1. **Keep Capacitor APK** published / sideloaded as fallback (`com.dincouture.erp` — same package ID if replacing APK requires uninstall; consider `com.dincouture.erp.flutter` for parallel install during pilot)
2. **No server rollback** needed if Flutter uses existing RPCs only
3. **Disable Flutter rollout** — stop distributing new APK; users revert to Capacitor build
4. **Data integrity** — if bad writes occurred, use existing web ERP repair RPCs / admin tools (not new Flutter-only fixes)

## APK build checklist

Mirror [`erp-mobile-app/scripts/verify-mobile-build-env.mjs`](../../erp-mobile-app/scripts/verify-mobile-build-env.mjs):

- [ ] Supabase anon key present and not demo/placeholder key
- [ ] Native API URL baked: `https://erp.dincouture.pk`
- [ ] `applicationId` decided (`com.dincouture.erp` vs `.flutter` for pilot)
- [ ] `versionCode` incremented (Capacitor current: **39** in [`build.gradle`](../../erp-mobile-app/android/app/build.gradle))
- [ ] `versionName` set (e.g. `1.0.0-flutter-beta1`)
- [ ] Release signing keystore configured (do not commit `keystore.properties`)
- [ ] `minSdk 24`, `targetSdk` current (36 in Capacitor)
- [ ] ProGuard/R8 rules if using reflection for platform channels
- [ ] Build command documented in `erp-flutter-app/README.md`

Capacitor reference build:

```bash
cd erp-mobile-app
npm run verify:mobile:env
npm run cap:sync:android:prod
cd android && ./gradlew assembleRelease
```

## Device test checklist (production pilot)

### Mandatory devices

- [ ] **Sunmi V2 Pro** (or primary shop Sunmi) — thermal print + POS flow
- [ ] Generic Android 10+ phone — Bluetooth printer if used
- [ ] Same WiFi/network as production shops (ERP nginx reachable)

### Per-device tests

- [ ] Cold start login & session restore
- [ ] POS sale + thermal receipt
- [ ] Barcode scan in POS
- [ ] Offline sale queue + sync when online
- [ ] WhatsApp/PDF share of invoice
- [ ] Background/foreground — no data loss on pending cart
- [ ] PIN/counter lock (if enabled in pilot build)

### iOS (if scoped)

Capacitor has [`ios/`](../../erp-mobile-app/ios/) build. Flutter iOS not assumed in v1 — skip unless Open Question resolved.

## Infrastructure verification (no change without approval)

- [ ] `erp.dincouture.pk` CORS allows Flutter app origin if using custom scheme
- [ ] Kong mobile origins still include Capacitor origins ([`MOBILE_APK_LOCKED_PATTERN.md`](../../docs/infra/MOBILE_APK_LOCKED_PATTERN.md))
- [ ] Anon key rotation: rebuild APK after key change

## Post-release monitoring

- [ ] Watch Supabase error logs for RLS violations from new client
- [ ] Monitor duplicate payment/sale patterns (same user, same timestamp)
- [ ] User feedback channel for print/barcode issues on Sunmi
- [ ] `settings.mobile_sync_status` or equivalent error counts (optional)

## Documentation updates on release

- [ ] Update internal runbook with Flutter APK install steps
- [ ] Note Flutter vs Capacitor parallel support period
- [ ] Do **not** update `MOBILE_APK_LOCKED_PATTERN.md` unless URL/auth behavior changes
