# Developer Integrity Lab

Forensic GL diagnostics — **not** the AR/AP Reconciliation Center (business cleanup).  
Journal entries remain the **source of truth**; this lab does **not** change Trial Balance formulas.

## Route & access

| Item | Value |
|------|--------|
| **Primary URL** | `/admin/developer-integrity-lab` |
| **Legacy URL** | `/admin/accounting-test-bench` (same UI) |
| **Nav** | Developer Tools → **Developer Integrity Lab** |
| **Roles** | `owner`, `super admin`, `superadmin`, `super_admin`, `developer`, `accounting_auditor` / `accounting auditor` (canonical match ignores `_` vs space) |
| **DEV** | `admin` may open |
| **Env** | `VITE_ACCOUNTING_DIAGNOSTICS=1` — internal/staging only |

## Files

| Path | Purpose |
|------|---------|
| `migrations/20260332_developer_integrity_lab.sql` | `integrity_lab_issues`, RLS, RPCs missing JE, view `v_integrity_sensitive_journal_lines` |
| `src/app/lib/developerAccountingAccess.ts` | `canAccessDeveloperIntegrityLab` |
| `src/app/services/developerAccountingDiagnosticsService.ts` | Trace, rules `RULE_01`…, scan, explorer |
| `src/app/services/integrityRuleEngine.ts` | Registry re-export + helpers |
| `src/app/services/integrityIssueRepository.ts` | Fix queue CRUD |
| `src/app/services/integrityLabService.ts` | Facade exports |
| `src/app/components/admin/DeveloperIntegrityLabPage.tsx` | UI tabs A–F |
| `src/app/components/admin/AccountingTestBenchPage.tsx` | Re-export (compat) |
| `src/app/App.tsx`, `NavigationContext.tsx`, `Sidebar.tsx` | Routes / nav |

## Severity model

| Level | Use |
|-------|-----|
| **error** | Duplicate **canonical** sale/purchase JE (`payment_id` null), pattern breaks (RULE_04/05), sensitive line with no ref **and** no `payment_id` |
| **warning** | Manual control, weak link, worker payment vs ledger **heuristic** (RULE_03/06), payment-linked sensitive line missing typed ref (RULE_08 soft) |
| **info** | Suspense 1195, draft doc + GL (RULE_01/02 — `ignoredForLabRollup`), void/policy (RULE_10) |
| **clean** | No rollup flags; optional policy-only hits still attached on the row as `hits` |

**Single scan:** summary cards, anomaly feed, rule counts, account health anomaly counts, export JSON, and fix-queue eligibility all derive from one `runIntegrityJournalScan` pack. **Rollup** excludes hits with `ignoredForLabRollup` for severity, counts, and queue.

**Account health:** primary balance = `accountingReportsService.getAccountBalancesFromJournal` (TB / GL); `accounts.balance` = secondary + variance.

**Display references:** Scan rows and trace include `uiRef` / `journalUiRefs` — human document numbers (SL-/PUR-/production_no/payment ref/expense_no) via `accountingDisplayRefResolver.resolveJournalUiRefsByJournalIds`; technical `reference_type:reference_id` stays visible as secondary.

## Rollout

1. Apply migration `20260332_developer_integrity_lab.sql`.
2. Deploy frontend.
3. Train auditors on role strings in `users.role`.
4. Phase 2+: optional `trace_accounting_reference` RPC if client scan becomes too heavy.

## Validation (quick)

- Draft sale / purchase + GL → **RULE_02 / RULE_01** at **info**, rollup-clean unless other rules fire.
- Worker payment vs 1180/2010 → **RULE_03 / RULE_06** **warning** (ledger heuristic; verify before repost).
- Stage bill not 5000/2010 → **RULE_04**.
- Multiple JEs same sale/purchase only when **canonical** (`payment_id` null) → **RULE_09**; payment/settlement JEs must not false-positive.
- Export JSON: `scanRows.length` matches scanned count; `ruleCounts` matches Rule violations tab.
