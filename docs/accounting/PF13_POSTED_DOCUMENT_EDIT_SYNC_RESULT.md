# PF-13 — Posted Document Edit Sync / Repost Integrity — Execution Result

**Date:** 2026-03-17  
**Scope:** ONE ISSUE ONLY. Accounting FROZEN.  
**Primary target:** NEW BUSINESS `c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee`  
**OLD BUSINESS:** `eb71d817-b87e-4195-964b-7b5321b480f5`

---

## 1. Root cause

- **Sale edit:** When a **posted (final) sale** was edited (total, subtotal, discount, or items), the frontend and `sales` table were updated but **no accounting repost** ran. The journal entry for that sale (reference_type=`sale`, reference_id=sale_id) was left unchanged, so COA, Trial Balance, P&amp;L, and any report driven by `journal_entry_lines` continued to show **old** amounts. Ledger/reports were therefore out of sync with the edited document.
- **Purchase edit:** PF-02 already implemented a repost (delete existing purchase JEs, then post new JE + supplier ledger reversals and new entries). No code change was required for purchase; the existing flow removes the old JE and posts the new one.

---

## 2. Fix: code-level only (no company-scoped data repair)

- Fix is **code-level only**.
- No company-specific SQL or data repair was applied.
- No schema changes.

---

## 3. What was applied on NEW BUSINESS ID

- **No direct data or SQL was run against NEW BUSINESS.**  
- The only change is in application code (SalesContext). After deployment, any **future** edit of a posted sale (with financial field changes) will trigger the new repost flow for that company (including NEW BUSINESS).

---

## 4. Files changed

| File | Change |
|------|--------|
| `src/app/context/SalesContext.tsx` | Added PF-13 sale edit repost: (1) `accountingRepostNeeded` when sale is final and total/subtotal/discount/items change; (2) after DB update, delete existing JEs with reference_type=`sale` and reference_id=sale_id; (3) create new sale JE (AR + Sales Revenue) from updated sale; (4) dispatch `accountingEntriesChanged` for UI refresh. |
| `scripts/verify-pf13-repost-integrity.sql` | New verification script: duplicate sale/purchase JE check and TB balance for NEW and OLD business. |
| `docs/accounting/PF13_POSTED_DOCUMENT_EDIT_SYNC_RESULT.md` | This result document. |

---

## 5. SQL/scripts run

- **No SQL was executed** during this fix (code-only change).
- **Verification script added:** `scripts/verify-pf13-repost-integrity.sql`.  
  Run on VPS:  
  `docker exec -i supabase-db psql -U postgres -d postgres -f - < scripts/verify-pf13-repost-integrity.sql`  
  Or run the same queries in Supabase SQL Editor / your DB client for NEW and OLD company_id.

---

## 6. What data changed on NEW BUSINESS ID

- **Nothing.** No rows were inserted/updated/deleted on NEW BUSINESS by this change.  
- After deployment, editing a **posted sale** and changing total/subtotal/discount/items will cause the app to delete the old sale JE and create a new one, so data will change only when users perform such edits.

---

## 7. Verification result before vs after (NEW BUSINESS)

- **Before:** Editing a final sale (e.g. total or items) left the existing sale JE unchanged → COA/reports showed old amounts.  
- **After (with new code):** Editing a final sale with financial changes triggers: (1) delete of all JEs with reference_type=`sale` and reference_id=that sale; (2) creation of one new sale JE with updated total/AR/Revenue. COA and reports (which read from `journal_entry_lines`) will show the new amounts.  
- **To confirm on NEW BUSINESS:** Run `scripts/verify-pf13-repost-integrity.sql` and ensure: `SALE_JE_DUPLICATES_NEW` = 0, `PURCHASE_JE_DUPLICATES_NEW` = 0, `TB_DIFF_NEW` ≈ 0. Then perform acceptance test: create one posted sale → edit a financial field → confirm one sale JE for that sale and TB/COA updated.

---

## 8. Verification result before vs after (OLD BUSINESS)

- **Before:** Same as NEW (sale edit did not repost). Purchase edit already had PF-02 repost.  
- **After:** Same code path; no intentional behavior change for OLD BUSINESS. Sale edit will now repost; purchase edit unchanged.  
- **To confirm on OLD BUSINESS:** Run the same verification script; expect `SALE_JE_DUPLICATES_OLD` = 0, `PURCHASE_JE_DUPLICATES_OLD` = 0, `TB_DIFF_OLD` ≈ 0. No regression expected.

---

## 9. Fresh test result (acceptance test)

- **Manual test (after deploy):**  
  1. Create one posted document (e.g. final sale with total &gt; 0).  
  2. Edit a financial field (e.g. total or discount).  
  3. Confirm: (a) old sale JE removed (only one JE per sale, with new amounts); (b) new JE posted; (c) ledger/COA/report values updated; (d) no duplicate or stale sale JEs for that sale_id.  
- **Automated:** Use `scripts/verify-pf13-repost-integrity.sql` after test edits to ensure no duplicate sale/purchase JEs and TB still balances.

---

## 10. Remaining exception (if any)

- **Payment JEs:** When a user edits both **total** and **paid** on a sale, this fix reposts only the **sale** JE (AR + Sales Revenue). Payment JEs (reference_type=`payment`) are separate and are not deleted or reposted by PF-13. If payment amount is updated via the existing payment sync (e.g. updatePayment), payment posting is handled elsewhere. If in your flow payment JEs are created per sale and must be adjusted when the sale is edited, that can be a follow-up (e.g. repost payment JEs when paid amount changes).

---

## 11. Exact next step

1. **Deploy** the updated `SalesContext.tsx` (and any bundled assets) to the environment where NEW and OLD business are used.  
2. **Run** `scripts/verify-pf13-repost-integrity.sql` for NEW and OLD company_id and keep the results.  
3. **Perform** the acceptance test: create posted sale → edit financial field → verify one sale JE, updated COA/ledger/reports, no duplicate/stale rows.  
4. If payment JEs need to stay in sync when paid amount is edited, implement a separate repost or adjustment path for payment JEs (same pattern: find by reference, remove old effect, post new).
