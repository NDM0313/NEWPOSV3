# COA runtime signoff — fix execution report

**Date:** 2026-04-05  
**Scope:** Narrow, traceable fixes + documentation from the COA **working signoff** pass.  
**Not in scope:** Design/Figma; Batch 5; destructive schema changes; legacy table drops.  
**Additive SQL shipped in-repo:** `migrations/20260405_gl_party_correction_reversal_and_unmapped_buckets.sql` (function **replace** + **GRANT** only) — apply per environment for G-PAR-02 RPC behavior.

---

## 1. Summary

| Item | Result |
|------|--------|
| **Runtime legacy-table paths in audited `src/`** | **None found** (`chart_accounts`, `ledger_master`, `ledger_entries` not used for queries) |
| **Fixes applied (code)** | **2** (initial pass) + **implementation passes** below + **G-PAR-02** (RPC + breakdown + COA copy) |
| **Docs created / updated** | `COA_WORKING_SIGNOFF.md`, `COA_GAP_ANALYSIS.md`, `STATEMENT_ENGINE_SIGNOFF.md`, `COA_BRANCH_PARITY_CHECKLIST.md`, `ACCOUNTING_WORKBENCH_CLICK_MATRIX.md`, `COA_QA_SIGNOFF.md`, `COA_UAT_RUNBOOK.md`, this file |

---

## 2. Fixes applied

### 2.1 Day Book export title (semantic bug)

- **File:** `src/app/components/reports/DayBookReport.tsx`  
- **Issue:** Export `title` was `Roznamcha (Day Book) …` while the report is **journal lines** (GL), not the Roznamcha cash book (`payments`). Mislabels PDF/Excel and violates the **Roznamcha vs Day Book** distinction.  
- **Change:** `title` → `Journal Day Book ${dateFrom} to ${dateTo}` with an inline comment.  
- **UI title** was already `Journal Day Book` via `ReportActions` — unchanged.

### 2.2 AddChartAccountDrawer documentation

- **File:** `src/app/components/accounting/AddChartAccountDrawer.tsx`  
- **Issue:** Component name suggests legacy `chart_accounts`; implementation uses **`chartAccountService` → `accountService` → `accounts`**.  
- **Change:** Module comment stating canonical persistence target (**no behavior change**).

### 2.3 Statement center + workbench (2026-04-05 implementation pass)

- **`src/app/lib/accounting/statementEngineTypes.ts`** — Shared `AccountingStatementMode` + labels for statement center.  
- **`src/app/components/reports/StatementScopeBanner.tsx`** — Period / branch scope / basis strip.  
- **`src/app/components/reports/AccountLedgerReportPage.tsx`** — **Worker Statement** (`getWorkerPartyGlJournalLedger`), **View** + **Edit** row actions (prefer `entry_no` for View), **Branch** column, export title includes scope, `branchScopeLabel` prop, `studioService` workers list.  
- **`src/app/components/accounting/AccountingDashboard.tsx`** — Account Statements period uses **global filter** dates when set; passes `branchScopeLabel`; journal table **Lines** + **Status** + **View** action.  
- **`src/app/services/accountService.ts`** — If `branch_id` filter fails (older schema), **retry without** branch OR clause.  
- **`src/app/components/accounting/AccountsHierarchyList.tsx`** — Clearer English **roll-up** microcopy + tooltip on parent balances.

### 2.4 Day Book branch scope (G-BR-02)

- **File:** `src/app/components/reports/DayBookReport.tsx`  
- **Issue:** Day Book loaded all `journal_entries` for the company in range with **no** branch predicate, unlike GL ledger / statements.  
- **Policy (explicit):** **Branch-aware**, using the **same rule as `accountingService.getAccountLedger`**: when the session branch is a specific UUID, include rows where `journal_entries.branch_id` is **null** (company-wide) **or** equals that branch; when branch is **all** / unset, show **all branches**.  
- **Change:** PostgREST `.or('branch_id.is.null,branch_id.eq.<uuid>')` when applicable; **Branch scope** UI strip; export **title** suffix (`All branches` vs `Selected branch + company-wide JEs`).

