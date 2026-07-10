# Next finalized sale — live observation

**Date:** 2026-07-10  
**Observation window start:** 2026-07-10T17:06:53Z (deploy of `b7fa557d`)  
**Method:** Read-only production SQL via VPS  
**DB mutation by this diagnostic:** no

## Result

**No real finalized sale occurred during this observation window.**

No artificial sale was created per operator safety rules.

## Context (most recent final sale per company)

| Company | Invoice | Invoice date | Total | Created (UTC) | Pre-deploy? |
|---------|---------|--------------|-------|---------------|-------------|
| DIN COUTURE | SL-0001 | 2026-06-09 | Rs. 26,250 | 2026-06-09 12:57 | yes |
| DIN CHINA | SL-0003 | 2026-05-10 | Rs. 672,000 | 2026-07-07 14:21 | yes (posted to **4000**) |
| DIN BRIDAL | SL-0035 | 2026-06-28 | Rs. 15,000 | 2026-07-05 13:01 | yes |

## Post-cutoff sale document JEs

- Count: **0**
- Revenue account used: n/a

## Verification status

| Check | Status |
|-------|--------|
| Revenue credit to 4100 | **PENDING** — await next natural finalized sale |
| 4000 receives new revenue while 4100 exists | **NOT OBSERVED** (no post-cutoff sales) |
| AR/cash/payment lines normal | n/a |
| TB balanced | n/a |

**Overall:** **PENDING OBSERVATION** (not FAIL — no post-deploy sale yet)

## Next step

When the operator finalizes the next real sale, re-run read-only section 5 of this pack and update this file with:

- company, branch, invoice/ref, sale date, total, payment status
- journal entry id / document no
- debit and credit lines
- revenue account code (expect **4100**)
