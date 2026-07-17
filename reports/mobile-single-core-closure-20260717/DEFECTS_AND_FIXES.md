# DEFECTS_AND_FIXES.md

Generated: 2026-07-17

| Finding | Evidence | Product defect? | Action |
|---------|----------|-----------------|--------|
| Salesman/limited/branch live RLS not run | No passwords in approved env | No | Gate: `NOT_RUN_CREDENTIAL_GATED` |
| Emulator app process exits / adb shell hangs after reinstall | pidof empty; screencap timeout | Environment / device tooling | Gate: `EMULATOR_QA_FAIL` — not an accounting-truth defect |
| DIN CHINA Worker Ledger empty | "No workers found" | No | Expected — 0 workers rows |
| Contact list vs period statement | Parity matrix | No | EXPECTED_BASIS_DIFFERENCE |

No product-code hotfix applied in closure (no proven accounting-truth defect).
