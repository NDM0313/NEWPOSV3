# Evidence read summary — Phase 3B-E

**Read:** Phase 3B-D candidate goldens, diff analysis, finance review pack, Phase 3B implementation map, parity contract.

## Phase 3B-D summary totals (unchanged)

| Company | Zero-diff | Closing Δ | Row Δ | Finance |
|---------|-----------|-----------|-------|---------|
| DIN CHINA | NO | PKR 45,675,273 | 323 vs 405 | NEEDS_RULE_CONFIRMATION |
| DIN BRIDAL | NO | PKR -55,000 | 51 vs 53 | NEEDS_RULE_CONFIRMATION |
| DIN COUTURE | YES | 0 | 6 vs 6 | PENDING |

## Implementation paths

- **Legacy (authoritative):** `cashFlowReportService.getCashFlowReport` → `roznamchaService.getRoznamcha`
- **Preview (diagnostic):** `cashFlowUnifiedPreviewService` → `get_unified_cash_bank_ledger` (effective_party) → `cashFlowUnifiedPreviewMapper`
- Cash Flow screen does **not** use unified Roznamcha main loader.

## Investigation scope

Explain non-zero deltas for DIN CHINA and DIN BRIDAL via source-rule map + row-bucket analysis. No runtime changes in Phase 3B-E.
