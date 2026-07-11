# Salesman extended QA — final report

**Date:** 2026-07-11  
**Scope:** OLD ERP mobile — Salesman rows 4–20 only  
**Outcome:** **DEVICE_BLOCKED** — Pixel not connected to adb

## Repo

| Item | Value |
|------|--------|
| Branch | `main` |
| HEAD | `f7c66fd9` |
| origin/main | `f7c66fd9` |

## Device

| Item | Value |
|------|--------|
| Model | Pixel 6 Pro (expected; not detected) |
| adb state | **empty** |
| Authorization | N/A |

## QA

| Item | Value |
|------|--------|
| Rows 1–3 | **PASS** (2026-07-09, not re-run) |
| Rows 4–20 PASS | **0** |
| Rows 4–20 BLOCKED | **16** |
| Rows 4–20 NOT APPLICABLE | **1** (row 5) |
| Production transactions | **none** |
| Password requested | **no** |

## Delivery

| Item | Value |
|------|--------|
| Runtime files changed | **no** |
| Deploy required | **no** |
| Deploy performed | **no** |

## Next step

Reconnect and authorize Pixel 6 Pro, then re-run rows 4–20 with shell-only Salesman password at QA time.
