# First Real Sale 4100 Proof

> **SUPERSEDED** by [`first-real-sale-4000-proof.md`](../sales-revenue-canonical-account-correction-20260710/first-real-sale-4000-proof.md) — canonical account corrected to **4000**.

**Status:** `SUPERSEDED` (was `PENDING_OBSERVATION`)

**Checked:** 2026-07-10T17:53:00Z (read-only production SQL)  
**Cutoff:** `2026-07-10T17:06:53Z` (deploy of `b7fa557d`)  
**Standardization commit:** `b7fa557d`  
**Latest observation commit:** `b74408d3`

No finalized sale journal entry exists after cutoff `2026-07-10T17:06:53Z`.

## Result

- New 4000 revenue after cutoff: **0**
- New 4100 revenue after cutoff: **0**
- Post-cutoff sale document JEs: **0**
- Sale references found: **none**
- No erroneous drift found
- Real posting proof still **pending**

## Query evidence

- Production read-only SQL via `ssh dincouture-vps` → `docker exec supabase-db psql`
- `reference_type = 'sale'`, `payment_id IS NULL`, `created_at >= cutoff`
- Merchandise revenue lines checked for codes **4000** and **4100**
- All three companies checked: DIN CHINA, DIN BRIDAL, DIN COUTURE

## Most recent final sale per company (pre-cutoff context)

| Company | Invoice | Created (UTC) | Revenue code (historical) |
|---------|---------|---------------|---------------------------|
| DIN COUTURE | SL-0001 | 2026-06-09 | 4000 |
| DIN CHINA | SL-0003 | 2026-07-07 | 4000 |
| DIN BRIDAL | SL-0035 | 2026-07-05 | 4000 |

## Next

Observe after the next **natural finalized production sale** created by a business user.

When a sale appears, re-run read-only check and update this file:

- `PASS_4100_POSTING_CONFIRMED` if revenue account = **4100**
- `FAIL_4000_POSTING_AFTER_STANDARDIZATION` if revenue account = **4000** while **4100** exists

## Safety

- DB migrations run: no
- Transfer JE run: no
- Repairs run: no
- Production mutation by diagnostic: no
- Artificial sale created: no
