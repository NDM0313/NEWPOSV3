# Post-cleanup smoke

**Generated:** 2026-06-29  
**URL:** https://erp.dincouture.pk

---

## Checks

| Check | Result |
|-------|--------|
| App loads | **Pass** |
| Login page renders | **Pass** |
| `admin@test.com` removed | **Pass** — auth returns 400; stale session signs out cleanly |
| Real operator login | **Not verified** — production credentials not available on Mac |
| Create Business wizard entry | **Pass** — Step 1 of 5 loads; Cancel returns to login |
| Ledger V2 / Party Discount | **Not verified** — requires authenticated real-company session |
| New test business created | **No** |
| Discount JE posted | **No** |

---

## Result

**PARTIAL PASS** — production app healthy; cleanup confirmed; authenticated smoke deferred (missing QA passwords).