### 2.5 Customer / party statement vs journal reversal parity (G-REV-01, UAT blocker)

- **File:** `src/app/services/accountingService.ts`  
- **Root cause:** `getCustomerLedger` PHASE 3 only matched `sale`, `payment`, `manual_receipt`, `opening_balance_contact_ar`, etc. **`correction_reversal`** JEs (PF-07 manual reversal; `reference_id` = original `journal_entries.id`) **never matched**, so reversing AR lines were **dropped** while original receipt credits could remain → **running balance on Customer Statement disagreed with Journal Entries**.  
- **Fix:** Extract `arJournalLineMatchesCustomer(...)`; for `correction_reversal`, include the line if **any** line of the **original** JE would have matched the customer. Same pattern for **`getSupplierApGlJournalLedger`** (`supplierApJournalLineMatchesSupplier`) and **`getWorkerPartyGlJournalLedger`** (`workerGlLineMatchesWorker`). Customer ledger rows for reversals: **`document_type: Reversal`**, **`ledger_kind: 'reversal'`**.  
- **GL / single-account** statements use `getAccountLedger` and were already journal-complete; unchanged.

### 2.6 Contacts vs COA control / party GL basis (G-PAR-01)

- **Files:** `src/app/components/contacts/ContactsPage.tsx`, `src/app/components/accounting/ChartOfAccountsPartyDropdown.tsx`, `src/app/components/accounting/AccountingDashboard.tsx`  
- **Root cause (Contacts):** After `get_contact_party_gl_balances` loaded, **row and card totals** used **`Math.max(0, gl_ar)`** (and AP analog) while subtitles still said **Operational**. Summing only non-negative party slices **drops credit balances** on AR (e.g. walking customer / on-account), so **tab totals could exceed** GL control **1100** net — looks like “party breakdown > control”.  
- **Fix (Contacts):** **Primary** recv/pay = operational RPC / merged documents only. **Secondary** line (and violet **Party GL (signed, this tab)** on cards) = raw signed party GL for traceability. **Contacts vs GL** expandable strip now compares **operational** totals to TB (not the inflated mix).  
- **Root cause (COA inline parties):** Users compared **Related parties** list (party-attributed GL on control **code** from RPC) to the **COA balance** column without seeing **roll-up vs single account id** or **TB − party sum residual**.  
- **Fix (COA):** Party dropdown footer **Balance trace (GL)** when breakdown fetch completes: COA **row** balance (may include sub-account roll-up), **trial balance** on **this** control account id, **sum of party rows (signed)**, **residual**, plus note when row ≠ TB (child AR/AP accounts).

### 2.7 Control residual / party mapping parity (G-PAR-02)

- **Migration:** `migrations/20260405_gl_party_correction_reversal_and_unmapped_buckets.sql`  
  - **`_gl_resolve_party_id_for_journal_entry`** — single place for “which `contact_id` owns this JE’s party slice” (openings, sales/purchases, payments, worker/studio/rental paths).  
  - **`get_contact_party_gl_balances`** — for `reference_type = 'correction_reversal'` with UUID `reference_id`, party is resolved from the **referenced original** `journal_entries.id` (aligns party **balance** RPC with **G-REV-01** statement behavior).  
  - **`get_control_unmapped_party_gl_buckets`** — net on the **control code’s account id only** for lines where the resolver returns **NULL** `party_id`, grouped by `reference_type` (AR/1180: **Dr−Cr**; 2000/2010: **Cr−Dr**).

- **Files:**  
  - `src/app/services/controlAccountBreakdownService.ts` — **`partyAttributedGlSum`** = full Σ RPC column; **`unmappedGlResidual`** with correct AP liability sign; **`glSubtreeDrMinusCr`** = TB **Dr−Cr** summed for control **id + descendants**; **`unmappedGlByReference`** from new RPC.  
  - `src/app/components/accounting/ControlAccountBreakdownDrawer.tsx` — subtree line when subtree ≠ single-id TB; **unmapped-by-reference** table.  
  - `src/app/components/accounting/ChartOfAccountsPartyDropdown.tsx` — **`glParity`** uses service **`residualAmount`** (not raw TB − party in wrong sign for AP); copy for **direct control code vs subtree**.  
  - `src/app/components/accounting/AccountingDashboard.tsx` — passes breakdown fields into party dropdown.

