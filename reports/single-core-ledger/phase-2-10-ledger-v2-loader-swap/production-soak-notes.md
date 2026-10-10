# Phase 2.10E — Production soak notes

**Status:** **PENDING — not executed**  
**Prerequisite:** Production loader enable QA PASS

## Planned soak window

**Option A:** 2-hour controlled soak (recommended)  
**Option B:** Business-day monitored soak

## Checkpoints

| Checkpoint | Planned actions | Status |
|------------|-----------------|--------|
| T0 | Full candidate QA + export sign-off | PENDING |
| Mid | Flag SQL; MR JALIL 216,300; Admin Compare; non-golden party retry | PENDING |
| Final | Repeat candidate QA; staff waiver re-sign or staff login test | PENDING |

## Monitoring checklist

- [ ] `unified_ledger_loader_ledger_v2` remains ON (DIN CHINA only)
- [ ] No extra screen flags enabled
- [ ] MR JALIL PKR 216,300 stable
- [ ] Exports match on-screen closing
- [ ] No RPC/console error spike
- [ ] No user complaints
- [ ] Staff visibility verified or waiver signed

## Reference

Preview soak evidence: [`controlled-soak-final.md`](controlled-soak-final.md)

---

*Update after production soak execution.*
