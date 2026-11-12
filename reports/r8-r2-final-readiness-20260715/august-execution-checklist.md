# August R8-R2 Execution Checklist

Use with `docs/accounting/R8_R2_EXECUTION_PROMPT_FOR_2026-08-09.md`.

## Gate

- [ ] System date ≥ **2026-08-09**
- [ ] Operator present
- [ ] Approval phrase recorded: `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`
- [ ] Fresh kill-switch drill PASS (new evidence pack)
- [ ] Monitoring PASS ×3 + loader guard PASS
- [ ] Pre-deletion tag created on exact ready commit

## Delete only

- [ ] 4× `*LegacyMainService.ts` thin wrappers
- [ ] Page legacy branches: Ledger V2, AS, TB, Party, Roznamcha, Cash Flow
- [ ] Shadow imports retargeted
- [ ] BS/P&L fallback only if operator explicitly includes (else defer)

## Retain

- [ ] Shadow services present
- [ ] `getCustomerLedger` present
- [ ] Contacts legacy RPC present
- [ ] Mobile fallback untouched
- [ ] Resolvers / flags / kill / L1 SQL / loader guard present

## Validate + ship

- [ ] `test:unified-ledger` PASS
- [ ] `test:unit` PASS
- [ ] `build` PASS
- [ ] Staged files reviewed
- [ ] Commit + push
- [ ] Frontend deploy only
- [ ] Production health + commit verify
- [ ] Post-deploy monitoring PASS
- [ ] Closeout report written

## Stop if

- [ ] Date before 2026-08-09
- [ ] Drill FAIL
- [ ] Monitoring FAIL
- [ ] Unexpected WIP staged
- [ ] Any urge to “just delete shadow/resolvers”
