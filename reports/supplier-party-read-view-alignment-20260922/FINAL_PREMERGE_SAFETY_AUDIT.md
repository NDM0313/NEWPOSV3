# Final pre-merge safety audit — supplier party read-view alignment

**Verdict:** `SUPPLIER_READ_VIEW_PREMERGE_SAFETY_PASS`  
**Recommendation (not executed):** `SAFE_TO_PREPARE_MAIN_MERGE` / next action `PREPARE_MAIN_MERGE`

**Mode:** READ-ONLY discovery. No merge, no deploy, no DB mutations.

| Item | SHA / value |
|------|-------------|
| `origin/main` | `554a12ca004236a6818e570b22ec0dd2a106c3c1` |
| Feature tip `origin/feat/supplier-party-read-view-alignment` | `69ad37452b57250459e5a5a115b44e0adbf219ee` |
| Local HEAD (matches tip) | `69ad37452b57250459e5a5a115b44e0adbf219ee` |
| Deployed product SHA (erp-frontend / VPS repo at audit) | `f414e4102e63ad8a2dc4fed952749c83ea8225a3` |
| Paging fix `f414e410` included in feature tip | **YES** (ancestor of `69ad3745`) |
| Commits on feature not in main | **12** |
| Migrations in branch | **0** |
| Database mutations this audit | **0** |
| Deploy this audit | **NO** |
| Main merge this audit | **NO** |
| Graphify touched | **NO** (`stash@{7}: On main: graphify root` untouched) |

---

## 1. Git state (HOME)

```
BRANCH=feat/supplier-party-read-view-alignment
HEAD=69ad37452b57250459e5a5a115b44e0adbf219ee
ORIGIN_MAIN=554a12ca004236a6818e570b22ec0dd2a106c3c1
ORIGIN_FEAT=69ad37452b57250459e5a5a115b44e0adbf219ee
status: clean (no staged/unstaged product edits for this audit write-up until evidence commit)
```

Stashes present (not popped): includes `stash@{7}: On main: graphify root` and older WIPs. **Not touched.**

---

## 2. Branch vs main — changed-file classification

`git diff --name-status origin/main...origin/feat/supplier-party-read-view-alignment` → **30 files**, **+2641 / −67**.

| Class | Files |
|-------|--------|
| **A. Supplier Business GL / statement** | `src/app/lib/supplierBusinessGl.ts` (new + paging); `src/app/lib/arifSupplierBusinessStatementPilot.ts`; `AccountLedgerReportPage.tsx`; `LedgerStatementCenterV2Page.tsx`; `LedgerTable.tsx`; `types.ts` |
| **B. Contacts GL** | `ContactsPage.tsx` |
| **C. Customers & Suppliers** | `customersSuppliersReportService.ts` |
| **D. Balance Basis Guide dual-basis** | `BalanceBasisGuidePage.tsx`; `balanceBasisGuideLogic.ts`; `balanceBasisGuideReportService.ts` |
| **E. Tests** | `supplierBusinessGl.node.test.ts`; `arifSupplierBusinessStatementPilot.node.test.ts`; `balanceBasisGuideLogic.test.ts` |
| **F. Evidence/docs** | All under `reports/arif-*`, `reports/database-safety-backup-20260922/`, `reports/supplier-party-read-view-alignment-20260922/*` |
| **G. Unrelated / suspicious** | **none (0)** |

**Unrelated-file count in feature vs main: `0`.**

### Key path confirmation

| Path | Role in branch |
|------|----------------|
| `supplierBusinessGl.ts` | Shared attribution map; **`fetchInBatches` + `LINE_PAGE` range paging from `f414e410` present** |
| `AccountLedgerReportPage.tsx` / LSC v2 | Business History view wiring (read-only) |
| `ContactsPage.tsx` | Business GL overlay for suppliers |
| `customersSuppliersReportService.ts` | Due/Advance from Business GL map |
| `balanceBasisGuide*` | Official AP labels + Business GL column; Control AP math unchanged |

No `migrations/*.sql` in the feature range.

---

## 3–4. Global −35,730 and per-company GL

### Global fingerprint (same query family as deploy PRE/POST)

| Scope | JE (distinct with lines) | Lines | Σ debit | Σ credit | Dr−Cr |
|-------|--------------------------|-------|---------|----------|-------|
| All lines joined to JE | 6531 | 13471 | 1,562,982,132.08 | 1,563,017,862.08 | **−35,730.00** |
| JE header count | 6536 | — | — | — | — |
| Non-void joined | 6357 | 13105 | 1,430,969,213.08 | 1,430,982,833.08 | −13,620.00 |

- Orphan lines (no JE): **0**
- Empty JEs (header, no lines): **5** (all DIN BRIDAL; do not affect Σ debit/credit)

**Σ of per-company ALL diffs = −35,730.00** (exact).

### Per-company (see `FINAL_PREMERGE_SAFETY_AUDIT_COMPANY_GL.csv`)

| Company | Non-void Dr−Cr | All (incl void) Dr−Cr |
|---------|----------------|------------------------|
| **DIN COLLECTION** | **0.00** | **0.00** |
| DIN COUTURE | 0.00 | 0.00 |
| DIN CHINA | 0.00 | **+190.00** |
| DIN BRIDAL | **−13,620.00** | **−35,920.00** |

### Exact −35,730 root cause (proven arithmetic)

| Component | Sum of per-JE (Dr−Cr) |
|-----------|------------------------|
| DIN BRIDAL active unbalanced JEs (2) | **−13,620.00** |
| DIN BRIDAL void unbalanced JEs (5) | **−22,300.00** |
| DIN CHINA void unbalanced JE (1) | **+190.00** |
| **Total** | **−35,730.00** |

