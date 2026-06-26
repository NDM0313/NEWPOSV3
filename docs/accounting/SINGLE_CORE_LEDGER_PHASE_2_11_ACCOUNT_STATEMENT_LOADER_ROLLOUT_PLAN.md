# Phase 2.11 — Account Statement Loader Rollout Plan

**Status:** `PHASE 2.11 ACCOUNT STATEMENT LOADER PASS WITH WAIVERS — monitor before expansion`

**Prerequisite:** Phase 2.10G Ledger V2 unified main loader live @ 2026-06-26

## Scope

| Item | Value |
|------|-------|
| Company | DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`) |
| Screen | Account Statement (Advanced tab / `AccountLedgerReportPage`) only |
| New loader flag | `unified_ledger_loader_account_statement` |
| Screen flag | `unified_ledger_screen_account_statement` |
| Golden fixture | MR JALIL closing PKR 216,300 |

## Implementation summary

- `resolveAccountStatementMainLoaderSource` — kill switch → loader OFF → engine OFF → screen OFF → unified
- `resolveAccountStatementPreviewCompareSource` — legacy main → unified_compare; unified main → legacy_shadow
- Services: `accountStatementLegacyMainService`, `accountStatementUnifiedMainService`, `accountStatementLegacyShadowPreviewService`
- QA attributes: `data-account-statement-main-loader`, `data-account-statement-preview-compare-source`
- Tests: 172/172 unified-ledger suite PASS (17 new Account Statement loader tests)
- No migrations; no GL mutation

## Rollback ladder

| Level | Action |
|-------|--------|
| L1 | `unified_ledger_loader_account_statement = false` |
| L2 | `unified_ledger_screen_account_statement = false` |
| L3 | `unified_ledger_engine = false` |
| L4 | kill switch |

## Production loader ON (2026-06-26)

| Flag | State |
|------|-------|
| `unified_ledger_loader_account_statement` | **ON** @ 14:59:46Z |
| `unified_ledger_screen_account_statement` | **ON** @ 14:59:46Z |
| `unified_ledger_loader_ledger_v2` | ON (unchanged) |
| All other screen flags | OFF/absent |

**Build label:** `phase-211-prod`  
**Target:** https://erp.dincouture.pk

**QA:** Production candidate PASS — unified main, legacy_shadow preview, MR JALIL 216,300, Ledger V2 unaffected  
**Soak:** Accelerated waiver — 3 checkpoints PASS  
**Rollback:** Not executed

**Waivers:** Staff credentials unavailable; accelerated soak vs full 2h wall-clock

**Blocked:** Trial Balance, Roznamcha, Party Ledger, Cash/Bank, other companies

## Evidence

`reports/single-core-ledger/phase-2-11-account-statement-loader/`
