# FINAL_REPORT — Mobile Single Core Alignment (2026-07-17)

## Verdict

**MOBILE_SINGLE_CORE_ALIGNMENT_PARTIAL**

Phase 1 baseline + architecture + legacy inventory completed and filed under this directory. Full report/write/permission/cache/parity/device gates are **not** complete. No unauthorized migration or financial-data mutation occurred.

## 1. Branch / HEAD

- Branch: `main`  
- HEAD: `812c2871851e78daf2b8ef04fe401feac8ce7ecf` (= origin/main)  
- Working tree: dirty (local mobile ledger WIP + artifacts)

## 2. Mobile application identified

**Production-relevant:** Capacitor + Vite React app in `erp-mobile-app/` (`com.dincouture.erp`, Din Collection 1.0.5).  
Not production: `POS/` Expo starter; `erp-flutter-app` / `erp-flutter-v2` not the shipped Din Collection path.

## 3. Single Core coverage completed (this slice)

- Inventory of loaders vs `get_unified_*` contracts  
- Mapping of flags/kill switch  
- Write-path RPC inventory (read-only)  
- Cache/root-cause notes for empty-ledger class bugs  

## 4. Legacy loaders removed or disabled

**None removed** (explicitly forbidden until parity + permission). Local WIP may soften empty-party short-circuit with JE fallback + notices — **uncommitted**, not production-disabled legacy.

## 5. Remaining legacy paths (why)

| Path | Why still present |
|------|-------------------|
| Roznamcha / DayBook | Unified cash/bank not wired despite flags |
| PartyLedgerReport | `rpcGetUnifiedPartyLedger` unused |
| Aging | Operational due_amount by design today |
| `getAccountLedgerLines` | Fallback / flag-off path |
| Cash Flow silent fallthrough | Catch → roznamcha |

## 6–10. Parity / writes / GL root cause / role / cache

See companion docs. **GL empty root cause class:** dual list/detail sources + empty party RPC short-circuit + transient Kong 502 + FY vs life-to-date — not a separate mobile posting engine inventing balances.

## 11–14. Tests / builds / emulator / device

Not executed this session. Physical device: **blocker = not run**.

## 15–16. Production changes / mutations

- **Production DB/GL:** none  
- **Migrations:** none  
- **4100 reclass:** none  
- **Commits/push:** none for this program slice  

## 17. Evidence directory

`reports/mobile-single-core-alignment-20260717/`

## 18–19. Commits / PR

None. Do not push dirty main.

## 20. Rollback

See `ROLLBACK.md`.

## 21. Remaining tasks

### Code remaining
- Wire Party Ledger → `get_unified_party_ledger` behind flags  
- Wire Roznamcha → unified cash/bank behind flags  
- Central `singleCore` adapter; fail loud on missing GL  
- Remove silent zero/fallback without notices  
- Admin basis/loader badges on all statement screens  
- Idempotent write guards  

### QA remaining
- Full web↔mobile parity matrix (read-only on prod)  
- Unified-ledger + mobile static analysis  

### Device-gated
- Emulator + authorized physical Android/iOS evidence  

### Approval-gated
- Any production write/void test data  
- DB migrations  
- `APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2` (not requested)  
- R8-R2 deletion (forbidden here)  

### Play Store / release-gated
- Signed release APK/IPA + store submission  

## Related local WIP (not claimed as alignment PASS)

Uncommitted fixes for Account/Supplier empty detail (journal list balances, empty-success JE fallback, All-time default, attachment button nesting) — review/commit separately when requested.
