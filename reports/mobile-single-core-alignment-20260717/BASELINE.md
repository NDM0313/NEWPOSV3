# BASELINE — Mobile Single Core Alignment

**Date:** 2026-07-17  
**Production URL:** https://erp.dincouture.pk  
**Repo:** NEWPOSV3 (OLD ERP / DIN Collection ERP — not FX app)  
**Scope gate:** Phase 1 inventory only for this delivery slice. No production GL mutation. No 4100→4000 reclass (approval phrase not provided). No R8-R2 deletion.

## Git

| Item | Value |
|------|--------|
| Branch | `main` |
| Local HEAD | `812c2871851e78daf2b8ef04fe401feac8ce7ecf` |
| origin/main HEAD | `812c2871851e78daf2b8ef04fe401feac8ce7ecf` |
| Tip message | `docs(accounting): close out R8-R2 production deletion execution` |
| Working tree | **Dirty** — uncommitted mobile ledger empty-state / fallback WIP + graphify + releases artifacts |

## Production-relevant mobile client

| Client | Path | Framework | Production-relevant? |
|--------|------|-----------|----------------------|
| **Din Collection Capacitor** | [`erp-mobile-app/`](../../erp-mobile-app/) | Capacitor + Vite + React | **YES — sole production mobile ERP** |
| Expo POS shell | [`POS/`](../../POS/) | Expo starter tabs | No (no Supabase business code) |
| Flutter Phase 1 | [`erp-flutter-app/`](../../erp-flutter-app/) | Flutter | Not production APK/IPA path for Din Collection today |
| Flutter v2 | [`erp-flutter-v2/`](../../erp-flutter-v2/) | Flutter greenfield | Not production |

**App identity:** `com.dincouture.erp` / “Din Collection”  
**Version:** `1.0.5` (`versionCode` 39)  
**Android:** minSdk 24, compile/targetSdk 36  
**Auth:** Supabase Auth (same project as web); Vite proxy → `supabase.dincouture.pk` in dev; native uses baked production URL pattern (see `docs/infra/MOBILE_APK_LOCKED_PATTERN.md`)  
**Company/branch:** `PermissionContext` + branch access RPC; app branch filter passed into reports

## Build commands (erp-mobile-app)

```bash
npm run dev                          # http://localhost:5174
npm run build:mobile:prod
npm run cap:sync:android:prod
npm run android:apk:release:mac      # or :win
npm run cap:sync:ios:prod
npm run ios:ipa:release:mac
```

## Feature flags / kill switch (mobile mirrors web keys)

Defined in [`erp-mobile-app/src/lib/unifiedLedgerFlagKeys.ts`](../../erp-mobile-app/src/lib/unifiedLedgerFlagKeys.ts):

- Engine: `unified_ledger_engine`
- Kill: `unified_ledger_kill_switch` (+ env `VITE_UNIFIED_LEDGER_ENGINE_KILLED`)
- Per-screen loader + screen flags for ledger_v2, account_statement, trial_balance, party_ledger, roznamcha, cash_flow, balance_sheet, profit_loss

## Tests baseline

- Vitest/unit scripts: **not configured** in `erp-mobile-app/package.json` (`test scripts []`)
- Scattered `*.test.ts` files exist (~18) but no standard `npm test` gate for mobile package
- Shared web unified-ledger tests live at repo root (`npm run test:unified-ledger`) — not re-run in this Phase 1 slice

## Sales revenue codes (policy)

- Canonical future/native: **4000** ([`canonicalSalesRevenueAccount.ts`](../../erp-mobile-app/src/lib/canonicalSalesRevenueAccount.ts))
- Historical DIN CHINA import: **4100** — preserve; no reclass without `APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2`

## Explicit non-actions this session

- No DB migrations applied
- No production financial row mutations
- No 4100 reclassification journals
- No R8-R2 legacy deletion
- No push to main
- No Play Store / signing actions
