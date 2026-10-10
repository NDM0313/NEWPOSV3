# Actionable Repair Center — Final Report

**Date:** 2026-06-11  
**Prior deploy:** `cc4640d9` (AR-CUS0000 report-filter fix)  
**This feature commit:** see git log after merge  

## What was diagnostic-only before

- AR/AP queue rows showed labels (false positive, metadata review, non-final) but no unified **repair status**, **can apply?**, or **primary action button**.
- Expense/payment mismatches listed amounts with “Send to queue” only — no issue type / blocked reason matrix.
- JE-0161 / HQ-SL-0003 orphan AR defect was documented in chat/SQL only — no in-app GL correction dry-run.
- GL correction apply had no confirm-phrase gate or blocked-reason path in RepairActionPanel.

## What is now fixable (from UI)

| Category | Action | Apply? |
|----------|--------|--------|
| **A. Metadata-only** | Fix Link, Fix Branch, payment relink | Yes (existing safe actions) |
| **B. Payment/source sync** | Sync Payment Amount | Yes when JE matches expense |
| **C. Report-filter / audit** | View Audit, Mark Reviewed | No GL mutation |
| **D. Source document** | Open Source Document | No Accounting cancel |
| **E. GL correction draft** | Create GL Correction Draft (dry-run modal) | **Dry-run only** until RPC |

### UI surfaces updated

- **AR/AP Reconciliation Center** — Known GL correction section; Repair column on unposted + unmapped queues with status badge + action button.
- **Developer Repair Queue** — Expense mismatch table: Issue, Status, Risk, Can apply?, **Sync Payment Amount** button.
- **RepairActionPanel** — GL correction apply blocked with `gl_correction_apply_disabled` reason.

## What remains blocked and why

| Item | Reason |
|------|--------|
| **GL correction apply (JE-0161 class)** | Requires migration RPC `create_gl_correction_journal` — additive JE insert + audit; no silent line edits |
| **Broad AR/AP post/reverse/repost** | Intentionally disabled (unchanged) |
| **Source sale/purchase cancel from Accounting** | Must use Sales/Purchases modules |
| **JE-0168 mutation** | Audit-only; never edited |
| **Expense sync when JE ≠ expense** | Payment-only repair blocked — JE review first |

## JE-0161 / HQ-SL-0003 status

- **Dry-run:** Available in AR/AP Center → Known GL correction candidates → **Create GL Correction Draft**.
- Preview shows: JE-0160 / JE-0161 unchanged; new balanced correction Dr 1100 / Cr AR-CUS0000 Rs 150; raw GL AR 151 → 1; normal statement stays 0.
- **Apply:** **Not ready** — dry-run only. Confirm phrase when enabled: `APPLY GL CORRECTION`.

## JE-0168 status

- Classified **audit-only** — View Audit; no GL repair button.
- Normal report filtering unchanged (excluded from effective cash/statement).

## Repair action matrix

| Status label | Category | Primary button |
|--------------|----------|----------------|
| Fixable now | metadata / payment sync | Fix Link / Sync Payment Amount |
| Needs source document | source_document_required | Open Source Document |
| Needs GL correction draft | gl_correction_draft | Create GL Correction Draft |
| Audit-only / no action | report_filter_audit | View Audit / Mark Reviewed |
| Blocked — unsafe | various | Blocked — Explain |

## Safety rules (enforced)

- No hard-delete of posted accounting records.
- No mutation of existing JE lines for GL correction — additive JE only (when RPC exists).
- Dry-run + confirm phrase + audit log required for apply paths.
- Fix Link / metadata repairs never change GL amounts.
- Cancelled sale normal statement filter preserved (`reportVisibilityContract`).

## Migration required for GL correction apply

Stop before DB change. Proposed RPC (for approval):

```sql
-- migrations/YYYYMMDD_create_gl_correction_journal.sql (NOT applied)
CREATE OR REPLACE FUNCTION create_gl_correction_journal(
  p_company_id uuid,
  p_lines jsonb,
  p_dry_run_hash text,
  p_confirm_phrase text
) RETURNS jsonb ...
```

Must: insert new `journal_entries` + `journal_entry_lines` only; write `developer_repair_audit`; validate balanced lines; reject if confirm phrase wrong.

## Tests / build

```bash
npx tsx --test src/app/lib/actionableRepairClassifier.test.ts \
  src/app/lib/cashFlowReportLogic.test.ts \
  src/app/lib/reportVisibilityContract.test.ts \
  src/app/lib/phase2bReportConsistency.test.ts \
  src/app/lib/transactionActionRules.test.ts \
  src/app/lib/expensePaymentSync.test.ts \
  src/app/lib/accountingEditClassification.test.ts \
  src/app/lib/arApReconciliationAccess.test.ts \
  src/app/lib/arApRelinkApply.test.ts \
  src/app/lib/repairQueueDryRun.test.ts \
  src/app/lib/manualJournalCancelPolicy.test.ts \
  src/app/lib/developerRepairApplyGate.test.ts

npm run build
```

## Deploy status

- Frontend only (`deploy/vps-build-erp-only.sh`) — no DB restart, no migrations.
- Hard refresh ERP after deploy.
