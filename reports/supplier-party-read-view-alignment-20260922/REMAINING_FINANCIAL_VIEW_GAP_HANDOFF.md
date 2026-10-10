# Remaining Financial View Gap — Home Handoff

**Verdict tag:** `REMAINING_FINANCIAL_VIEW_GAP_HANDOFF_READY`  
**Date:** 2026-09-22 (Asia/Karachi)  
**Mode:** READ-ONLY discovery + documentation only  
**Branch:** `feat/supplier-party-read-view-alignment`  
**Docs tip (pre-this-commit):** `e4c97b34`  
**Deployed app SHA (known):** `08a11922`  
**Database mutations:** **0**  
**Migrations run:** **0**  
**Deploy performed:** **NO**  
**Main merge:** **NO**  
**Graphify touched:** **NO**

---

## 1. Git / workspace snapshot (start of this task)

```
branch: feat/supplier-party-read-view-alignment
HEAD:   e4c97b3417ab123f57dbb76dfd058311b9b338bd
```

### Dirty / untracked classification (left untouched)

| Path | Classification | Action taken |
|------|----------------|--------------|
| `graphify-out/.graphify_root` | unrelated local graphify | **not committed** |
| `graphify-out/GRAPH_REPORT.md` | unrelated local graphify | **not committed** |
| `deploy/staging-je-guard/_tmp_*` | temp ops scripts | **not committed** |
| `scripts/_tmp_generalize_advanced_ledger.*` | temp transform scripts | **not committed** |
| `reports/supplier-canonical-tb-rollup-20260922/_analyze|_classify.*` | prior analysis helpers | **not committed** |
| `reports/_closeout_discover_out.txt` | prior RO scrape | **not committed** |
| `ter` | unknown stray | **not committed** |

VPS-only artifacts mentioned in the brief (`deploy/backup-page/*`, `accountingReportsService.ts`, closeout SQL) were **not** present in this local `git status`; nothing was reset/stashed/deleted.

---

## 2. Exact affected screen

**Screen name:** Reports → **Balance Basis Guide**

| Layer | Identity |
|-------|----------|
| Nav key | `balance-basis-guide` in `ReportsDashboardEnhanced.tsx` |
| React page | `src/app/components/reports/BalanceBasisGuidePage.tsx` |
| Logic helpers | `src/app/lib/balanceBasisGuideLogic.ts` |
| Loader service | `src/app/services/balanceBasisGuideReportService.ts` → `loadBalanceBasisGuideReport` |
| Party GL map | `contactService.getContactPartyGlBalancesMap` |
| Party GL RPC | `get_contact_party_gl_balances` |
| Document due RPC | `get_contact_balances_summary` |
| Control snapshot RPC | `ar_ap_integrity_lab_snapshot` |
| Control TB fallback | `accountingReportsService.getArApGlSnapshot` (accounts 1100 / 2000 / 2010) |
| Linked account hint | `accounts` select `code, linked_contact_id` (first code wins) |

**Not** Customers & Suppliers (already aligned).  
**Not** Trial Balance itself (control cards only *read* TB/BS control accounts).  
**Not** Supplier Business Statement / Contacts (already use `supplierBusinessGl`).

Banner copy on the page explicitly states Party GL signed = journals on **1100 / 2000 / 2010** and Control = Balance Sheet — i.e. **Official AP control family**, not Supplier Business GL.

---

## 3. Column → source mapping

### Per-contact table columns

