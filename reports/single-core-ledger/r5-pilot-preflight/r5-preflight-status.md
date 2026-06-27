# R5 — First non-DIN company pilot (preflight + execution)

**Status:** `R5 BLOCKED — DIN BRIDAL GOLDEN CAPTURE CREDENTIALS REQUIRED`  
**Date:** 2026-06-27  
**Target company:** DIN BRIDAL  
**Company id:** `597a5292-14c8-4cd8-96bd-c61b5a0d8c92`

---

## R5a completed

SQL toolkit, golden capture script, monitoring profile, playbook, VPS deploy @ `11878c66`.

---

## Finance sign-off (2026-06-27)

| Item | Status |
|------|--------|
| Artifact | [`finance-signoff-unified-ledger-rollout-2026-06-27.md`](../din-bridal/finance-signoff-unified-ledger-rollout-2026-06-27.md) |
| Approver | Nadeem Khan |
| Staged rollout | Authorized |
| `golden-fixtures.json` ref | Updated |

---

## R5 execution attempt (2026-06-27 — finance sign-off run)

| Gate | Result |
|------|--------|
| Finance sign-off | **PASS** |
| Operator approval | PASS |
| Credentials | **FAIL** — `QA_BROWSER_EMAIL` / `QA_BROWSER_PASSWORD` missing |
| Read-only audit | PASS — DIN BRIDAL 0 flags, DIN CHINA 12 ON |
| Golden capture | Not run |
| Flag SQL | None |

---

## Exact next action

1. Set locally (do not commit):
   ```powershell
   $env:QA_BROWSER_EMAIL = "<DIN_BRIDAL_user@domain>"
   $env:QA_BROWSER_PASSWORD = "<password>"
   ```
2. Run golden capture: `node scripts/single-core-ledger/run-r5-golden-capture-din-bridal.mjs`
3. Re-run R5 from Step 6 (tests → staged flags → monitoring → soak)
