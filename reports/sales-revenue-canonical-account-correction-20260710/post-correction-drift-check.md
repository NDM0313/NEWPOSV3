# Post-correction drift check — 4000 canonical

**Checked at:** `2026-07-10T19:45:00Z` (final drift check after SL-0010)

## Drift status

**`NO_DRIFT` / `PASS_4000_POSTING_CONFIRMED`**

One post-correction finalized sale confirmed revenue on **4000**. No erroneous **4100** native sale posting detected.

## Summary

| Metric | Value |
|--------|-------|
| New 4000 merchandise revenue JEs after correction deploy | **1** (Rs. 500.00) |
| New 4100 merchandise revenue JEs after correction deploy | **0** |
| Post-correction sale document JEs | **1** |
| Post-correction sale_return JEs | **0** |
| Sale references found | **SL-0010** → **JE-0316** |

## Detail

| Company | Invoice | JE | Revenue code | Credit |
|---------|---------|-----|--------------|--------|
| DIN CHINA | SL-0010 | JE-0316 | **4000** | 500.00 |

## Expected behavior (verified)

- Revenue credit posts to **4000** when both accounts exist — **PASS**
- **4100** did not receive new native sale revenue while **4000** exists — **PASS**
- No `FAIL_4100_POSTING_AFTER_4000_CORRECTION`

## Prior context

- `b7fa557d` briefly set 4100-first (deployed 2026-07-10T17:06:53Z) — **no post-cutoff sales occurred** before correction
- No live proof was ever collected for 4100-first policy
- Proof commit: `23fb615d` — `first-real-sale-4000-proof.md`

## Safety

| Item | Status |
|------|--------|
| DB migrations | not run |
| Transfer JE | not run |
| GL mutation | none |
