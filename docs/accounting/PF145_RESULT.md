# PF-14.5B – Duplicate Journal Cleanup + Accounting Integrity Test Lab

## Result summary

- **Root cause:** Duplicate JEs created by sale adjustment and payment (amount/account) adjustment flows when idempotency was missing or sync/double-save occurred.
- **Prevention:** Idempotency checks (existing) + optional `action_fingerprint` on adjustment JEs; unique partial index prevents duplicate active fingerprints at DB level after migration.
- **Classification:** Duplicate candidates = same (reference_type, reference_id, description); Orphans = adjustment JEs whose sale/payment no longer exists.
- **Cleanup:** Void only (no hard delete of uncertain rows). Exact duplicates: keep earliest, void rest. Orphans: void with reason.
- **Business views:** All relevant queries exclude `is_void = true`; Account Ledger, Journal list, Day Book, Cash flow, effective payment lines updated.

---

## 1. Root-cause analysis

| Source | Cause | Fix |
|--------|--------|-----|
| Sale edit / postSaleEditAdjustments | Multiple calls or re-run creating same sale_adjustment JE | `hasExistingSaleAdjustmentByDescription` before post; `action_fingerprint` on entry |
| Payment amount edit | Double save or sync creating same payment_adjustment JE | `hasExistingPaymentAmountAdjustment` before post; `action_fingerprint` on entry |
| Payment account change | syncPaymentAccountAdjustmentsForCompany or UI double submit | `hasExistingPaymentAccountAdjustment` before post; `action_fingerprint` on entry |
| Load/sync side effects | Repeated refresh or loadEntries triggering repost | Same idempotency checks; fingerprint prevents DB duplicate |

---

## 2. Files changed

| File | Change |
|------|--------|
| `src/app/services/accountingService.ts` | Exclude voided in getAccountLedger (is_void filter on lines); idempotency checks only consider non-void JEs; getEffectiveJournalLinesForPayment excludes voided; JournalEntry.action_fingerprint; createEntry writes action_fingerprint |
| `src/app/services/accountingReportsService.ts` | getCashFlowStatement: fetch journal_entries with is_void false |
| `src/app/services/paymentAdjustmentService.ts` | action_fingerprint set for amount and account adjustment JEs |
| `src/app/services/saleAccountingService.ts` | action_fingerprint set for sale_adjustment JEs (postAdjustmentJE) |
| `src/app/services/accountingIntegrityService.ts` | **New** – getDuplicateCandidates, getOrphanCandidates, voidJournalEntries, voidDuplicateGroup, getIntegritySummary |
| `src/app/components/accounting/AccountingIntegrityTestLab.tsx` | **New** – Integrity Test Lab UI (duplicates, orphans, void actions) |
| `src/app/components/accounting/AccountingDashboard.tsx` | Tab “Integrity Test Lab” added; lazy load AccountingIntegrityTestLab |
| `migrations/pf145_backup_tables_and_fingerprint.sql` | **New** – backup_pf145_journal_entries, backup_pf145_journal_entry_lines; journal_entries.action_fingerprint; unique partial index |
| `docs/accounting/PF145_duplicate_classification.sql` | **New** – Classification/preview queries |
| `docs/accounting/PF145_backup_and_cleanup.sql` | **New** – Backup + void steps (commented) |
| `scripts/verify-pf145-integrity.sql` | **New** – Verification queries |

---

## 3. Idempotency logic

- **Application:** Before creating any sale_adjustment JE: `hasExistingSaleAdjustmentByDescription(companyId, saleId, description)`. Before payment amount JE: `hasExistingPaymentAmountAdjustment(companyId, paymentId, oldAmount, newAmount)`. Before payment account JE: `hasExistingPaymentAccountAdjustment(companyId, paymentId, oldAccountId, newAccountId, amount)`. All three only consider non-void rows.
- **Fingerprint:** On create, adjustment JEs set `action_fingerprint` to a deterministic string, e.g. `sale_adjustment:companyId:saleId:description`, `payment_adjustment_amount:companyId:paymentId:old:new`, `payment_adjustment_account:companyId:paymentId:oldAcc:newAcc:amount`.
- **Database:** After migration, unique partial index `idx_journal_entries_fingerprint_active` on (company_id, action_fingerprint) WHERE action_fingerprint IS NOT NULL AND is_void IS NOT TRUE prevents a second active JE with the same fingerprint.

