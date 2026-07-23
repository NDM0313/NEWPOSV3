# Row bucket before/after — Phase 3B-H

**Evidence source:** Phase 3B-F production capture + 3B-H unit alignment logic

## DIN CHINA — transfer bucket (Q5=C)

| Metric | Before 3B-H (in normal totals) | After 3B-H (excluded from normal) |
|--------|-------------------------------|-----------------------------------|
| Transfer rows in period totals | 80 rows included | 80 rows → `internal_transfer_excluded_normal` |
| Transfer net in normal preview | PKR -56,889,891 counted | Excluded — audit/detail bucket only |

## DIN BRIDAL — opening bucket (Q4=A)

| Metric | Before 3B-H | After 3B-H |
|--------|-------------|------------|
| opening_balance_account as period cash-in | Included in preview cash-in | `opening_summary_only` — excluded |
| Legacy-only Jun row PKR 25,000 | Mismatch driver | Opening rule applied in preview |

**Capture status:** PENDING_DEPLOY — post-deploy Phase 3B-I re-capture required for verified closing deltas.
