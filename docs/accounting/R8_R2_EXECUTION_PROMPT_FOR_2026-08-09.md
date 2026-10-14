# R8-R2 Execution Prompt — Use on or after 2026-08-09

**Copy this entire document into an agent session on the execution day.**
**Do not run this prompt before 2026-08-09.**

---

You are continuing OLD ERP / DIN Collection ERP only (`NEWPOSV3`). Do not mix FX / multi-currency work.

## Hard gates (stop immediately if any fail)

1. **Re-check actual calendar date.** If today is before **2026-08-09**, STOP. Do not delete. Do not drill in production unless operator explicitly commands a separate drill with written risk acceptance (default: stop).
2. Require the exact approval phrase in the user message:
   `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`
   If missing, STOP.
3. Read authority packs first:
   - `docs/accounting/R8_R2_FINAL_EXECUTION_READINESS_2026-07-15.md`
   - `reports/r8-r2-final-readiness-20260715/` (deletion-manifest, must-retain, drill runbook, rollback, test, deploy, august checklist)
   - `docs/accounting/R8_R2_LEGACY_DELETION_READINESS_PLAN.md`

## Mandatory sequence

### A. Baseline

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

Confirm main clean of unrelated WIP (or leave WIP unstaged). Do not stage graphify-out, credentials, mobile, cashbook/import-gap, repair SQL.

### B. Fresh operator-attended kill-switch drill

Follow `reports/r8-r2-final-readiness-20260715/kill-switch-drill-runbook.md` exactly.

- Operator must be present
- Capture new evidence under `reports/r8-r2-kill-switch-drill-YYYYMMDD/`
- Prove: unified before → legacy during kill → unified after restore
- No accounting mutations
- **STOP if drill fails** — do not proceed to deletion

Previous 2026-07-12 drill PASS remains **RETRACTED**; this fresh drill is required.

### C. Fresh monitoring (before deletion)

```bash
npm run monitor:three-company-unified-ledger
```

Require PASS for DIN COUTURE, DIN BRIDAL, DIN CHINA + loader guard PASS. STOP if FAIL.

### D. Pre-deletion tag

Create tag on the exact production-ready commit:

`r8-r2-pre-code-deletion-YYYYMMDD`

(Use real execution date. Example format from readiness: `r8-r2-pre-code-deletion-20260809`.)

Do not rewrite history.

### E. Branch + delete only approved files / branches

Create dedicated branch. Delete **only**:

1. Four thin wrappers:
   - `src/app/services/accountStatementLegacyMainService.ts`
   - `src/app/services/trialBalanceLegacyMainService.ts`
   - `src/app/services/partyLedgerLegacyMainService.ts`
   - `src/app/services/roznamchaLegacyMainService.ts`
2. Page legacy branches in:
   - Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha, Cash Flow
3. Retarget shadow preview imports that pointed at those wrappers (same PR)

**Retain (do not delete):**

- Shadow compare services (bodies)
- `getCustomerLedger`
- Contacts legacy party GL RPC
- Mobile fallback
- Resolvers
- Engine state / feature flags / kill-switch logic
- L1 rollback SQL
- Loader guard / monitoring scripts
- BS/P&L error fallback unless operator explicitly includes them in this session

### F. Validate after deletion (before deploy)

```bash
npm run test:unified-ledger
npm run test:unit
npm run build
git diff --check
```

Update tests deliberately; do not delete tests only because they fail.

### G. Commit / push / deploy frontend only

- Stage only R8-R2 deletion + necessary test/docs updates
- Commit with clear message
- Push
- Deploy **ERP frontend only** (approved `deploy/vps-build-erp-only.sh` via `ssh dincouture-vps`)
- **No** migrations, GL repairs, Play Store, Contacts rewrite, AR/AP basis change

### H. Post-deploy verify

- HTTP 200; erp-frontend healthy; commit matches
- Screen smoke: 8 financial reports + AR/AP Center
- ```bash
  npm run monitor:three-company-unified-ledger
  ```
- Produce final closeout report + evidence pack

### I. Closeout criteria to declare

- Operationally complete: YES
- Technically closed: YES (if no other mandatory core blocker)
- Fully retired: YES for **approved main-loader scope**
- Document retained shadow / hybrid / Contacts / mobile / rollback as intentional

## Safety never do

- Bypass or shorten soak
- Toggle kill without operator
- Mutate production accounting data
- Delete protected must-retain list items
- Stage secrets / graphify / unrelated WIP

## Rollback if needed

Follow `reports/r8-r2-final-readiness-20260715/rollback-plan.md` (L0 / L1 / L2 via pre-deletion tag).
