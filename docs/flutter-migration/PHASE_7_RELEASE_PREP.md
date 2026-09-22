# Phase 7 — release prep (partial)

**App:** `erp-flutter-app/`  
**Version:** `1.0.2+3` (`pubspec.yaml`)

## Done in this pass

| Item | Location |
|------|----------|
| Rental booking create (`create_rental_booking`) | `/rentals/new`, `rentals_write_repository.dart` |
| Build env verify script | `erp-flutter-app/scripts/verify-flutter-build-env.sh` |
| Release APK script | `erp-flutter-app/scripts/build-release-apk.sh` |
| Android `INTERNET` + `CAMERA` | `android/app/src/main/AndroidManifest.xml` |
| Settings app version | `package_info_plus` on Settings screen |
| Version bump | `1.0.2+3` |
| Rental receive payment | `record_payment_with_accounting` rental |
| Studio detail + stage complete | `/studio/:saleId`, `rpc_complete_stage` |
| Release signing template | `android/key.properties.example` |

## Release build (local)

```bash
cd erp-flutter-app
chmod +x scripts/*.sh
./scripts/build-release-apk.sh
```

Requires repo root `.env.production` with `VITE_SUPABASE_ANON_KEY` (same as web/Capacitor).

## Still required before production distribution

1. **QA** — `08_TESTING_QA_CHECKLIST.md` on a test company (money flows).
2. **Parity** — `10_PRODUCTION_RELEASE_CHECKLIST.md` vs Capacitor app.
3. **Release signing** — copy `android/key.properties.example` → `android/key.properties` + keystore (gitignored); falls back to debug if missing.
4. **User sign-off** for APK distribution outside pilot.

## Explicitly not in Phase 7 prep

- Full Drift offline DB
- Thermal / Sunmi print
- Studio production writes
- WhatsApp PDF intent
- Counter/PIN mode
