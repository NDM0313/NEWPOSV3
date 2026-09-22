# FINAL RESULT — Mobile Supplier Business GL Parity

**Verdict: `MOBILE_SUPPLIER_BUSINESS_GL_PARITY_READY_FOR_OWNER_REVIEW`**

**Date:** 2026-09-23

## Git

| Item | Value |
|------|-------|
| Starting main SHA | `a7ca57922ee2e960768208ee5e3e24a5eaaf2040` |
| Branch | `feat/mobile-supplier-business-gl-parity` |
| Branch tip | `a4b58298d9317bcf2c876acf0c3ea6278cf01fea` |
| Main merged | **NO** |

## Exact mobile files changed

**Added**

- `erp-mobile-app/src/lib/journalPartyAttribution.ts`
- `erp-mobile-app/src/api/partyAttributedGlLedger.ts`
- `erp-mobile-app/src/api/supplierBusinessGl.ts`
- `erp-mobile-app/src/api/supplierBusinessGl.test.ts`

**Modified**

- `erp-mobile-app/src/components/accounts/reports/PartyLedgerReport.tsx`
- `erp-mobile-app/src/components/accounts/reports/_shared/LedgerActivityListRow.tsx`
- `erp-mobile-app/src/api/reports.ts` (`glAccountCode` on `LedgerLine`)
- `erp-mobile-app/src/api/contacts.ts` (supplier Business overlay)
- `erp-mobile-app/src/api/accounts.ts` (`getAllSuppliersWithPayable` Business overlay)
- `erp-mobile-app/android/app/build.gradle` (versionCode/Name)

**Evidence**

- `reports/mobile-supplier-business-gl-parity-20260923/*`

## Readers before / after

| | List | Detail (default) |
|--|------|------------------|
| **Before** | `glApPayable` (Official AP) | `get_supplier_ap_gl_ledger_for_contact` |
| **After** | `loadSupplierBusinessGlBalancesMap` → `businessNet` | `loadSupplierBusinessHistory` |
| Official AP | Still available via detail toggle + preserved API | |

## ARIF golden

| Metric | Value |
|--------|------:|
| List balance (Business) | **39,937** payable |
| Business closing | **39,937** |
| Official AP | **0** |
| Business rows | **24** |
| Source Account | **210017** |

## Other cases

| Case | Result |
|------|--------|
| CLEAN_AP ALAM BNRS | Business = Official = **1,105,100** → **PASS** |
| ZERO-history ABC | Business **0** |
| Worker / courier exclusion | **PASS** (unit + role gate) |

## Other surfaces inspected

See `MOBILE_SUPPLIER_READ_PATH_AUDIT.md`. Account CoA ledger kept Official AP. Customer/worker unchanged.

## Tests / build

| Check | Result |
|-------|--------|
| `npx tsx --test` supplierBusinessGl + contactListBalance | **12 PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build:mobile` | **PASS** |
| Android `assembleDebug` | **FAIL** (needs `cap sync` plugins + Mac JDK; Windows `org.gradle.java.home` in gradle.properties) |
| APK generated | **NO** |
| Device tested | **NO** |
| Play Store published | **NO** |

## Version

| | Old | New |
|--|-----|-----|
| versionCode | 40 | **41** |
| versionName | 1.0.5 | **1.0.6** |

## Safety

| Check | Result |
|-------|--------|
| Database mutations | **0** |
| Migrations | **NONE** |
| JEs modified | **0** |
| account_ids modified | **0** |
| TB changed | **NO** |
| Balance Sheet changed | **NO** |
| Graphify touched | **NO** |
| JE fingerprint PRE == POST | **YES** (6538 / 13475 / diff 0 / unbalanced 0) |
