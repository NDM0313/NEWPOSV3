# Finance golden capture plan — Cash Flow (Phase 3B)

**Status:** NEEDS_GOLDEN_CAPTURE — do not invent numbers

---

## Companies

DIN CHINA · DIN BRIDAL · DIN COUTURE

---

## Per company capture (after deploy)

| Capture item | Notes |
|--------------|-------|
| Date range | Align with monitoring window or operator-selected period |
| Branch | All branches + single branch if material |
| Liquidity filter | `all` baseline; optional cash/bank slices |
| Cash In total | Legacy vs preview |
| Cash Out total | Legacy vs preview |
| Net movement | Legacy vs preview |
| Closing balance | Legacy vs preview |
| Audit mode slice | Optional second capture with audit ON |

---

## Process

1. Deploy Phase 3B preview UI to production (operator approval)
2. Enable preview toggle per company
3. Export compare JSON from panel
4. Finance reviews deltas vs legacy main
5. Separate candidate golden phase (like Phase 3D for BS/P&L)
6. Loader swap remains blocked until finance sign-off

---

## Dependencies

- BS/P&L finance status remains **PENDING** — independent track
- R7 / R8 / next company **BLOCKED**