| UI column | Field | Component | Service / helper | RPC / query | Accounting basis |
|-----------|-------|-----------|------------------|-------------|------------------|
| Contact | `contactName` | `BalanceBasisGuidePage` | contacts select | `contacts` | OTHER (master data) |
| Code / GL | `contactCode` + `subledgerAccountHint` | same | first linked `accounts.code` | `accounts` | OTHER (hint only; may show `210017` while AP signed stays Official) |
| Type | `contactType` | same | contacts | `contacts.type` | OTHER |
| AR signed | `glArSigned` | same | `getContactPartyGlBalancesMap` → `glArReceivable` | `get_contact_party_gl_balances` | ATTRIBUTED_GL within **1100 subtree** (official AR control family) |
| AR operational | `operationalReceivable` | `buildBalanceBasisGuideRow` | `MAX(0, glArSigned)` | derived | OPERATIONAL_DOCUMENT-style **clamp** of party AR (not open-doc) |
| Hidden AR | `hiddenCreditAr` | same | `glArSigned − operational` | derived | OTHER (signed vs clamp gap) |
| AP signed | `glApSigned` (+ worker in sort/totals) | same | `glApPayable` (+ `glWorkerPayable` for payables totals) | `get_contact_party_gl_balances` | **OFFICIAL_AP** (2000 subtree only) |
| AP operational | `operationalPayable` | same | `MAX(0, glAp + glWorker)` | derived | clamp of Official AP / worker |
| Hidden AP | `hiddenCreditAp` | same | signed − operational | derived | OTHER |
| Doc due AR | `documentDueReceivable` | same | `get_contact_balances_summary.receivables` | `get_contact_balances_summary` | OPERATIONAL_DOCUMENT |
| Doc due AP | `documentDuePayable` | same | `.payables` | same | OPERATIONAL_DOCUMENT |

### Header / footer control cards

| UI label | Source | Basis |
|----------|--------|-------|
| Receivables Operational (clamped) | sum of row `operationalReceivable` | clamp of party AR |
| Receivables Party GL signed | sum of `glArSigned` | ATTRIBUTED_GL (1100 family) |
| Control AR 1100 (Balance Sheet) | `ar_ap_integrity_lab_snapshot.gl_ar_net_dr_minus_cr` or `getArApGlSnapshot.ar` | RAW_ACCOUNT_GL / Official control |
| Payables Operational (clamped) | sum of row operational payables | clamp of Official AP+worker |
| Payables Party GL signed | sum of `glApSigned + glWorkerSigned` | **OFFICIAL_AP** + worker |
| Control AP 2000 (Balance Sheet) | snapshot `gl_ap_net_credit` / TB AP | RAW_ACCOUNT_GL / Official control |
| Control WP 2010 | `getArApGlSnapshot.wpNetCredit` | Official worker control |

### Filter that hides legacy-only suppliers

`hideZeroOperational` (default **false**, but if enabled) drops rows where both operational AR and AP are ≈ 0.

For ARIF: Official AP signed = 0 → operational payable = 0 → **row can vanish** when that filter is on, even though Business GL = 39,937 and Code/GL hint may still show `210017`.

---

## 4. ARIF golden trace (this report only)

| Fact | Value |
|------|------:|
| Contact | `21e1ac76-b911-44a1-87dd-6283969efa4c` / SUP-ZHD-0017 / ARIF LHR |
| Legacy account | `210017` |
| Business GL (aligned surfaces) | **39,937** payable (Cr − Dr) |
| Official AP | **0** |
| Raw 210017 Dr − Cr | **−39,937** |

| Balance Basis Guide column | Expected display (current code) | Why |
|----------------------------|----------------------------------|-----|
| Code / GL | May show `210017` | First linked account hint — **not** used for amounts |
| AP signed | **0** | `get_contact_party_gl_balances.gl_ap_payable` = 2000 subtree only; no AP-SUP leaf |
| AP operational | **0** | `MAX(0, 0)` |
| Hidden AP | **0** | no signed/clamp gap |
| Doc due AP | document open AP (may be 0 or unrelated) | `get_contact_balances_summary` |
| Party payables total contribution | **0** | same Official AP source |
| Business GL | **not shown** | page never calls `supplierBusinessGl` / `loadSupplierBusinessGlBalancesMap` |

So ARIF “missing” on this screen is **not** missing journals — it is **missing from Official AP party rollup by design of this report’s data path**.

---

## 5. Business GL vs Official AP (concepts)

| Concept | Definition | Surfaces that use it after alignment |
|---------|------------|--------------------------------------|
| **Official AP** | 2000 / AP-* control family; TB / BS liable | Balance Basis Guide “AP signed” + Control AP 2000; Official AP statement tab |
| **Supplier Business GL** | Deterministic AP + legacy 2090/210xxx (+ remaps) attributed to supplier contact | Supplier Statement Business History; Contacts supplier GL; C&S Due/Advance GL |

These may diverge historically (ARIF = classic case). Divergence is **explainable**, not corruption.

---

## 6. System-wide impact (reuse attribution matrix)

