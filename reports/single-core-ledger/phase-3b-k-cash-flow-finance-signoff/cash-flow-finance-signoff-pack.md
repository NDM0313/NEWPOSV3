# Cash Flow finance sign-off pack — Phase 3B-K

**Sign-off type:** Aligned preview as **finance basis candidate only**  
**Reviewer:** Nadeem Khan  
**Review date:** 2026-06-29  
**Selected basis option:** **B**  
**Loader swap approved:** false  
**Official legacy Cash Flow changed:** false

> **Important:** This sign-off approves aligned preview as finance basis candidate only. It does **not** approve loader swap. It does **not** change official legacy Cash Flow. It does **not** approve BS/P&L. It does **not** approve R7/R8/next company.

---

## Basis approval text

Option B approved: aligned Cash Flow preview is accepted as finance basis candidate under Q4=A, Q5=C, Q7=B. DIN CHINA and DIN BRIDAL deltas are accepted as expected rule differences vs legacy. Official legacy Cash Flow remains unchanged. Cash Flow loader swap is NOT APPROVED.

## Approved preview rules

| Rule | Selection | Meaning |
|------|-----------|---------|
| Q4 | A | Opening balance rows summary-only — not period cash-in |
| Q5 | C | Internal transfers excluded from normal totals |
| Q7 | B | Preview aligned to approved finance rules |

---

## Company sign-off

### DIN CHINA — APPROVED_AS_ALIGNED_BASIS_CANDIDATE

| Field | Value |
|-------|-------|
| Legacy closing | PKR 37,134,386 |
| Aligned preview closing | PKR -32,503,237 |
| Closing Δ | PKR 69,637,623 |
| Compare | NON-ZERO-DIFF — **accepted as expected rule difference** |

**Delta explanation:** Q5=C excludes 169 internal transfer rows from aligned preview normal totals. Legacy still gross-presents transfer legs as period cash-in/out. Residual bridge: [`residual-delta-bridge.md`](../phase-3b-j-cash-flow-residual-delta-bridge/residual-delta-bridge.md)

### DIN BRIDAL — APPROVED_AS_ALIGNED_BASIS_CANDIDATE

| Field | Value |
|-------|-------|
| Legacy closing | PKR 918,570 |
| Aligned preview closing | PKR 60,720 |
| Closing Δ | PKR 857,850 |
| Compare | NON-ZERO-DIFF — **accepted as expected rule difference** |

**Delta explanation:** Q4=A excludes 2 opening-balance rows from aligned preview period cash-in. Legacy still counts opening/JE as period cash-in. Row count matches (51=51) but classification differs.

### DIN COUTURE — APPROVED_AS_ALIGNED_BASIS_CANDIDATE

| Field | Value |
|-------|-------|
| Legacy closing | PKR 50,500 |
| Aligned preview closing | PKR 50,500 |
| Closing Δ | PKR 0 |
| Compare | ZERO-DIFF |

**Note:** Zero-diff supports review confidence. Does not authorize loader swap alone.

---

## Evidence links

| Phase | Evidence |
|-------|----------|
| 3B-I aligned capture | [`phase-3b-i-cash-flow-aligned-golden-capture/`](../phase-3b-i-cash-flow-aligned-golden-capture/) |
| 3B-J residual bridge | [`phase-3b-j-cash-flow-residual-delta-bridge/`](../phase-3b-j-cash-flow-residual-delta-bridge/) |
| 3B-K decision record | [`finance-basis-decision-record.md`](finance-basis-decision-record.md) |

---

## Gates not approved by this pack

| Gate | Status |
|------|--------|
| Cash Flow loader swap | **NOT APPROVED** |
| Official legacy Cash Flow change | **NOT CHANGED** |
| BS/P&L finance | **PENDING** |
| R7 / R8 / next company | **BLOCKED** |

See [`cash-flow-loader-swap-gate-checklist.md`](cash-flow-loader-swap-gate-checklist.md) for loader swap prerequisites.
