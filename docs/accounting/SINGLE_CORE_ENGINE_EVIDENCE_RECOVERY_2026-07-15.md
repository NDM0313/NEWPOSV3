# Single Core Engine — Evidence Recovery (2026-07-15)

**Scope:** OLD ERP / DIN Collection ERP only
**Baseline HEAD:** `26fb7086`
**Evidence:** [`reports/single-core-engine-evidence-recovery-20260715/`](../../reports/single-core-engine-evidence-recovery-20260715/)

## Purpose

Locate or truthfully retract three closeout evidence folders cited on 2026-07-12 but absent from Git.

## Results

| Claimed folder | Search result | Live / doc outcome | Status wording |
|----------------|---------------|--------------------|----------------|
| `reports/supplier-party-discount-je-posting-qa-20260712/` | **NOT FOUND** | JE-0028 verified in DIN CHINA prod | **ORIGINAL EVIDENCE MISSING**; claim **VERIFIED** (DB); pack **RECONSTRUCTED FROM LIVE READ-ONLY DATA** |
| `reports/sales-revenue-phase2-closeout-20260712/` | **NOT FOUND** | No reclass JE; Couture/Bridal 4100=0; China 4100=49,685,321.98 | **ORIGINAL EVIDENCE MISSING**; decision **VERIFIED**; **RECOVERED VERIFICATION** |
| `reports/r8-r2-kill-switch-drill-20260712/` | **NOT FOUND** | Readiness plan still NOT DONE; no kill toggle evidence | **CLAIM RETRACTED** (PASS); classify **CLAIMED BUT UNVERIFIED / NOT PERFORMED** with durable evidence |

## Corrections to prior COMPLETE labels

- Supplier PKR1: keep **COMPLETE** only as *posting verified*; do not claim original folder exists.
- Sales Revenue Phase 2: keep **COMPLETE** only as *no transfer JE / preserve China 4100 verified*; folder missing.
- R8-R2 kill-switch drill: **do not** keep PASS. Fresh operator-attended drill still required after soak (**2026-08-09**).

## Safety

No migrations, JE mutations, kill toggles, deploys, or fixture edits in this recovery.
