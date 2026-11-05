# Diff analysis — Phase 3D BS/P&L candidate capture

**Status:** CANDIDATE_ONLY — NOT FINANCE APPROVED  
**Captured:** 2026-06-29T10:50:03.438Z  
**Overall:** All 6 captures **zero-diff** (compare pass within tolerance)

---

## Summary

| Company | Balance Sheet | Profit & Loss |
|---------|---------------|---------------|
| DIN CHINA | ZERO-DIFF | ZERO-DIFF |
| DIN BRIDAL | ZERO-DIFF | ZERO-DIFF |
| DIN COUTURE | ZERO-DIFF | ZERO-DIFF |

---

## DIN CHINA

### Balance Sheet (as at 2026-06-29)

- Legacy = Preview: Assets PKR 89,754,088.52; L+E PKR 89,754,088.52; A−(L+E) = 0
- Section deltas: Assets 0 · Liabilities 0 · Equity 0 · L+E 0
- **Rule confirmations:** Net income folded into equity (BS-FIX / PF-04) — NEEDS_ACCOUNTING_RULE_CONFIRMATION before loader swap

### Profit & Loss (2000-01-01 → 2026-06-29)

- Legacy = Preview: Revenue PKR 49,040,015.00 · Net PKR 8,465,731.87
- All section deltas: 0
- **Rule confirmations:** COGS heuristic mapping — NEEDS_RULE_CONFIRMATION before loader swap

---

## DIN BRIDAL

### Balance Sheet (as at 2026-06-29)

- Legacy = Preview: Assets PKR 13,521,792.00; L+E PKR 13,521,792.00; A−(L+E) = 0
- Section deltas: all 0
- **Rule confirmations:** Net income / equity rollup — NEEDS_ACCOUNTING_RULE_CONFIRMATION

### Profit & Loss (2000-01-01 → 2026-06-29)

- Legacy = Preview: Revenue PKR 354,500.00 · Net PKR 119,992.00
- All section deltas: 0
- **Rule confirmations:** COGS heuristic — NEEDS_RULE_CONFIRMATION

---

## DIN COUTURE

### Balance Sheet (as at 2026-06-29)

- Legacy = Preview: Assets PKR 22,667,273.00; L+E PKR 22,667,273.00; A−(L+E) = 0
- Section deltas: all 0
- **Rule confirmations:** Net income / equity rollup — NEEDS_ACCOUNTING_RULE_CONFIRMATION

### Profit & Loss (2000-01-01 → 2026-06-29)

- Legacy = Preview: Revenue PKR 26,250.00 · Net PKR -16,750.00
- All section deltas: 0
- **Rule confirmations:** COGS heuristic — NEEDS_RULE_CONFIRMATION

---

## Finance review readiness

- **Finance can review now:** YES — exports and screenshots available
- **Code/accounting rule change needed before approval:** NO (zero-diff at section totals; rule sign-off still required)
- **Loader swap approved:** NO