- **Root causes addressed (conceptual, not tenant-specific):**  
  1. **Basis mismatch:** COA **display row** can **roll up** child accounts while **`get_contact_party_gl_balances`** posts only to the **resolved id** for codes **1100 / 2000 / 2010 / 1180** — residual and subtree lines make that explicit.  
  2. **Unmapped GL:** Any line on that control **account id** that the resolver cannot tie to a contact stays out of party sums → shows as **residual** and, after migration, as **reference_type buckets**.  
  3. **Reversal attribution:** Pre-migration RPC could attribute **`correction_reversal`** to the wrong party bucket vs statements — post-migration matches **original JE** party when `reference_id` is a UUID.

- **`accountingService.ts` (G-REV-01):** Unchanged in this phase; statement rows for reversals remain app-side; RPC is aligned for **aggregated party balances** only.

---

## 3. What was already correct

- **COA list** driven from **`accounts`** via `AccountingContext` / `accountService`.  
- **Day Book** queries **`journal_entries`** + **`journal_entry_lines`** + embedded **`accounts`**.  
- **Roznamcha** uses **`payments`** + **`accounts`** (`roznamchaService`).  
- **Trial Balance** uses **`accountingReportsService`** (canonical GL).  
- **Worker** paths use **`worker_ledger_entries`**, not legacy **`ledger_entries`**.  
- **`accountingCanonicalGuard`** continues to block legacy table names as UI truth in dev.

---

## 4. What was broken (before fixes)

| ID | Description | Severity |
|----|-------------|----------|
| B1 | Mislabeled **Day Book** export title as Roznamcha | **Medium** (trust / reconciliation confusion) |
| B2 | **Naming/documentation** drift on AddChartAccountDrawer | **Low** (maintainer / audit confusion) |

---

## 5. What still remains

See **[COA_GAP_ANALYSIS.md](./COA_GAP_ANALYSIS.md)** — notably parent balance **interpretation**, **interactive branch** parity QA, unified **statement** UX, and full **edit** click-matrix. **G-BR-02** and **G-REV-01** (party statement reversals) are **closed in code**; human UAT should re-verify customer statement vs journals after deploy. **G-PAR-02** improves **explainability** of TB vs party sum vs residual; **G-PAR-02b** (§11) closes resolver gaps that inflated the **payment** unmapped bucket. **Tenant-specific** numeric cells for named parties are **not** stored in this repo — use §9 after applying **both** SQL files in §11.

---

## 6. COA readiness gate (this pass)

| Status | **PARTIALLY READY** |
|--------|----------------------|
| Rationale | Canonical **code paths** verified; statement center + branch fallback + COA roll-up copy + journal columns shipped; **no** full production E2E or numeric reconciliation run in this pass. |

**Not:** READY FOR DESIGN POLISH — [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md) records **interactive manual QA not executed**. **G-BR-02** is fixed in code; human browser QA still required before certifying design polish.

---

## 7. Batch 5

**NOT APPROVED** — no destructive DB work in this pass.

---

## 8. Before vs after (G-PAR-02 behavior)

| Topic | Before | After |
|-------|--------|--------|
| **`get_contact_party_gl_balances` + reversals** | Party for **`correction_reversal`** could follow resolver on the **reversal** JE, diverging from **G-REV-01** “original party” intent | With migration applied: UUID **`reference_id`** → party from **original** JE |
| **Residual** | Shown as a single unexplained gap vs party list | **Residual** = TB on control **id** (AR **Dr−Cr**, AP net **Cr−Dr**) minus **full Σ** party column; optional **subtree TB** when children carry balance |
| **Unmapped volume** | Not broken out by driver | **`get_control_unmapped_party_gl_buckets`** + UI table (top buckets in COA party footer / drawer) |
| **COA party footer** | Easy to confuse **row roll-up** with **single-account TB** or **code-only party slice** | Copy + **`glParity`** fields: **`controlCodeLabel`**, **`subtreeTrialBalanceDrMinusCr`**, **`partyAttributedSumFull`**, **`residualAmount`**, **`unmappedTop`** |
| **AP residual sign** | Risk of comparing **Dr−Cr** TB to **Cr−Dr** party sums incorrectly in UI | **`residualAmount`** taken from breakdown service (AP uses **Cr−Dr** net for residual) |

