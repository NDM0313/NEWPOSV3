# Flutter ERP — QA session log

| Field | Value |
|-------|--------|
| Date | 2026-06-11 |
| Tester | Automated pre-check + pending device QA |
| App version | `1.0.5+6` (`erp-flutter-app/pubspec.yaml`) |
| Device | Pending — Sunmi V2 + generic Android |
| Test company / branch | Pending — staging company |
| Capacitor comparison? | Pending |

## Automated pre-checks

```powershell
cd erp-flutter-app
.\scripts\smoke-api-check.ps1
flutter analyze
dart run build_runner build
```

| Check | Result |
|-------|--------|
| `flutter analyze` | Pass (info-only lints) |
| `build_runner` (Drift) | Pass — `database.g.dart` generated |
| Env smoke script | Pass — `.env.local`, HTTPS 200 |

## Results (tick when pass on staging device)

### Auth / branch
- [ ] Login admin + salesman
- [ ] Branch picker / session restore

### Money (staging)
- [ ] Draft sale → finalize → payment
- [ ] POS checkout + auto-print (thermal settings)
- [ ] Purchase draft → finalize → pay
- [ ] Expense create
- [ ] Rental create → pay → pickup → return (zero due)
- [ ] Studio stages → invoice line → GL finalize

### Offline (Drift queue)
- [ ] Draft sale queued offline → sync on reconnect
- [ ] Sale payment queued offline → sync
- [ ] Journal entry offline → sync
- [ ] Purchase cancel offline → sync

### Phase 8B — Device
- [ ] Sunmi thermal receipt after POS (auto-print on)
- [ ] Bluetooth ESC/POS fallback
- [ ] Barcode camera + keyboard wedge on POS

### Phase 8C — Counter PIN
- [ ] Enroll worker PIN in Settings
- [ ] Shared counter lock → PIN unlock → permissions reload

### Parity vs Capacitor (same branch)
- [ ] Product count
- [ ] One contact AR balance
- [ ] Sale paid/due after payment

## Discrepancies

| Area | Flutter | Capacitor / Web | Notes |
|------|---------|-----------------|-------|
| | | | |

## Sign-off

- [ ] Ready for pilot APK distribution
- [ ] `android/key.properties` + keystore configured locally
- Approver name / date:
