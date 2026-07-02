# Calendar Day 3 — credential gate note

**Generated:** 2026-07-03

---

## Why Day 3 is PARTIAL on Home MacBook

Local date **2026-07-03** satisfies the calendar gate (Day 3 may run; not same-day as Day 2).

Full `npm run monitor:three-company-unified-ledger` requires per-company passwords in the shell:

- `QA_BROWSER_PASSWORD_CHINA`
- `QA_BROWSER_PASSWORD_BRIDAL`
- `QA_BROWSER_PASSWORD_COUTURE`

These are **not** set on Home MacBook (by design — never commit credentials).

---

## To complete Day 3 PASS

1. Operator exports passwords into current terminal session (see `reports/single-core-ledger/operational-monitoring/windows-task-scheduler-guide.md`).
2. Re-run monitoring on Mac or office PC.
3. Update `daily-monitoring.md` with artifact path and **CALENDAR_STABILITY_DAY_PASS**.

---

## What was completed without credentials

- Git pull (HEAD `1a42de79`)
- Tests/build PASS
- Read-only loader guard PASS