---

## 9. Sample reconciliation template (per party — fill from live tenant)

**Do not treat the following as populated numbers.** After **`20260405_…`** and **`20260406_gl_party_resolve_payment_via_sale_purchase.sql`** are applied (see §11), fill one row per contact from Contacts (operational RPC), party GL RPC, and party statements. Optional SQL helpers: [sql/G_PAR02_live_tie_out_queries.sql](./sql/G_PAR02_live_tie_out_queries.sql).

| Party | `contact_id` | Operational due (primary on Contacts) | Signed party GL (`get_contact_party_gl_balances` column) | Δ (op − GL) | Opening (`opening_balance_*` JEs / `contacts.opening_balance`) | Manual / other GL (`reference_type` on account statement) | `correction_reversal` (net on party statement) | Child-account effect (if any AR/AP posted under non-code child id) | Notes |
|-------|----------------|----------------------------------------|------------------------------------------------------------|-------------|----------------------------------------------------------------|------------------------------------------------------------|-----------------------------------------------|----------------------------------------------------------------------|-------|
| Ali | | from `get_contact_balances_summary` | `gl_ar_receivable` / `gl_ap_payable` / worker columns | | filter GL by type | e.g. `manual_journal`, blank | must appear when reversing party-linked originals (G-REV-01) | compare subtree TB to code **1100** line TB | |
| Mushtaq | | | | | | | | | |
| ABC | | | | | | | | | |
| Khuram | | | | | | | | | |
| Worker (pick mismatch) | | worker operational if shown | `gl_worker_payable` / advance column | | worker opening types | studio / worker payment types | same reversal rule | **2010** / **1180** code-only vs subtree | |

**Control-account level (AR / AP / worker payable / advance):** use **Accounting →** control breakdown drawer: TB **id**, **subtree**, **Σ party RPC**, **residual**, **unmapped buckets**. For **worker payable vs advance**, remember **net worker** in RPC vs **2010-only** unmapped are different questions — see breakdown notes in `controlAccountBreakdownService.ts`.

---

## 10. Files checked / changed (G-PAR-02 audit trail)

**Inspected or touched for this phase:** `migrations/20260405_gl_party_correction_reversal_and_unmapped_buckets.sql`, `migrations/20260406_gl_party_resolve_payment_via_sale_purchase.sql`, `src/app/services/controlAccountBreakdownService.ts`, `src/app/components/accounting/ControlAccountBreakdownDrawer.tsx`, `src/app/components/accounting/ChartOfAccountsPartyDropdown.tsx`, `src/app/components/accounting/AccountingDashboard.tsx`, plus existing **`ContactsPage.tsx`** / **`accountingService.ts`** behavior verified unchanged for G-PAR-01 / G-REV-01 primary paths.

---

## 11. G-PAR-02b — live “payment” bucket root cause and resolver fix (2026-04-06)

### 11.1 Migration application status (this repository session)

**Not verified against a live Supabase project from the agent environment** (no project DB credentials in workspace). To confirm both migrations are applied, run in SQL Editor:

```sql
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('_gl_party_id_from_payment_row', 'get_control_unmapped_party_gl_buckets');
```

Expect **two** rows after full apply (`_gl_party_id_from_payment_row` only exists after **`20260406`**).

### 11.2 Root cause traced in code (matches observed “payment” top unmapped bucket)

