# First Real Sale 4000 Proof (post-correction)

**Status:** `PENDING_OBSERVATION`

**Checked:** 2026-07-10T18:30:00Z (read-only production SQL)  
**Cutoff:** `2026-07-10T18:21:44Z` (deploy of `8adf5ff2` — 4000 canonical correction)  
**Supersedes:** `first-real-sale-4100-proof.md` (4100-first policy reversed)

No finalized sale journal entry exists after the 4000-correction deploy cutoff.

## Result

- New **4000** revenue after cutoff: **0**
- New **4100** revenue after cutoff: **0**
- Post-cutoff sale document JEs: **0**
- Sale references found: **none**
- Real posting proof still **pending**

## Expected (when next natural sale occurs)

| Outcome | Status |
|---------|--------|
| Revenue credits **4000** | `PASS_4000_POSTING_CONFIRMED` |
| Revenue credits **4100** while **4000** exists | `FAIL_4100_POSTING_AFTER_4000_CORRECTION` |

## Prior context

- `b7fa557d` 4100-first deploy had **zero** post-cutoff sales before correction
- No incorrect live postings from brief 4100-first window

## Safety

- DB migrations run: no
- Transfer JE run: no
- Repairs run: no
- Production mutation by diagnostic: no
- Artificial sale created: no
