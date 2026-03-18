# Remaining Tasks Handoff

## Current status
- Phases 1–8 are completed and approved as roadmap completion.
- `FINAL_ACCEPTANCE_RESULT.md` was generated, but it was **not run against the live DB** yet.
- The current file says:
  - no company ID was available to the script
  - live numbers were not filled
  - corrective actions were not applied yet

## Immediate remaining task
### 1) Run final acceptance on live DB
Run one of these on the machine that has working `.env.local` and DB connectivity:

```bash
npm run verify:final
```

or

```bash
node scripts/final-acceptance-verification.js
```

If needed, set company id first:

### Windows
```powershell
set COMPANY_ID=your-company-uuid
npm run verify:final
```

### Bash
```bash
export COMPANY_ID=your-company-uuid
npm run verify:final
```

## What this must verify
- Trial Balance difference
- Balance Sheet balances
- P&L matches journal truth
- Accounts screen matches journal
- Account Ledger matches journal
- Receivables match AR (1100)
- Payables match AP (2000)
- Inventory valuation matches stock/inventory rules
- Unbalanced JEs, if any
- Safe sync of `accounts.balance` from journal, if mismatch exists

## Important rule
- No blind delete
- No destructive cleanup
- Only safe sync / safe corrective actions
- If any gap remains, document exact record and exact correction required

## Final deliverable required
After running live verification, update:

```text
docs/accounting/RESET COMPANY/FINAL_ACCEPTANCE_RESULT.md
```

It must contain:
- current TB difference
- whether BS balances
- whether P&L matches journal truth
- whether Accounts matches journal
- whether Account Ledger matches journal
- whether Receivables match AR
- whether Payables match AP
- whether Inventory valuation matches stock rules
- exact remaining issues
- corrective actions applied
- latest git commit hash

## Suggested GitHub update steps
```bash
git add docs/accounting/RESET\ COMPANY/FINAL_ACCEPTANCE_RESULT.md scripts/final-acceptance-verification.js
git commit -m "final acceptance: run live verification and update result"
git push
```

## If verification still fails
Then only do these steps:
1. Load detection in Integrity Lab Phase 8
2. Review unbalanced JEs
3. Review AR/AP reconciliation gaps
4. Run safe account balance sync if needed
5. Re-run final verification
6. Update FINAL_ACCEPTANCE_RESULT.md again

## Done condition
This work is only fully done when live verification is run and the final acceptance file is filled with real numbers, not placeholders.
