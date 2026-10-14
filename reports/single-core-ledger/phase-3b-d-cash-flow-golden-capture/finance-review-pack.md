# Finance review pack — Phase 3B-D Cash Flow

**Default finance status:** PENDING  
**Loader swap:** NOT APPROVED  
**BS/P&L finance:** PENDING (unchanged)

| Company | Report | Candidate values | Finance status | Reviewer | Review date | Notes |
|---------|--------|------------------|----------------|----------|-------------|-------|
| DIN CHINA | Cash Flow | Legacy closing PKR 37,134,386.00 · Preview closing PKR -8,540,887.00 · Δ closing PKR 45,675,273.00 | NEEDS_RULE_CONFIRMATION | — | — | CANDIDATE_ONLY — non-zero diff; investigate legacy vs unified mapping before approval |
| DIN BRIDAL | Cash Flow | Legacy closing PKR 918,570.00 · Preview closing PKR 973,570.00 · Δ closing PKR -55,000.00 | NEEDS_RULE_CONFIRMATION | — | — | CANDIDATE_ONLY — non-zero diff; investigate legacy vs unified mapping before approval |
| DIN COUTURE | Cash Flow | Legacy closing PKR 50,500.00 · Preview closing PKR 50,500.00 · Δ closing PKR 0.00 | PENDING | — | — | CANDIDATE_ONLY — summary totals match; finance approval still required before loader swap |

**Phase 3B-E follow-up:** [`finance-rule-confirmation-pack.md`](../phase-3b-e-cash-flow-delta-investigation/finance-rule-confirmation-pack.md) — delta root causes documented; DIN CHINA transfer-leg treatment + DIN BRIDAL opening_balance_account rows.

**Phase 3B-F tooling:** [`phase-3b-f-cash-flow-row-export/`](../phase-3b-f-cash-flow-row-export/) — row-keyed export deployed @ `5433ac2c`; diagnostic-only; row exports captured.

**Phase 3B-G decision pack:** [`phase-3b-g-cash-flow-finance-rule-decision/`](../phase-3b-g-cash-flow-finance-rule-decision/) — Q4=A, Q5=C, Q7=B recorded @ 2026-06-29.

**Phase 3B-H preview alignment:** [`phase-3b-h-cash-flow-preview-alignment/`](../phase-3b-h-cash-flow-preview-alignment/) — **deployed** @ `d2401b1f`; preview-only; loader swap NOT APPROVED.

**Phase 3B-I aligned candidate golden capture:** [`phase-3b-i-cash-flow-aligned-golden-capture/`](../phase-3b-i-cash-flow-aligned-golden-capture/) — **complete**; candidate-only; DIN COUTURE zero-diff · DIN CHINA/DIN BRIDAL non-zero-diff.
