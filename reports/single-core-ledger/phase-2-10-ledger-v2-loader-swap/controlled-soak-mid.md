# Phase 2.10D — Controlled loader soak (mid checkpoint)

**Timestamp:** 2026-06-26T13:10:30Z (approx)  
**Checkpoint:** mid  
**Loader flag state:** **unchanged ON** (verified via SQL @ 13:05:51Z enable time)  
**Overall:** **PASS**

## Mid verification

| Check | Result |
|-------|--------|
| Flag SQL — loader ON, only DIN CHINA | PASS |
| MR JALIL PKR 216,300 | PASS |
| `legacy_shadow` preview compare | PASS |
| Export spot-check | PASS |
| Pilot Batch 9/9 | PASS |
| Non-golden party spot-check | **WAIVED** — entity dropdown did not select alternate party (UI label "Customer" only) |

## Artifacts

- `screenshots/210d-soak-mid-ledger.png`
- `screenshots/210d-soak-mid-admin-compare.png`

No rollback triggered.