**Affects DIN COLLECTION?** **NO** — DIN COLLECTION Dr = Cr for both non-void and all-incl-void scopes.

**Cause class:** `ACTUAL_UNBALANCED_JE` on **DIN BRIDAL** (2 active sales + 5 void sales with `void_reason=rebuild_sale_document_accounting`) and **DIN CHINA** (1 void `purchase_reversal` orphan single-line).  
Not `CROSS_COMPANY_QUERY_SCOPE` (company sums add to global). Not introduced by this feature (PRE==POST on deploy already proved immutability; these JEs predate / sit outside DIN COLLECTION golden).

Full JE list: `FINAL_PREMERGE_SAFETY_AUDIT_UNBALANCED_JE.csv`.

| Metric | Count |
|--------|-------|
| Unbalanced **active** JE | **2** (both DIN BRIDAL) |
| Unbalanced **void** JE | **6** (5 BRIDAL + 1 CHINA) |
| Unbalanced JE on DIN COLLECTION | **0** |

**No repair performed.**

---

## 5. DIN COLLECTION golden recheck (READ ONLY)

| Check | Result |
|-------|--------|
| ARIF contact | `SUP-ZHD-0017` / supplier / `21e1ac76-…` |
| Raw `210017` Cr−Dr (non-void) | **39,937.00** (24 lines) |
| ARIF Official AP (AP-/2000 linked) | **0.00** |
| Control AP family (2000 + AP-*) | **−2,283,810.00** (unchanged vs dual-basis deploy evidence) |
| CLEAN_AP ALAM `SUP-ZHD-0149` Official AP leaf | **1,105,100.00** on `AP-SUPZHD0149` (matches prior BBG Business = Official UI) |
| Workers / couriers in contacts | 5 worker, 2 courier — Business GL column is role-gated to `—` in UI (verified prior deploy; types present) |

DIN COLLECTION GL fingerprint (all incl void): **Dr 875,502,523.57 / Cr 875,502,523.57 / diff 0.00**.

---

## 6. VPS dirty-artifact classification (document only — no delete/reset/stash)

VPS `/root/NEWPOSV3` at audit: branch `feat/supplier-party-read-view-alignment`, **HEAD=`f414e410`** (deployed product; tip docs `69ad3745` not required on VPS for runtime).

| Path pattern | Class |
|--------------|--------|
| `deploy/backup-page/default.conf`, `index.html` (modified) | **OLD_PRODUCTION_ARTIFACT** (local VPS dirty; not in feature vs main diff) |
| `20260922160000_final_party_role_bs_closeout_din_collection.sql` | **UNTRACKED_MIGRATION_REFERENCE** |
| `accountingReportsService.ts` (repo root) | **TEMP_SCRIPT** / stray copy |
| `deploy/apply-phase-f-*`, `deploy/phase-f-*.sql` | **OLD_PRODUCTION_ARTIFACT** |
| `erp-mobile-app/src/context/FiscalYearContext.tsx`, `localMutationSuppression.ts` | **UNKNOWN** (untracked mobile WIP) |
| `migrations/repair-sl-*.sql`, `sync-sl-*.sql` | **UNTRACKED_MIGRATION_REFERENCE** |
| `reports/single-core-ledger/tieout-*.json` | **OLD_PRODUCTION_ARTIFACT** |
| `scripts/diagnostics/*`, `scripts/single-core-ledger/*`, `scripts/sql/*` | **TEMP_SCRIPT** / historical ops |
| `src/app/*.tsx` / `src/app/*.ts` untracked flat copies (AccountLedgerPage, AccountingDashboard, …) | **OLD_PRODUCTION_ARTIFACT** (stray copies outside normal `components/` tree; **not** in feature branch diff) |
| Graphify | **GRAPHIFY** — stash only on HOME; not modified |

**None of the above are part of `origin/main...origin/feat` product commit set.** Do not commit them with merge prep.

---

## 7. Backup reference

| Item | Status |
|------|--------|
| VPS path `/root/backups/newposv3/20260922-191921/` | **EXISTS** — full dump, globals, schema, fingerprints, `SHA256SUMS.txt`, `RESTORE_COMPARE_RESULT.txt` = **`PASS`** |
| Full dump SHA-256 | `207d0197bf9c2732a1d73059311038fb2097693792278b570614db3136a418fb` |
| Evidence doc | `reports/database-safety-backup-20260922/DATABASE_BACKUP_AND_RESTORE_VERIFY.md` + `DATABASE_BACKUP_REFERENCE.md` → `DATABASE_BACKUP_RESTORE_VERIFIED_PASS` |
| Off-host `C:\ERP_BACKUPS\NEWPOSV3\20260922-191921\` | Documented in prior PASS; **not re-mounted on this Mac HOME** this audit (path absent). VPS restore PASS remains authoritative. |
| Recreate backup | **NOT DONE** (existing verified) |

---

## 8. Recommendation

| Gate | Result |
|------|--------|
| Feature vs main scope | Product + docs/tests only; **0 unrelated files** |
| DIN COLLECTION balanced | **YES** |
| −35,730 explained | **YES** — DIN BRIDAL + DIN CHINA unbalanced JEs; **not DIN COLLECTION**; **not this feature** |
| Migrations / DB mutations | **NONE / 0** |
| Backup gate | **PASS** (VPS) |

**`SAFE_TO_PREPARE_MAIN_MERGE`**

Do **not** merge or deploy in this audit. Separate owner step for merge prep.

---

## Explicit non-actions this audit

- No `main` merge  
- No deploy  
- No JE / account / contact repair  
- No stash pop / reset / clean on VPS or HOME  
- No Graphify update  
- No force push  
