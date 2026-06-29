# Finance rule confirmation pack — Phase 3B-E

**Default status:** Q4/Q5/Q7 recorded for preview alignment @ 2026-06-29 (Nadeem Khan). Q1–Q3/Q6 remain PENDING.  
**Loader swap:** NOT APPROVED  
**BS/P&L finance:** PENDING

| # | Question | Status | Notes |
|---|----------|--------|-------|
| Q1 | Should Cash Flow follow legacy `getCashFlowReport` exactly? | PENDING | Recommended: **YES** (official) |
| Q2 | Should Cash Flow follow unified effective_party basis? | PENDING | Not without finance sign-off |
| Q3 | Void/reversal hidden in normal, audit only? | PENDING | Matches visibility contract |
| Q4 | Opening balance from prior activity vs period rows only? | APPROVED (A) | Nadeem Khan @ 2026-06-29 — preview alignment only |
| Q5 | Internal transfers gross, net, or excluded? | APPROVED (C) | Nadeem Khan @ 2026-06-29 — excluded from normal preview |
| Q6 | Which source modules in normal Cash Flow? | PENDING | Current: all |
| Q7 | Accept DIN CHINA/BRIDAL deltas or fix? | APPROVED_FOR_PREVIEW_ALIGNMENT_ONLY (B) | Phase 3B-H implemented; legacy official |

## Company deltas (candidate only)

| Company | Closing Δ | Finance status |
|---------|-----------|----------------|
| DIN CHINA | PKR 45,675,273 | NEEDS_RULE_CONFIRMATION |
| DIN BRIDAL | PKR -55,000 | NEEDS_RULE_CONFIRMATION |
| DIN COUTURE | 0 | PENDING |

## Phase 3B-F tooling (diagnostic-only) — production evidence @ 2026-06-29

Phase 3B-F deployed to production @ `5433ac2c`. Row-keyed exports captured for DIN CHINA and DIN BRIDAL. **Diagnostic-only** — no official totals changed. Loader swap **BLOCKED**.

### DIN CHINA bucket evidence (closing Δ PKR 45,675,273)

| Bucket | Rows | Net impact | Question |
|--------|------|------------|----------|
| Transfer leg | 80 | PKR -56,889,891 | **Q5** |
| Legacy-only | 223 | PKR -42,779,869 | Q7 |
| Preview-only | 305 | PKR -88,455,142 | Q7 |
| Row matches | exact 89 · weak 11 | — | — |

**Finance action:** Confirm Q5 — should internal transfers be gross (both legs), net, or excluded in official Cash Flow?

### DIN BRIDAL bucket evidence (closing Δ PKR -55,000)

| Bucket | Rows | Net impact | Question |
|--------|------|------------|----------|
| Legacy-only | 1 | PKR 25,000 | Q4/Q7 |
| Preview-only | 3 | PKR 80,000 | Q4/Q7 |
| Row matches | exact 2 · strong 48 | — | — |

**Finance action:** Confirm Q4 — `opening_balance_account` / JE mapping treatment for Jun 2026 rows.

Evidence: [`production-row-export-capture.md`](../phase-3b-f-cash-flow-row-export/production-row-export-capture.md) · [`diff-reports/`](../phase-3b-f-cash-flow-row-export/diff-reports/)

## Phase 3B-G finance rule decision pack @ 2026-06-29

**Status:** PREPARED — all decisions **PENDING** until explicit finance/operator written approval.

Finance-readable decision form with options for **Q4**, **Q5**, **Q7**:

- [`cash-flow-finance-decision-form.md`](../phase-3b-g-cash-flow-finance-rule-decision/cash-flow-finance-decision-form.md)
- Company summaries: DIN CHINA · DIN BRIDAL · DIN COUTURE
- Outcome matrix: maps choices to future Phase 3B-H or keep-legacy paths

**Cash Flow loader swap remains BLOCKED.** Do not mark APPROVED without reviewer + date on decision form.

BS/P&L finance remains **PENDING**. R7/R8/next company remain blocked.

## Phase 3B-H preview alignment @ 2026-06-29

Finance decisions Q4=A, Q5=C, Q7=B recorded for **preview alignment only**. Phase 3B-H implemented in code. Legacy official unchanged. Loader swap **NOT APPROVED**. Re-capture required after deploy — [`phase-3b-h-cash-flow-preview-alignment/`](../phase-3b-h-cash-flow-preview-alignment/)
