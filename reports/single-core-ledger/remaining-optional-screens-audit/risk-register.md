# Risk register — remaining optional screens

**Run:** PHASE 3  
**Generated:** 2026-06-29

---

| Risk ID | Title | Severity | Likelihood | Mitigation | Owner gate |
|---------|-------|----------|------------|------------|------------|
| R-OPT-01 | TB unified main ≠ BS/P&L legacy totals | **High** | Medium | Phase 3A preview compare; no main swap until golden PASS | Finance |
| R-OPT-02 | Cash Flow ≠ unified Roznamcha main | **High** | Medium | Preview compare; keep legacy main | Finance |
| R-OPT-03 | Premature loader flag enable | **Critical** | Low | No DB flag writes without runbook + L1 rollback | Ops + Finance |
| R-OPT-04 | Golden numbers invented without capture | **High** | Low | Mark NEEDS_GOLDEN_CAPTURE; this audit forbids invented totals | Finance |
| R-OPT-05 | Mobile shows different balances than web | **Medium** | High | Phase 3C test mapping; defer loader swap | Engineering |
| R-OPT-06 | COGS mapping changes net profit | **Medium** | Medium | Finance sign-off on mapping before P&L unified | Finance |
| R-OPT-07 | R7 payment RPC changes cash semantics | **Medium** | N/A until approved | BLOCKED_R7 — design only | Architecture |
| R-OPT-08 | R8 retires legacy before optional screens migrated | **High** | Low | BLOCKED_R8 until all loaders complete | Program |
| R-OPT-09 | Branch NULL rules differ legacy vs unified | **Medium** | Medium | Use `unifiedLedgerBranchFilter` in preview path | Engineering |
| R-OPT-10 | correction_reversal visible in BS legacy not in normal Roznamcha | **Medium** | Medium | Align via unified basis in preview | Engineering |

---

## Stop conditions (do not proceed to runtime)

1. Finance has not approved golden capture for the surface  
2. Preview compare fails for any of three companies  
3. Operator has not approved Phase 3A/3B/3C/3E explicitly  
4. R7/R8/next-company work mixed into optional screen PR  
5. Any migration or GL mutation required without approved migration file

---

## Residual risk after this audit

**Low** — audit/docs only; no production behavior changed. Residual **operational** risk remains that operators may assume BS/P&L match unified TB without reading this register.
