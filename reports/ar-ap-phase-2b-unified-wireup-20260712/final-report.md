# AR/AP Phase 2b unified wire-up — final report

**Date:** 2026-07-12
**Scope:** AR/AP Diagnostics party GL rollup only (OLD ERP)

## Summary

Party GL summary cards on AR/AP Diagnostics now use the Unified Core Ledger when Party Ledger loaders are ON. Legacy fallback remains for kill switch, loaders OFF, or missing RPC.

## Files changed

| Area | Path |
|------|------|
| Migration | `migrations/20260712120000_get_unified_contact_party_gl_balances.sql` |
| Service | `src/app/services/arApUnifiedPartyBalanceService.ts` |
| Parity helpers | `src/app/lib/arApPartyGlParity.ts` |
| Integrity lab | `src/app/services/arApReconciliationCenterService.ts` |
| UI | `ArApReconciliationCenterPage.tsx`, `PayablesVarianceExplainerPanel.tsx` |
| Parity script | `scripts/single-core-ledger/run-ar-ap-unified-party-parity-readonly.mjs` |

## Validation

| Check | Result |
|-------|--------|
| test:unified-ledger | **339/339 PASS** (+3 parity tests) |
| build | **PASS** |
| Party GL parity (production) | **SKIP_RPC_NOT_DEPLOYED** — migration not yet applied on VPS |

## Rollout note

Apply `20260712120000_get_unified_contact_party_gl_balances.sql` on production before unified path activates. Until then UI safely falls back to `get_contact_party_gl_balances`.

## Safety

- No GL mutations
- Exception queues unchanged
- Hybrid repair unchanged
- Contacts page unchanged (follow-up optional)