Source matrix: `SYSTEMWIDE_ATTRIBUTION_MATRIX.csv` (same classifier as alignment; no second schema).

Derived file: `REMAINING_FINANCIAL_VIEW_GAP_MATRIX.csv`

| Bucket | Meaning | Count |
|--------|---------|------:|
| **A** | Business GL ≠ Official AP | **59** |
| **B** | Business GL ≠ 0 and Official AP = 0 | **59** |
| **C** | Official AP ≠ 0 and Business differs | **0** |
| **D** | Clean parity (Business ≈ Official, both non-zero or matched) | **20** |
| **E** | Zero both | **49** |
| **F** | Role exception | **7** |
| **G** | Ambiguous | **0** |
| Total matrix rows | | **135** |

Interpretation for home:

- **59 suppliers** have Business exposure that Balance Basis Guide’s **AP signed** will understate (often show 0).
- All current mismatches are type **B** (legacy-only style), matching prior discovery (85 LEGACY_ONLY includes zeros; 59 have nonzero Business with Official 0).

---

## 7. Is this actually a bug?

**Classification: mixed-basis / intentional Official AP reconciliation report + incomplete labeling relative to new Business GL vocabulary.**

Evidence it is **intentionally Official AP / control** oriented:

1. Intro text: Party GL = “1100 / 2000 / 2010 party accounts”.
2. Control cards explicitly = Balance Sheet / Trial Balance.
3. Loader uses `get_contact_party_gl_balances` (2000 subtree) — never legacy 210xxx Business filter.
4. Purpose is operational clamp vs **party control family** vs **control GL** parity — not Supplier Business Statement.

Evidence of **UX / completeness gap** after Phase-1 alignment:

1. Other party-facing reports now show Business GL; this screen still shows Official AP only for AP signed.
2. Sub-ledger hint can show `210017` while AP signed = 0 → looks like a data bug to operators.
3. `hideZeroOperational` can hide entire legacy-payable suppliers from the grid.

**Not chosen / not implemented:** replacing Official AP with Business GL on this screen (would break Party vs Control AP 2000 variance meaning).

---

## 8. Recommended options (NO implementation)

| Option | Idea | Risk |
|--------|------|------|
| **O1 — Label/UX only** | Rename “AP signed” → “Official AP (2000)”; add note that Supplier Business History / Contacts use Business GL; show Business net as **separate** optional column | Lowest; preserves control reconciliation |
| **O2 — Dual columns** | Keep Official AP; add “Business GL (supplier)” from `loadSupplierBusinessGlBalancesMap` for supplier roles only | Medium; must not fold into Control AP variance |
| **O3 — Separate report** | New “Supplier Business Exposure” report; leave Balance Basis Guide untouched | Low coupling |
| **O4 — Replace AP signed with Business** | Soften Control AP variance | **High — do not do without owner approval** |

**Safest next home action:** Implement **O1** (labels + one-line basis banner) and optionally a read-only dual column (**O2**) gated so Control AP 2000 totals remain Official-only. Re-run ARIF: Official AP signed stays 0; Business column shows 39,937. No JE mutation. No migration required for O1; O2 is frontend-only using existing `supplierBusinessGl`.

---

## 9. JE fingerprint (read-only re-check)

| Metric | Expected baseline | Live 2026-09-22 ~20:31 Asia/Karachi |
|--------|------------------:|-------------------------------------:|
| journal_entries | 5,062 | **5,062** |
| journal_entry_lines | 10,124 | **10,124** |
| SUM(debit) | 875,502,523.57 | **875,502,523.57** |
| SUM(credit) | 875,502,523.57 | **875,502,523.57** |
| difference | 0.00 | **0.00** |

UTC timestamp from DB: `2026-09-22T15:31:15Z`.

---

## 10. Completed prior gates (context)

- Backup + restore: `DATABASE_BACKUP_RESTORE_VERIFIED_PASS`
- Supplier Statement / Contacts / C&S: `SUPPLIER_PARTY_READ_VIEW_ALIGNMENT_PASS`
- Deployed feature SHA: `08a11922`
- This handoff: documentation only

---

## 11. Files written this session

- `REMAINING_FINANCIAL_VIEW_GAP_HANDOFF.md` (this file)
- `REMAINING_FINANCIAL_VIEW_GAP_MATRIX.csv`