---

## 4. Duplicate classification logic

- **Exact duplicate (bug):** Same company_id, reference_type, reference_id, and description; count > 1 among non-void. Treated as “keep earliest, void rest.”
- **Orphan/uncertain:** reference_type in (sale_adjustment, payment_adjustment), reference_id not null, but referenced sale or payment row missing. Treated as “void with reason, do not delete.”

---

## 5. Backup + cleanup

- **Backup tables:** `backup_pf145_journal_entries`, `backup_pf145_journal_entry_lines` (see migration). Optional: run INSERT from journal_entries for IDs to be voided before voiding.
- **Exact duplicates:** Void duplicates (rn > 1) per group; keep first. SQL in `PF145_backup_and_cleanup.sql` (commented).
- **Orphans:** Void with reason “PF-14.5B orphan (sale deleted)” or “(payment deleted)”. Same file.
- **Test Lab UI:** “Void duplicates” per group; “Void” / “Void all orphans” for orphans. No deletes.

---

## 6. Accounting Integrity Test Lab page

- **Location:** Accounting → tab “Integrity Test Lab”.
- **Content:** Summary cards (duplicate groups count, orphan count, voided count, active by type); table of duplicate candidates with “Void duplicates”; table of orphan entries with “Void” / “Void all orphans”; short ledger-impact note.
- **Actions:** Refresh, void per duplicate group, void single or all orphans. After void, business views (Journal, Day Book, Ledger) exclude those entries once refreshed.

---

## 7. Query / report filtering fixes

- **accountingService.getAllEntries:** Already filtered `is_void !== true`.
- **accountingService.getAccountLedger:** Selects `is_void` from journal_entries; filters out lines where `journal_entry.is_void === true`.
- **accountingService.getCustomerLedger:** Already used `linesToUse` excluding voided.
- **accountingService.hasExistingSaleAdjustmentByDescription / hasExistingPaymentAmountAdjustment / hasExistingPaymentAccountAdjustment:** Added `.or('is_void.is.null,is_void.eq.false')` so only non-void JEs count.
- **accountingService.getEffectiveJournalLinesForPayment:** Excludes voided JEs when aggregating lines.
- **accountingReportsService.getCashFlowStatement:** journal_entries fetch restricted to non-void.

---

## 8. Verification SQL

- `scripts/verify-pf145-integrity.sql`: (1) No duplicate sale_adjustment by (reference_id, description) among non-void; (2) No duplicate payment_adjustment among non-void; (3) Optional: no duplicate action_fingerprint among active; (4) Voided count by type; (5) Active JEs by type.

---

## 9. Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Journal Entries no longer shows repeated bug-generated rows for the same logical action | Met (voided excluded; idempotency + fingerprint prevent new duplicates) |
| 2 | Day Book no longer repeats the same transfer/action multiple times unless valid | Met (voided excluded from report queries) |
| 3 | Account Ledger running balance corrected, not polluted by duplicate rows | Met (getAccountLedger excludes voided) |
| 4 | Exact bug-generated duplicates backed up then removed | Backup tables and SQL provided; removal is void (not delete) per spec |
| 5 | Uncertain/orphan rows voided, not deleted | Met (Test Lab and SQL void with reason) |
| 6 | Valid original entries preserved | Met (keep earliest in duplicate group; no delete of valid rows) |
| 7 | Future duplicate creation blocked by idempotency | Met (hasExisting* + action_fingerprint + unique index) |
| 8 | Accounting Integrity Test Lab page exists for diagnosis and cleanup | Met (Integrity Test Lab tab) |

---

## 10. Applying on production

1. Run migration `migrations/pf145_backup_tables_and_fingerprint.sql` on Supabase (backup tables + action_fingerprint + index).
2. (Optional) Run classification preview: `docs/accounting/PF145_duplicate_classification.sql`.
3. (Optional) Backup candidate rows into backup tables (see `PF145_backup_and_cleanup.sql`).
4. Void duplicates and orphans via **Accounting → Integrity Test Lab** (or run the APPLY sections in `PF145_backup_and_cleanup.sql` after uncommenting).
5. Refresh Journal / Day Book / Ledger; run `scripts/verify-pf145-integrity.sql` to confirm no duplicate groups and expected voided counts.
