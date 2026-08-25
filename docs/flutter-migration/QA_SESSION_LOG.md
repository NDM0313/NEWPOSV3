# Flutter ERP — QA session log (template)

Copy this table per test run. Use **staging / test company** only until sign-off.

| Field | Value |
|-------|--------|
| Date | |
| Tester | |
| App version | `erp-flutter-app/pubspec.yaml` |
| Device | |
| Test company / branch | |
| Capacitor comparison? | same user/branch |

## Automated pre-checks

```bash
cd erp-flutter-app
./scripts/smoke-api-check.sh
flutter analyze
```

## Results (tick when pass)

### Auth / branch
- [ ] Login admin + salesman
- [ ] Branch picker / session restore

### Money (staging)
- [ ] Draft sale → finalize → payment
- [ ] POS checkout
- [ ] Purchase draft → finalize → pay
- [ ] Expense create
- [ ] Rental create → pay → pickup → return (zero due)
- [ ] Studio stages → invoice line → finalize

### Offline
- [ ] Draft sale queued offline → sync on reconnect
- [ ] Sale payment queued offline → sync

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
- [ ] `android/key.properties` + keystore configured
- Approver name / date:
