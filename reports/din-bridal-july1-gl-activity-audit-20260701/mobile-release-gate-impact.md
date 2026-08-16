# Mobile release gate impact

**Release gate:** `BLOCKED_PENDING_GOLDEN_REFRESH_APPROVAL_AND_PARTIAL_DEVICE_QA`

| Component | Status |
|-----------|--------|
| Monitoring | Explained — **blocked until operator approves fixture refresh** |
| Admin QA | **Valid** (21/21; BS/P&L goldens pass) |
| Manager QA | Pending credentials |
| Salesman QA | Pending credentials |
| Play Store | **Not approved** |

After golden refresh approval **and** Manager/Salesman QA (if policy requires), gate may move to `READY_FOR_RELEASE_APPROVAL_PACK_AFTER_ROLE_QA` — still requires separate Play Store written approval.

**Not** `BLOCKED_MONITORING_DRIFT_UNEXPLAINED` — drift fully attributed to legitimate live postings.
