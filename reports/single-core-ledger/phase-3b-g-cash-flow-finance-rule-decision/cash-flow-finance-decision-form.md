# Cash Flow finance decision form — Phase 3B-G

**Status:** PENDING — awaiting explicit finance/operator written decisions  
**Loader swap:** NOT APPROVED (default for all questions)  
**Official Cash Flow:** Legacy roznamcha path (unchanged until finance approves otherwise)

> **Instructions:** Finance/operator selects one option per question, records reviewer name and date, and sets status. Do **not** mark APPROVED without explicit written sign-off.

---

## Q4 — Opening balance rows

**Context:** DIN BRIDAL Jun 2026 rows — legacy shows 1 cash-in row (PKR 25,000) preview does not; preview shows 3 rows preview does not match legacy.

| Option | Description |
|--------|-------------|
| **A** | Opening balance rows appear only in summary/opening, not as period cash-in rows |
| **B** | Opening balance rows appear as cash-in rows in unified Cash Flow |
| **C** | Company-specific handling required |

| Field | Value |
|-------|-------|
| **Selected option** | _PENDING_ |
| **Status** | PENDING |
| **Reviewer** | — |
| **Review date** | — |
| **Notes** | — |
| **Loader swap approved** | false |

---

## Q5 — Internal transfers

**Context:** DIN CHINA — 80 transfer-leg rows, net impact PKR -56,889,891; primary driver of closing Δ PKR 45,675,273.

| Option | Description |
|--------|-------------|
| **A** | Show gross both legs (cash in + cash out for each transfer) |
| **B** | Net internal transfers (single net movement per transfer) |
| **C** | Exclude internal transfers from normal Cash Flow; show in audit/detail only |
| **D** | Keep legacy transfer presentation (current official behavior) |

| Field | Value |
|-------|-------|
| **Selected option** | _PENDING_ |
| **Status** | PENDING |
| **Reviewer** | — |
| **Review date** | — |
| **Notes** | — |
| **Loader swap approved** | false |

---

## Q7 — Treatment of current deltas

**Context:** DIN CHINA closing Δ PKR 45,675,273 · DIN BRIDAL closing Δ PKR -55,000 · DIN COUTURE zero-diff at summary.

| Option | Description |
|--------|-------------|
| **A** | Accept as rule differences; keep legacy official |
| **B** | Align preview to legacy (future Phase 3B-H) |
| **C** | Align legacy to unified basis in future controlled phase |
| **D** | Need more finance review — continue diagnostic mode only |

| Field | Value |
|-------|-------|
| **Selected option** | _PENDING_ |
| **Status** | PENDING |
| **Reviewer** | — |
| **Review date** | — |
| **Notes** | — |
| **Loader swap approved** | false |

---

## Related questions (unchanged — see Phase 3B-E pack)

| # | Question | Status |
|---|----------|--------|
| Q1 | Legacy `getCashFlowReport` remains official? | PENDING (recommended YES) |
| Q2 | Unified effective_party basis? | PENDING |
| Q3 | Void/reversal audit-only? | PENDING |
| Q6 | Source modules in normal Cash Flow? | PENDING |

**Evidence:** [`din-china-finance-summary.md`](din-china-finance-summary.md) · [`din-bridal-finance-summary.md`](din-bridal-finance-summary.md) · [`decision-outcome-matrix.md`](decision-outcome-matrix.md)
