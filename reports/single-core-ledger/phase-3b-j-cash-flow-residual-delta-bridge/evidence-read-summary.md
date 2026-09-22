# Evidence read summary — Phase 3B-J

**Generated:** 2026-06-29  
**Sources:** Phase 3B-I aligned capture, Phase 3B-F row-keyed diff reports, Phase 3B-G/H finance decisions

## Approved preview rules (recorded)

| Rule | Selection | Meaning |
|------|-----------|---------|
| Q4 | A | Opening balance rows summary-only — not period cash-in |
| Q5 | C | Internal transfers excluded from normal totals |
| Q7 | B | Preview aligned to approved rules; legacy official unchanged |

Reviewer: Nadeem Khan @ 2026-06-29. Loader swap **NOT APPROVED**.

## Phase 3B-I aligned candidate totals

| Company | Legacy closing | Aligned preview closing | Closing Δ | Compare |
|---------|----------------|-------------------------|-----------|---------|
| DIN CHINA | PKR 37,134,386 | PKR -32,503,237 | PKR 69,637,623 | NON-ZERO-DIFF |
| DIN BRIDAL | PKR 918,570 | PKR 60,720 | PKR 857,850 | NON-ZERO-DIFF |
| DIN COUTURE | PKR 50,500 | PKR 50,500 | PKR 0 | ZERO-DIFF |

## Pre-alignment vs post-alignment (context)

| Company | 3B-F closing Δ (pre-alignment) | 3B-I closing Δ (post Q4/Q5) | Direction |
|---------|----------------------------------|-----------------------------|-----------|
| DIN CHINA | PKR 45,675,273 | PKR 69,637,623 | Larger — Q5=C removes transfer legs from preview cash-in |
| DIN BRIDAL | PKR -55,000 | PKR 857,850 | Larger — Q4=A removes opening rows from preview period cash-in |

## Key finding

After applying approved finance rules, DIN CHINA and DIN BRIDAL **still differ from legacy by design**. The aligned preview implements Q4=A and Q5=C correctly; legacy `getCashFlowReport` continues to present transfers and opening rows differently. Residual delta is **finance-basis divergence**, not an unexplained post-alignment regression.
