# Rollback and safety plan — Phase 3B-L (plan only)

**Executed:** NO — planning document only.

## How to revert runtime code

Redeploy prior frontend commit:

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git checkout <known-good-commit> && bash deploy/vps-build-erp-only.sh"
```

Or `git revert` the Phase 3B-M commit and deploy. **No database migration required** for loader-only rollback.

## How to disable loader flag (future)

Per company, disable `unified_ledger_loader_cash_flow`:

```sql
-- Template — do NOT run in Phase 3B-L
DELETE FROM feature_flags
WHERE company_id = '<company-uuid>' AND feature_key = 'unified_ledger_loader_cash_flow';
```

Pattern reference: [`scripts/single-core-ledger/din-couture/dc-rollback-loader-roznamcha.sql`](../../../scripts/single-core-ledger/din-couture/dc-rollback-loader-roznamcha.sql)

## Emergency: kill switch

Enable `unified_ledger_kill_switch` for company — all unified loaders fall back to legacy.

## Restore legacy official Cash Flow as default

1. Loader flag OFF → resolver returns `legacy`  
2. `getCashFlowReport` path becomes main table again  
3. Preview toggle may remain for diagnostic compare

## Verify no GL/data mutation

```bash
npm run monitor:three-company-unified-ledger
```

Confirm `gl_mutations: false` and `migrations_run: false`.

## Post-rollback monitoring

Repeat monitoring until all three companies PASS. Capture evidence under future phase folder.

## User-facing communication

> Cash Flow has been restored to the previous official report basis. Your accounting data (journals, payments, balances) was not changed — only which report engine displays the Cash Flow table was reverted.

## Stop conditions during rollback

- Do not re-enable loader flag while monitoring FAIL  
- Do not leave kill switch ON without incident closure doc  
- Partial company rollback requires explicit operator approval
