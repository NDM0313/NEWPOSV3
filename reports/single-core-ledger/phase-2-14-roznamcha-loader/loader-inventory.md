# Phase 2.14 — Roznamcha loader inventory

| Role | Service |
|------|---------|
| Legacy main | `roznamchaLegacyMainService.ts` → `getRoznamcha` |
| Unified main | `roznamchaUnifiedMainService.ts` → `getUnifiedCashBankLedger` |
| Unified preview | `roznamchaUnifiedPreviewService.ts` |
| Legacy shadow | `roznamchaLegacyShadowPreviewService.ts` |
| Mapper | `roznamchaUnifiedMainMapper.ts` |
| Page | `RoznamchaReport.tsx` |
| Panel | `RoznamchaUnifiedPreviewPanel.tsx` |

Print/Excel/PDF derive from active `data` summary and `filteredRows`.
