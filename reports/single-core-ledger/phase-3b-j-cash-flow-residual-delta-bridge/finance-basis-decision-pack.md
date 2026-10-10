# Finance basis decision pack — Phase 3B-J

**Default selected option:** PENDING  
**Finance status:** PENDING  
**Loader swap approved:** false  
**Official legacy Cash Flow:** unchanged

> Operator must select **one option in writing** before Cash Flow finance sign-off or loader swap.

---

## Context

Phase 3B-I captured aligned preview totals under approved rules Q4=A, Q5=C, Q7=B (Nadeem Khan @ 2026-06-29). DIN CHINA and DIN BRIDAL remain **non-zero-diff vs legacy by design** — see [`residual-delta-bridge.md`](residual-delta-bridge.md). DIN COUTURE is **zero-diff**.

---

## Option A — Keep legacy official indefinitely

| Field | Value |
|-------|-------|
| Legacy Cash Flow | **Official** — unchanged |
| Aligned preview | Diagnostic / compare only |
| Loader swap | **No** |
| Adoption | Cash Flow unified loader **closed or deferred** |

**When to choose:** Business prefers current official roznamcha Cash Flow indefinitely; preview is tooling only.

---

## Option B — Approve aligned preview as finance basis candidate (no loader swap yet) **(Recommended)**

| Field | Value |
|-------|-------|
| Finance accepts | Q4=A, Q5=C basis |
| DIN CHINA / DIN BRIDAL deltas | Accepted as **expected rule differences** vs legacy |
| Legacy Cash Flow | Remains official until separate loader swap approval |
| Loader swap | **Still NOT APPROVED** — separate operator gate later |
| Next phase | Separate **Cash Flow finance sign-off pack** |

**When to choose:** Finance agrees aligned preview reflects intended accounting basis; legacy mismatch is acceptable during transition. DIN COUTURE zero-diff supports confidence.

**Recommendation rationale:** Preview rules already recorded; residual bridge shows deltas are intentional legacy-mismatch, not post-alignment bugs.

---

## Option C — Require more investigation / fix before sign-off

| Field | Value |
|-------|-------|
| Sign-off | **No** |
| Loader swap | **No** |

**Remaining questions if C selected:**

- Q1 — Legacy `getCashFlowReport` remains official long-term?
- Q2 — Unified `effective_party` basis scope
- Q6 — Source modules in normal Cash Flow
- DIN CHINA — Residual beyond Q5 transfer exclusion (dual-engine row sets)
- DIN BRIDAL — `opening_balance_account` / JE mapping confirmation

---

## Option D — Align legacy official to finance rules later

| Field | Value |
|-------|-------|
| Effect | **User-facing official Cash Flow behavior may change** |
| Plan required | Controlled behavior-change phase, rollback, finance sign-off |
| Loader swap | **No** immediate swap |
| Risk | Operators/users see different official totals |

---

## Decision record — **RECORDED** @ 2026-06-29

| Field | Value |
|-------|-------|
| **Selected option** | **B** |
| **Finance status** | APPROVED_FOR_SIGNOFF_PACK |
| **Reviewer** | Nadeem Khan |
| **Review date** | 2026-06-29 |
| **Loader swap approved** | false |
| **Official legacy changed** | false |
| **Written approval text** | Option B approved: aligned Cash Flow preview is accepted as finance basis candidate under Q4=A, Q5=C, Q7=B. DIN CHINA and DIN BRIDAL deltas are accepted as expected rule differences vs legacy. Official legacy Cash Flow remains unchanged. Cash Flow loader swap is NOT APPROVED. |

**Sign-off pack:** [`phase-3b-k-cash-flow-finance-signoff/`](../phase-3b-k-cash-flow-finance-signoff/)

---

## Company summary for decision

| Company | Closing Δ | Option B viable if deltas expected? |
|---------|-----------|--------------------------------------|
| DIN CHINA | PKR 69,637,623 | Yes — Q5=C transfer exclusion + engine differences |
| DIN BRIDAL | PKR 857,850 | Yes — Q4=A opening exclusion + JE mapping |
| DIN COUTURE | PKR 0 | Yes — zero-diff supports review |
