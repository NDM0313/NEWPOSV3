# Mobile parity implementation plan

**Generated:** 2026-07-01  
**Scope:** Planning only — **no APK release** in this run

## 1. Target mobile screens

| Screen | Web status | Capacitor target | Flutter (later) |
|--------|------------|------------------|-----------------|
| Ledger V2 | unified live | New screen + unified RPC | journal_list extension |
| Account Statement | unified live | Upgrade AccountLedgerReport | contact_ledger extension |
| Trial Balance | unified live | New screen | New screen |
| Cash Flow | unified live | New screen | New screen |
| Balance Sheet | unified live post-swap | New screen — **unified main loader** | New screen |
| Profit & Loss | unified live post-swap | New screen — **unified main loader** | New screen |
| Party Ledger / Roznamcha | unified live | Extend PartyLedgerReport | contact_ledger |

**Primary implementation target:** `erp-mobile-app/` (same Supabase contract as web).

## 2. Data source policy

- Mobile **must match production web** after feature flags.
- BS/P&L: when `unified_ledger_loader_balance_sheet` / `unified_ledger_loader_profit_loss` are ON (as on web for pilot trio), mobile calls the **same unified RPC / service path** as `bsPlUnifiedMainService.ts` on web.
- **Fallback:** when flags OFF or kill switch active, use legacy loaders — show subtle “legacy” indicator for support.
- **Do not** add new feature flags or migrations for mobile-only paths.

## 3. Print / export / share parity

- PDF/print: extend `api/reports.ts` + existing `CompanyBrand` headers; native print via Capacitor where available (`docs/PWA_VS_NATIVE_LIMITS.md`).
- WhatsApp/share: reuse `useAccountingAttachmentActions` patterns.
- CSV/Excel: only where web already exports for that report.

## 4. Role / permission parity

| Role | Behavior |
|------|----------|
| Admin | Full reports + compare/preview if web exposes |
| Manager | Full operational + financial reports |
| Salesman | Restricted — hide balances / sensitive totals where web does |

Mirror web permission modules from `src/` when wiring navigation.

## 5. QA matrix

| Company | BS assets golden | P&L net golden | Salesman restricted |
|---------|------------------|----------------|---------------------|
| DIN CHINA | 89,754,087.52 | 8,465,730.87 | verify hidden fields |
| DIN BRIDAL | 13,521,792 | 119,992 | verify hidden fields |
| DIN COUTURE | 22,667,273 | -16,750 | verify hidden fields |

Compare mobile totals to web production with flags ON — zero-diff expectation for BS/P&L.

## 6. Test commands

```bash
# Capacitor mobile
cd erp-mobile-app
npm run build:mobile
npm test   # if configured

# Web regression (no production mutation)
cd ..
npm run test:unified-ledger
npm run test:unit

# Flutter (optional phase)
cd erp-flutter-app
flutter analyze
flutter test
```

## 7. Release gate

- **No APK build or Play Store release** without explicit operator approval.
- Version naming: follow `docs/MOBILE_RELEASE_PLAN.md` semver.
- Rollback: retain previous APK binary; document sideload rollback steps.

## 8. Known backlog (out of scope unless approved)

- Rental AR sub-ledger on mobile booking flow (`rental_booking_accounting.dart` parity)

## Exact next step

Use `NEXT_PROMPT_MOBILE_PARITY_IMPLEMENTATION.md` **only after operator approves** mobile implementation phase.
