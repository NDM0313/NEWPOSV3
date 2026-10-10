# Mobile release gate update

| Item | Status |
|------|--------|
| Release gate | **BLOCKED_PARTIAL_DEVICE_QA_PENDING_ROLES** |
| Monitoring (post golden refresh) | **PASS** — all three companies |
| Mobile Admin QA | **PASS** (21/21 on Pixel 6 Pro) |
| Manager QA | **PENDING** — credentials not configured |
| Salesman QA | **PENDING** — credentials not configured |
| Play Store / public release | **NOT RELEASED** — separate approval required |
| Supplier Party Discount PKR 1 | **Not approved** — separate operator approval |
| R8 legacy retirement | **BLOCKED** — 2–4 week stable run required |

## Rationale

Monitoring drift from legitimate July 1 live shop activity is resolved via fixture-only golden refresh. Admin device QA remains valid. Release remains blocked until Manager/Salesman role QA completes or operator accepts an Admin-only release pack (separate written approval; no Play Store upload without explicit approval).