| Topic | App / statement behavior (`accountingService.ts`) | Pre-20260406 SQL resolver (`_gl_resolve_party_id_for_journal_entry` in 20260405 file) |
|--------|-----------------------------------------------------|----------------------------------------------------------------------------------------|
| **`reference_type = payment`** | Matches customer when **`paymentIds.includes(reference_id)`** — payments tied to customer **sales** even if `payments.contact_id` is **NULL** | Only **`payment_id → payments.contact_id`**. If **`payment_id` NULL** or **`contact_id` NULL**, **`party_id` NULL** → lines bucket as **`payment`** in **`get_control_unmapped_party_gl_buckets`**. |
| **`manual_payment` JE** (`addEntryV2Service` supplier pay) | `reference_id` = **`payments.id`**; supplier on **`payments.contact_id`** | Treated **`reference_id` as `contact_id`** (wrong UUID class) → mis- or non-attribution. |

After **`20260406`**, resolver uses **`_gl_party_id_from_payment_row`**: **`COALESCE(contact_id, customer_id via sale, supplier_id via purchase, worker id via worker_payment types)`** for **`payment` / `payment_adjustment`**, **`journal_entries.payment_id`**, and **`manual_payment`** (UUID-shaped `reference_id`).

### 11.3 Residual vs party sum (your live example shape)

With **party sum > control TB** (e.g. **209k** vs **133k**, residual **−76k**), remaining drivers after resolver fix may include: **subtree vs code-only** (AR on child accounts not rolled into code **1100** id), **double party attribution** (investigate duplicate payment JEs per `accountingService` dedupe rules vs raw GL), and **true unmapped** types still **NULL** after resolver (e.g. **`expense`** JEs hitting **1100**, manual journals). Use breakdown **subtree** line + unmapped table + commented SQL in [sql/G_PAR02_live_tie_out_queries.sql](./sql/G_PAR02_live_tie_out_queries.sql).

### 11.4 Files added / changed (this pass)

| File | Role |
|------|------|
| `migrations/20260406_gl_party_resolve_payment_via_sale_purchase.sql` | Resolver fix (non-destructive) |
| `docs/accounting/sql/G_PAR02_live_tie_out_queries.sql` | Verification / tie-out query stubs |

### 11.5 Before vs after (resolver)

| Case | Before 20260406 | After 20260406 |
|------|-----------------|----------------|
| Sale-linked receipt, **`contact_id` null**, JE has **`payment_id`** | Often **unmapped** | Party from **`sales.customer_id`** via **`payments.reference_id`** |
| **`reference_type=payment`**, **`reference_id=payment id`**, **`payment_id` null** | **Unmapped** | Party from payment row same as above |
| **`manual_payment`**, **`reference_id=payment id`** | Wrong (UUID as contact) | Party from payment row |

### 11.6 Final status (numeric tie-out deliverable)

| Gate | Verdict |
|------|---------|
| **G-PAR-02 live tie-out** | **PARTIAL** — root causes documented; **20260406** implements real mapping fix; **per-party Rs table** must be filled in tenant (not in repo). |
| **READY FOR DESIGN POLISH** | **NO** — same as [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md); human UAT + post-migration numeric confirmation still required. |

---

## 12. AP + worker control parity (post-AR live proof) — 2026-04-06

### 12.1 Files checked (this verification pass)

`migrations/20260405_gl_party_correction_reversal_and_unmapped_buckets.sql` (`ap_agg`, `wp_agg`, `wa_agg`, `wk`, `get_control_unmapped_party_gl_buckets`), `migrations/20260406_gl_party_resolve_payment_via_sale_purchase.sql` (`_gl_party_id_from_payment_row` purchase + worker branches), `src/app/services/controlAccountBreakdownService.ts` (AP / worker breakdown), `src/app/components/accounting/AccountingDashboard.tsx` (`coaPartyFetch` → `fetchControlAccountBreakdown`), `src/app/components/accounting/ChartOfAccountsPartyDropdown.tsx`, `src/app/services/supplierPaymentService.ts` (supplier JE `reference_type` / `payment_id`), `src/app/services/accountingService.ts` (supplier AP line matching + G-REV-01), `docs/accounting/sql/G_PAR02_live_tie_out_queries.sql`.

### 12.2 Live findings (Rs amounts)

