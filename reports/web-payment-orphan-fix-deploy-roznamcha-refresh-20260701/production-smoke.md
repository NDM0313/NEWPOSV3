# Production smoke (read-only)

| Check | Result |
|-------|--------|
| https://erp.dincouture.pk HTTP | **200** |
| erp-frontend container | **healthy** |
| Orphan fix bundle on VPS | **verified** — `AccountingDashboard-DEgiGUnr.js` contains `Posting failed` |
| New production receipts created | **no** (smoke only) |

**Expected production behavior (post-deploy):**
- Journal Entries page loads via deployed bundle
- RCV-0081 / RCV-0082 not shown as normal posted receipts (voided/hidden)
- Orphan UI labels (`Orphan / Posting failed`, `Delete / Hide orphan`) in new bundle
- No new GL mutations during smoke

**Note:** Full interactive browser smoke deferred to operator; infrastructure and deploy health verified.
