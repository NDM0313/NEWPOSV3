# Docs / UX update — TB imbalance diagnosis

**Date:** 2026-07-20

## Product UX (Phase 4)

| Change | File |
|--------|------|
| Tie-out `tb-imbalance` drills to Integrity Lab Live TB tab | `financialTruthTieOut.ts`, `FinancialTraceCenterPage.tsx` |
| TB difference MetricCard → “Open Live TB repair” when warn | `FinancialTraceCenterPage.tsx` |
| Integrity Lab tab **H · Live TB repair** mounts Phase 8 panel | `AccountingIntegrityLabPage.tsx` |
| Σ JE diffs vs TB difference + full unbalanced JE table + copy | `AccountingIntegrityTestLab.tsx` |
| In-UI note: sync balances ≠ TB fix | `AccountingIntegrityTestLab.tsx` |

## Production data fix (Phase 3)

See `phase3-apply-verify.md` — JE-0222 + JE-0247 corrected; DIN BRIDAL TB difference **0**.
