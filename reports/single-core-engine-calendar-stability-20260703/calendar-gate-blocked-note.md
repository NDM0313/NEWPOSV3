# Calendar gate blocked — Calendar Day 3

**Status:** `BLOCKED_CALENDAR_GATE`  
**Not committed** — local note only.

## Attempts

| Attempt | Local date/time | Result |
|---------|-----------------|--------|
| 1 | 2026-07-02 18:45:16 +05:00 | BLOCKED — local date before 2026-07-03 |
| 2 | 2026-07-02 19:15:30 +05:00 | BLOCKED — local date before 2026-07-03 |

## Gate rule

- Required local date for Calendar Day 3: **2026-07-03**
- Actual local date at both attempts: **2026-07-02**
- Calendar Day 2 PASS already recorded: `three-company-monitoring-2026-07-02T12-55-47-086Z` (commit `eabab401`)

Monitoring, tests, commit, and push were **not** run. Same-day samples do not count toward the R8 calendar window.
