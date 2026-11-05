# Final monitoring

**Run:** 2026-07-01T13-12-09-163Z  
**Overall:** FAIL (expected — no golden refresh)

| Company | Result |
|---------|--------|
| DIN CHINA | PASS |
| DIN BRIDAL | FAIL |
| DIN COUTURE | PASS |

**Guards:** migrations_run false | gl_mutations false | flags unchanged

## DIN BRIDAL failures

| Check | Expected | Actual | Δ |
|-------|----------|--------|---|
| Roznamcha Cash In | 1,836,350 | 1,991,850 | +155,500 |
| Roznamcha Closing | 918,570 | 1,074,070 | +155,500 |
| Trial Balance total | 22,056,075 | 22,313,400 | +257,325 |

Drift increased since 12:43 artifact (+56k TB / +33.5k roznamcha) — consistent with **RCV-0077** and continued live postings. Audit through 12:43 remains valid for the +201,325 / +122,000 explained window.
