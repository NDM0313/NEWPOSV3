# Phase 2.15 — Loader inventory

| Role | Path | Notes |
|------|------|-------|
| Legacy main | `roznamchaLegacyMainService.ts` → `getRoznamcha` | Payment + rental + journal-only composite |
| Unified main (2.15) | `roznamchaUnifiedParityAssembler.ts` → `getRoznamcha` + unified RPC metadata | Parity engine — not raw RPC mapper |
| Unified preview | `roznamchaUnifiedPreviewService.ts` → raw `getUnifiedCashBankLedger` | Shadow compare only |
| Legacy shadow | `roznamchaLegacyShadowPreviewService.ts` | Candidate QA compare |
| Parity filter | `roznamchaUnifiedParityFilter.ts` | Document/payment_id exclusion rules |
| Compare mappers | `roznamchaCashBankCompareMappers.ts` | Admin compare economic keys |
| RPC | `get_unified_cash_bank_ledger` | Official GL liquidity lines — not roznamcha-native |
| Page | `RoznamchaReport.tsx` | Loader resolver wiring |
