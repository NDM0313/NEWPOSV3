# DIN BRIDAL drift classification

**Run:** DIN BRIDAL MONITORING DRIFT DIAGNOSIS + MOBILE ROLE QA READINESS  
**Date:** 2026-07-01

## Summary

| Area | Classification | Mobile APK regression? |
|------|----------------|------------------------|
| Trial Balance | **NEW_UNAPPROVED_DATA_DRIFT** | No |
| Roznamcha | **NEW_UNAPPROVED_DATA_DRIFT** | No |

## Trial Balance

**Classification:** `NEW_UNAPPROVED_DATA_DRIFT`

**Evidence:**
- Golden **22,056,075** set post-1100 Option C apply (2026-06-30); monitoring PASS through 2026-07-01T11:32Z
- Actual **22,215,400** at 12:31Z (+159,325); debit = credit throughout
- Unified loader PASS; din-china and din-couture PASS
- Mobile Admin BS/P&L goldens still match on device

**Recommended next action:** Operator confirms July 1 DIN BRIDAL postings. If legitimate business, prepare **separate operator-approved golden refresh**. If unexplained, read-only JE audit for cumulative +159,325 PKR balanced activity.

| Gate | Status |
|------|--------|
| Release approval pack | **Blocked** until drift understood |
| Mobile Admin QA | **Remains valid** |
| Manager/Salesman QA | **Can continue independently** |

## Roznamcha

**Classification:** `NEW_UNAPPROVED_DATA_DRIFT`

**Evidence:**
- Cash In +80,000 and Closing +80,000; Cash Out unchanged (917,780)
- Onset at 2026-07-01T11:58Z after prior PASS at 11:32Z
- Loaders unified; aligns with TB +80k wave

**Recommended next action:** Confirm liquidity-side postings with finance; golden refresh only with separate approval.

| Gate | Status |
|------|--------|
| Release approval pack | **Blocked** |
| Mobile Admin QA | **Remains valid** |
| Manager/Salesman QA | **Can continue independently** |

## Excluded classifications

- `MONITORING_SCRIPT_BUG` — other companies PASS; checks deterministic
- `REPORT_SEMANTICS_MISMATCH` — no loader/basis change at failure onset
- `TRANSIENT_MONITORING_FAILURE_RESOLVED` — failure persists across multiple runs

**Do not treat as mobile APK failure** until read-only diagnostics prove otherwise — diagnostics show production data drift, not mobile screen regression.
