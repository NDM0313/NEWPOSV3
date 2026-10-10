# Production repair verify

| Item | Value |
|------|--------|
| Applied | 2026-09-23 (after clone PASS) |
| Script | `repair_allowlisted_jes.sql` |
| Run artifacts | `/root/backups/newposv3/20260923-005428/production_apply_20260923-unbalanced-je-closeout/` |

## PRE → POST

| Scope | PRE Dr−Cr | POST Dr−Cr |
|-------|-----------|------------|
| DIN COLLECTION all | 0.00 | **0.00** (5062 JE / 10124 lines unchanged) |
| DIN CHINA non-void | 0.00 | **0.00** |
| DIN CHINA all | +190.00 | **0.00** |
| DIN BRIDAL non-void | −13620.00 | **0.00** |
| DIN BRIDAL all | −35920.00 | **0.00** |
| DIN COUTURE | 0.00 | **0.00** |
| Global | −35730.00 | **0.00** |
| Unbalanced JE count | 8 | **0** |

Source documents: PUR-0004 cancelled 190; bridal sales finals unchanged.

**Verdict:** `PRODUCTION_REPAIR_PASS`
