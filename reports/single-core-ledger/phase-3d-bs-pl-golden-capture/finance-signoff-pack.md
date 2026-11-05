# Finance sign-off pack — Phase 3D BS/P&L candidate goldens

**Run:** PHASE 3D-SIGNOFF  
**Finance status:** `PENDING`  
**Generated:** 2026-06-29T12:00:00.000Z  
**Source capture:** `edcd075c` — [`phase-3d-bs-pl-golden-capture/`](.)

> **This document is NOT a loader swap approval.** It prepares finance review only. Legacy BS/P&L remain authoritative until explicit finance approval and a separate loader-swap phase.

---

## Scope

| Item | Value |
|------|-------|
| Companies | DIN CHINA · DIN BRIDAL · DIN COUTURE |
| Reports | Balance Sheet · Profit & Loss |
| Production URL | https://erp.dincouture.pk |
| Capture method | Phase 3A preview-only compare (legacy main vs unified TB preview) |
| Basis | `official_gl` |
| Branch scope | All branches |
| Total captures | 6/6 — all ZERO-DIFF |
| Value marking | **CANDIDATE_ONLY — NOT FINANCE APPROVED** |

---

## Candidate values by company / report

### DIN CHINA — Balance Sheet

| Field | Value |
|-------|-------|
| As-of | 2026-06-29 |
| Total Assets | PKR 89,754,088.52 |
| Liabilities + Equity | PKR 89,754,088.52 |
| A − (L+E) | 0 |
| Compare | ZERO-DIFF |

### DIN CHINA — Profit & Loss

| Field | Value |
|-------|-------|
| Period | 2000-01-01 → 2026-06-29 |
| Revenue | PKR 49,040,015.00 |
| COGS | PKR 39,299,479.13 |
| Net Profit | PKR 8,465,731.87 |
| Compare | ZERO-DIFF |

### DIN BRIDAL — Balance Sheet

| Field | Value |
|-------|-------|
| As-of | 2026-06-29 |
| Total Assets | PKR 13,521,792.00 |
| Liabilities + Equity | PKR 13,521,792.00 |
| A − (L+E) | 0 |
| Compare | ZERO-DIFF |

### DIN BRIDAL — Profit & Loss

| Field | Value |
|-------|-------|
| Period | 2000-01-01 → 2026-06-29 |
| Revenue | PKR 354,500.00 |
| COGS | PKR 49,028.00 |
| Net Profit | PKR 119,992.00 |
| Compare | ZERO-DIFF |

### DIN COUTURE — Balance Sheet

| Field | Value |
|-------|-------|
| As-of | 2026-06-29 |
| Total Assets | PKR 22,667,273.00 |
| Liabilities + Equity | PKR 22,667,273.00 |
| A − (L+E) | 0 |
| Compare | ZERO-DIFF |

### DIN COUTURE — Profit & Loss

| Field | Value |
|-------|-------|
| Period | 2000-01-01 → 2026-06-29 |
| Revenue | PKR 26,250.00 |
| COGS | PKR 35,000.00 |
| Net Profit | PKR -16,750.00 |
| Compare | ZERO-DIFF |

---

## Zero-diff summary

All six preview compares passed within tolerance. Legacy section totals match unified preview section totals for every company and report. See [`diff-analysis.md`](diff-analysis.md).

---

## Evidence pointers

| Type | Location |
|------|----------|
| Screenshots | [`screenshots/`](screenshots/) — 6 PNG files |
| JSON exports | [`exports/`](exports/) — 6 compare JSON files |
| BS goldens | [`balance-sheet-candidate-goldens.md`](balance-sheet-candidate-goldens.md) |
| P&L goldens | [`profit-loss-candidate-goldens.md`](profit-loss-candidate-goldens.md) |
| Capture matrix | [`capture-matrix.md`](capture-matrix.md) |
| Post-capture monitoring | [`post-capture-monitoring.md`](post-capture-monitoring.md) |

---

## Rule confirmations needed

### Balance Sheet (all companies)

**NEEDS_ACCOUNTING_RULE_CONFIRMATION** — Net income is folded into equity per legacy BS-FIX / PF-04 rules. Finance must confirm this treatment is acceptable before any BS loader swap.

### Profit & Loss (all companies)

**NEEDS_RULE_CONFIRMATION** — COGS split uses `COST_OF_PRODUCTION_CODES` + account-type heuristics (mirrors legacy). Finance must confirm COGS mapping is acceptable before any P&L loader swap.

---

## Approval checklist

Finance reviewer — check each item when approving:

- [ ] I reviewed BS candidate values for **DIN CHINA**
- [ ] I reviewed BS candidate values for **DIN BRIDAL**
- [ ] I reviewed BS candidate values for **DIN COUTURE**
- [ ] I reviewed P&L candidate values for **DIN CHINA**
- [ ] I reviewed P&L candidate values for **DIN BRIDAL**
- [ ] I reviewed P&L candidate values for **DIN COUTURE**
- [ ] I understand values are generated from **preview-only compare** (not yet production main)
- [ ] I confirm **zero-diff** status for all six captures
- [ ] I confirm/accept **net income folded into equity** rule for Balance Sheet
- [ ] I confirm/accept **COGS heuristic** for Profit & Loss
- [ ] I approve these as **finance goldens for future BS/P&L loader-swap planning only**

**Reviewer name:** ___________________________  
**Review date:** ___________________________  
**Finance status:** `PENDING` (change to APPROVED only with explicit operator/finance approval text)

---

## Rejection checklist

Use if finance cannot approve:

- [ ] Values do not match signed workbook / management accounts
- [ ] Date/period scope is wrong (as-of or YTD window)
- [ ] Branch scope is wrong (need single-branch matrix)
- [ ] BS equity rollup rule not accepted
- [ ] P&L COGS mapping not accepted
- [ ] Need additional captures (different period, basis, or company)
- [ ] Other: ___________________________

**Rejection notes:** ___________________________

---

## Notes

_Space for finance/operator comments during review._

---

## Explicit limitations

- **NOT** a loader swap approval
- **NOT** production adoption of unified BS/P&L totals
- **NOT** approval to create `unified_ledger_loader_balance_sheet` or `unified_ledger_loader_profit_loss` flags
- R7 / R8 / next company remain **BLOCKED**
- No migrations, flags, GL mutations, or runtime behavior changes in this phase
