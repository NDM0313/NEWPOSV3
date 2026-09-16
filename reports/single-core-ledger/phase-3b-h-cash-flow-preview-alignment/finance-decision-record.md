# Finance decision record — Phase 3B-H

**Reviewer:** Nadeem Khan  
**Review date:** 2026-06-29  
**Scope:** Preview alignment only — **NOT** loader swap approval

| Decision | Selected | Status |
|----------|----------|--------|
| Q4 Opening balance | **A** — summary/opening only, not period cash-in | APPROVED |
| Q5 Internal transfers | **C** — excluded from normal; audit/detail only | APPROVED |
| Q7 Delta treatment | **B** — align preview to approved rules (Phase 3B-H) | APPROVED_FOR_PREVIEW_ALIGNMENT_ONLY |

| Gate | Value |
|------|-------|
| loader_swap_approved | **false** |
| official_cash_flow_behavior_changed | **false** |
| preview_alignment_phase_required | **true** (implemented in 3B-H) |

**Important:** These approvals authorize preview/diagnostic alignment only. Cash Flow loader swap remains **NOT APPROVED**. Legacy `getCashFlowReport` remains official.