| Control | Live Rs from this session? | Notes |
|---------|----------------------------|--------|
| **1100 AR** | **Yes — user-reported** | COA: control **133,000**; parties **Mushtaq 75,000**, **Ali 58,000**; party sum **133,000**; residual **0.00** (interpretation: **20260405** + **20260406** applied; AR tie-out **PASS** for that tenant snapshot). |
| **2000 AP** | **No** | Not queried from agent environment. **Code:** same `_gl_resolve_party_id_for_journal_entry` + **`_gl_party_id_from_payment_row`** (purchase → `supplier_id`) as AR; breakdown computes **`unmappedGlResidual`** = AP net (Cr−Dr) on **2000** − Σ **`gl_ap_payable`**. **Expected:** parity similar to AR after migrations; confirm in COA + SQL §5 [G_PAR02_live_tie_out_queries.sql](./sql/G_PAR02_live_tie_out_queries.sql). |
| **2010 Worker payable** | **No** | Not queried from agent environment. **RPC:** `gl_worker_payable` = **`GREATEST(0, WP_net − WA_net)`** per party (`get_contact_party_gl_balances` `wk` CTE) — **not** “2010 TB only”. **UI:** COA party panel shows **Σ party worker net**; **`unmappedGlResidual` is null** in `controlAccountBreakdownService` (residual vs TB not defined like AR/AP). **Unmapped buckets** = **2010** lines with null party (Cr−Dr). |
| **1180 Worker advance** | **No** | Same as 2010 for party list basis (RPC worker net on contact row). **Unmapped buckets** = **1180** only (Dr−Cr). Per-party **1180-only** split not in RPC. |

### 12.3 Residual zero / non-zero (reported vs expected)

| Account | Residual in COA trace | Finding |
|---------|------------------------|---------|
| **1100** | **0.00** (user) | **PASS** for reported snapshot. |
| **2000** | Unknown | **PARTIAL** until tenant confirms: expect ≈0 when party sum matches AP net on **2000** id and no unmapped lines. |
| **2010** | Not computed in footer | **PARTIAL** — by design in service; compare **2010 TB**, **subtree**, **unmapped 2010 buckets**, and **worker net** list separately (drawer). |
| **1180** | Not computed in footer | **PARTIAL** — same as 2010. |

### 12.4 Root cause of any worker/AP “mismatch” (code-level, not invented data)

1. **Worker party column ≠ single-account TB:** RPC **`gl_worker_payable`** blends **2010 and 1180** per party with a **non-negative** net — COA **Trial balance on 2010** (or **1180**) will not generally equal Σ party line on that row.  
2. **Supplier payments:** `supplierPaymentService` posts JEs with **`reference_type`** **`purchase`** or **`on_account`** and **`payment_id`** set — resolver attributes via **purchase** path or **`_gl_party_id_from_payment_row`**, consistent with **`supplierApJournalLineMatchesSupplier`**.  
3. **Reversal end-to-end:** **`ap_agg` / `wp_agg` / `wa_agg`** in **`get_contact_party_gl_balances`** use the same **`correction_reversal` → original JE** party resolution as AR. **G-REV-01** in **`accountingService`** remains the statement source of truth; **re-test** one supplier + one worker reversal in the browser (not run in repo session).

### 12.5 Contacts cross-check (ABC, Khuram, one worker)

**Not executed in agent session** (no live Contacts export). Procedure: for each name, open **Contacts** — primary **operational** vs second-line **signed party GL**; for suppliers use **`gl_ap_payable`** row; for workers use **`gl_worker_payable`**; mismatches → party statement + `reference_type` on GL.

### 12.6 Code change (this pass)

`ChartOfAccountsPartyDropdown.tsx` — for control codes **2010** / **1180**, Balance trace copy now states **Σ party worker net (WP−WA)** and explains why **residual vs TB** is not computed on that panel (avoids false AR/AP-style comparison).

### 12.7 Status lines (required)

