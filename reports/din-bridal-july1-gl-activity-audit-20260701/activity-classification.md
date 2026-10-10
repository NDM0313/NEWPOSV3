# Activity classification

## Trial Balance

| Field | Value |
|-------|-------|
| **Classification** | `LEGITIMATE_LIVE_BUSINESS_ACTIVITY` |
| **Secondary** | `STALE_MONITORING_GOLDENS_AFTER_LIVE_ACTIVITY` |
| **Evidence** | RCV-0075 (+80k) + JE-0205 (+79,325) + RCV-0076 (+42k) = **+201,325** at 12:43 |
| **Refs** | RCV-0075, JE-0205, RCV-0205/SL-0018, RCV-0076, RCV-0077 |
| **Golden refresh** | Appropriate after operator approval |
| **Repair/fix** | **Not required** |
| **Mobile Admin QA** | **Remains valid** |

## Roznamcha

| Field | Value |
|-------|-------|
| **Classification** | `LEGITIMATE_LIVE_BUSINESS_ACTIVITY` |
| **Secondary** | `STALE_MONITORING_GOLDENS_AFTER_LIVE_ACTIVITY` |
| **Evidence** | RCV-0075 (+80k) + RCV-0076 (+42k) = **+122,000** Cash In / Closing at 12:43 |
| **Golden refresh** | Appropriate after operator approval |
| **Repair/fix** | **Not required** |

## Excluded

- `SUSPICIOUS_OR_UNEXPLAINED_POSTING` — all activity traced to normal sale/receipt ops
- `REPORT_BUG` / `MONITORING_BUG` — loaders pass; drift matches GL sums
- `INCOMPLETE_AUDIT_NEEDS_MORE_ACCESS` — service-role audit complete for identified JEs

**Monitoring must stay blocked** until operator approves fixture-only golden refresh (or accepts live-drift waiver in writing).
