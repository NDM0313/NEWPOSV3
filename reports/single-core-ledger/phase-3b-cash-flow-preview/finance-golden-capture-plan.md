# Finance golden capture plan — Cash Flow (Phase 3B)

**Status:** CAPTURE COMPLETE (Phase 3B-D) — finance review **PENDING**

---

## Companies

DIN CHINA · DIN BRIDAL · DIN COUTURE — **captured** @ 2026-06-29

Evidence: [`phase-3b-d-cash-flow-golden-capture/`](../phase-3b-d-cash-flow-golden-capture/)

---

## Capture result summary

| Company | Zero-diff | Finance status |
|---------|-----------|----------------|
| DIN CHINA | NO | NEEDS_RULE_CONFIRMATION |
| DIN BRIDAL | NO | NEEDS_RULE_CONFIRMATION |
| DIN COUTURE | YES | PENDING |

All values: **CANDIDATE_ONLY — NOT FINANCE APPROVED**

---

## Per company capture (completed)

| Capture item | Notes |
|--------------|-------|
| Date range | 2000-01-01 to 2026-06-29 (production global filter) |
| Branch | As shown in capture matrix (Selected branch or All branches per session) |
| Liquidity filter | `all` |
| Source module | `all` |
| Preview basis | `effective_party` |
| Cash In / Out / Net / Closing | Legacy vs preview in candidate goldens |
| Audit mode | OFF (baseline capture) |

---

## Process

1. ~~Deploy Phase 3B preview UI to production~~ **DONE** (`99f2e3b3`)
2. ~~Enable preview toggle per company and export compare JSON~~ **DONE** (Phase 3B-D)
3. **Finance reviews** deltas vs legacy main — [`finance-review-pack.md`](../phase-3b-d-cash-flow-golden-capture/finance-review-pack.md)
4. Separate approval/sign-off phase if operator approves
5. Loader swap remains **blocked** until finance sign-off

---

## Dependencies

- BS/P&L finance status remains **PENDING** — independent track
- R7 / R8 / next company **BLOCKED**
- No migrations, flags, or GL/data mutations during capture
