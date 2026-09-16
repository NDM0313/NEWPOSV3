# Fix recommendation — Phase 3B-E

**Recommended:** **D + E** — deeper row export tooling first, then finance approval before any rule change.

| Option | Description | Deploy? |
|--------|-------------|---------|
| **A** | Keep legacy official; preview diagnostic only | No |
| **B** | Adjust preview to match legacy | Yes (frontend) — **after finance** |
| **C** | Adjust legacy to unified basis | **Blocked** (loader swap) |
| **D** | Add journal-line-keyed row export / diff tooling | Optional frontend |
| **E** | Finance approval required | **Required gate** |

## Safest next action

1. Finance answers Q1–Q7 in [`finance-rule-confirmation-pack.md`](finance-rule-confirmation-pack.md)
2. Operator chooses: keep legacy official (A) or approve separate preview-alignment fix (B) **only after E**
3. Continue `npm run monitor:three-company-unified-ledger`

## Future fix phase (if approved)

**Likely files:** `cashFlowUnifiedPreviewMapper.ts`, transfer-leg normalization, export payload in `CashFlowUnifiedPreviewPanel.tsx`  
**Tests:** `cashFlowUnifiedPreviewMapper.test.ts`, Phase 3B-D re-capture  
**Rollback:** Revert frontend-only deploy  
**Stop:** No loader swap, no flag changes, no GL mutations

## Stop conditions

- Legacy Cash Flow remains default without explicit approval
- Preview totals stay CANDIDATE_ONLY
- Cash Flow loader flags remain off
