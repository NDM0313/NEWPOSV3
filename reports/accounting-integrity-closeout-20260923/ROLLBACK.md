# Rollback

Rollback package (outside Git):

`/root/backups/newposv3/20260923-005428/targeted_export/rollback/pre_mutated_lines.csv`

Script (in repo): `rollback_allowlisted_jes.sql`

| Mutation | Rollback |
|----------|----------|
| China Inventory insert | DELETE line `a1c4e901-0923-4001-8001-55b744a8c001` |
| COGS debit updates | SET debit=0 |
| Sales credit bumps | SET prior credits |
| Deleted 4120 lines | Re-INSERT from `pre_mutated_lines.csv` |

**Status:** Not executed (production POST verify PASS).