| Gate | Verdict |
|------|---------|
| **AR control parity** | **PASS** — on **user-reported** live snapshot (§12.2). |
| **AP control parity** | **PARTIAL** — **RPC + app path symmetric to AR** in code; **live 2000 Rs** not confirmed in this session. |
| **Worker control parity** | **PARTIAL** — **definitions differ** from AR/AP (WP−WA net, no single residual line); buckets per code still available. |
| **READY FOR DESIGN POLISH** | **NO** — full interactive signoff still outstanding ([COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md)). |

---

## 13. Supplier payment row labels + supplier statement balance (2026-04-06)

### 13.1 Root cause — journal / Day Book account text (ISSUE A)

| Finding | Detail |
|---------|--------|
| **Journal list** | `AccountingContext.convertFromJournalEntry` took **first** debit/credit line but read `account?.name` without normalizing PostgREST **array** embeds and without **code**; it did not use **`payments → contacts`** or **`purchases → supplier`** for party context on AP/AR lines. |
| **Workbench column** | `AccountingDashboard` showed `entry.debitAccount` / `creditAccount` (short stable names) without **display** strings. |

### 13.2 Root cause — Khuram / supplier statement (ISSUE B)

| Finding | Detail |
|---------|--------|
| **Extra filter** | `AccountLedgerReportPage` **sortedEntries** dropped rows when `payment_id` was set and **`payments.contact_id`** (from embed) was **non-empty and ≠ selected supplier**, even though **`getSupplierApGlJournalLedger`** had already included the line via **purchase-linked** `payments` (where `contact_id` can be missing or inconsistent). That removed AP lines from the **table** while the user expected full party GL. |
| **Opening row vs summary** | Summary **opening/closing** was derived from **filtered** `presentedEntries`; **Opening Balance (AP GL)** could be removed by module/polarity filters, so **cards disagreed** with the running-balance column. |

### 13.3 Files changed

| File | Change |
|------|--------|
| `src/app/lib/journalEntryAccountLabels.ts` | **New:** embed normalization, **Name (code)** labels, AP/AR **party suffix**, multi-line compact summary. |
| `src/app/services/accountingService.ts` | **`getAllEntries`:** batch **`_payment_contact_name`** and **`_purchase_supplier_name`** for journal → context conversion. |
| `src/app/context/AccountingContext.tsx` | **`debitAccountDisplay` / `creditAccountDisplay`**, **`journalLinesSummary`** metadata, **`partyForContext`**, **`manual_payment` → Purchase** for module grouping. |
| `src/app/components/accounting/AccountingDashboard.tsx` | Account column uses **display** strings; **grouped** union with **+N more**; primary picker prefers **on_account** / **manual_payment**. |
| `src/app/components/reports/DayBookReport.tsx` | Embed **account code**; show **Name (code)** per line. |
| `src/app/components/reports/AccountLedgerReportPage.tsx` | **Always retain** opening-balance rows through filters; **remove** erroneous **customer/supplier/worker** `payment.contact_id` hard guard; supplier **basis** banner documents single engine. |

### 13.4 Before → after

| Area | Before | After |
|------|--------|--------|
| JE-0077-style row | Generic **Accounts Payable → Bank** when embed/party missing | **Leaf name + code** from `journal_entry_lines` / `accounts`; **AP/AR — party** when payment or purchase supplier is known |
| Day Book | Account name only | **Name (code)** |
| Supplier statement | Risk of dropped purchase-linked payment lines; summary could omit opening | Full **`getSupplierApGlJournalLedger`** row set in table; opening row **immune** to filters; banner states **AP GL single basis** |

### 13.5 Verification (live)

Re-check **Journal Entries** and **Supplier statement** for Khuram after deploy; **G-REV-01** / AP RPC parity **unchanged** (no resolver edits).

### 13.6 Status (this deliverable)

| Gate | Verdict |
|------|---------|
| **Journal row account specificity** | **PASS** (code shipped; live confirm on tenant). |
| **Supplier statement balance consistency** | **PASS** (logic fix shipped; live confirm). |
| **Operational vs GL on supplier statement** | **N/A split** — Account Statements **supplier** mode is **AP GL only**; banner documents that (no fake “operational” engine on that screen). |
| **READY FOR DESIGN POLISH** | **NO** |
