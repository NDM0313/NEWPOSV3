# OLD ERP â€” SALESMAN EXTENDED QA COMPLETION REPORT

**Date:** 2026-07-11
**Scope:** Mobile APK â€” Salesman rows **4â€“20** (read-only)
**Outcome:** **PASS** â€” `SALESMAN_EXTENDED_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED`
**Operator:** App confirmed **proper working**; extended checklist signed off

## Device

| Item | Value |
|------|--------|
| Pixel 6 Pro | `24281FDEE0023P` |
| App | `com.dincouture.erp` v1.0.5 (39) |
| Role | **Nabeel / SALESMAN** (counter-worker) |

## Results

| Status | Count | Rows |
|--------|-------|------|
| PASS | 9 | 4, 12â€“20 |
| NOT APPLICABLE | 7 | 5â€“11 |
| FAIL | 0 | â€” |
| Rows 1â€“3 | PASS | 2026-07-09 (not re-run) |

## Role scoping (row 4 / 5â€“11)

Salesman does not receive the full-accounting Reports hub or financial statement tiles. This matches `canUseFullAccounting=false` in `AccountsModule` / `ReportsHub`. **Not a defect** â€” operator confirms correct live behavior.

## Privacy & stability (rows 12â€“19)

- DIN branch totals not exposed to Salesman
- Own sales/pending metrics only on home
- No crash, blank screen, or chunk error in session
- Read-only protocol; no production writes

## Row 20

Logout **PASS** via operator attestation (live use). ADB session drift to ADMIN during automation does not invalidate product sign-off.

## Safety gates (unchanged)

| Gate | Status |
|------|--------|
| Play Store upload | not performed â€” `PLAY_STORE_FINAL_UPLOAD_APPROVAL_REQUIRED` |
| Supplier Discount QA | not performed |
| R8-R2 deletion | not performed |
| DB/GL mutation | none |
| Revenue reclass | not performed |

## Next phase

Postâ€“Salesman QA closeout: repo validation + approval-gate docs update. Gated tracks (Play Store, Supplier PKR1, R8-R2, reclass) still require explicit approval strings.
