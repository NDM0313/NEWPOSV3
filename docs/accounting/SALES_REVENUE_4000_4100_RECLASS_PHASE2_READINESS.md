# Sales Revenue 4000 / 4100 — Phase 2 Reclass Readiness

**Date:** 2026-07-11  
**Scope:** OLD ERP / DIN Collection ERP only  
**Status:** Readiness plan only — **no reclass executed**

## Accounting decision (locked)

| Rule | Value |
|------|--------|
| Future/native Sales Revenue | **4000** |
| Account 4100 role | DIN CHINA **imported historical** revenue / fallback only |
| Mutate 4000 or 4100 | **Forbidden** without Phase 2 approval |
| Deactivate / rename / merge / transfer | **Forbidden** |

## Safety attestation

| Item | Status |
|------|--------|
| Reclass executed | **no** |
| Transfer JE created | **no** |
| GL mutation / SQL update | **no** |
| RPC mutation | **no** |
| Historical entries altered | **no** |

**Approval blocker:** `APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2`

## Read-only audit source

Primary data: `reports/sales-revenue-canonical-account-correction-20260710/read-only-canonical-audit.md` (2026-07-10 VPS read-only SQL).  
Post-audit production proof: SL-0010 and RET-20260711-3835 on **4000** only.

Balances below are **JE-activity derived net revenue** from audit — not live TB closing balances. Operator must confirm current TB balances before any execution.

---

## 1. DIN COUTURE (first in execution order)

**Company ID:** `2ab65903-62a3-4bcf-bced-076b681e9b74`

| Metric | Value (audit 2026-07-10) |
|--------|--------------------------|
| 4000 account ID | `88e14dea-815e-41af-8088-b0cda27baef0` |
| 4000 JE lines (sale doc) | **1** |
| 4000 net revenue | Rs. 21,250 |
| 4000 date range | SL-0001 @ 2026-06-09 |
| 4100 account ID | `1788d214-8cfb-4360-a53a-05f6b11b65c0` |
| 4100 JE lines | **0** |
| 4100 balance / activity | **None** |
| 4100 in current code path | Fallback only when 4000 absent (`canonicalSalesRevenueAccount.ts`) |
| Imported vs native | **100% native on 4000** |

### Reclass recommendation

| Item | Assessment |
|------|------------|
| Proposed reclass amount | **Rs. 0** — no 4100 activity |
| Proposed effective date | N/A |
| Proposed JE | **None required** |
| TB / P&L effect | None |
| Historical statement impact | None |
| Rollback | N/A |
| Risk | Low — no Phase 2 action needed unless operator discovers undocumented 4100 postings after fresh read-only audit |

**Operator confirmation required:** Fresh read-only balance check before closing company as complete.

---

## 2. DIN BRIDAL (second)

**Company ID:** `597a5292-14c8-4cd8-96bd-c61b5a0d8c92`

| Metric | Value (audit 2026-07-10) |
|--------|--------------------------|
| 4000 account ID | `9d4ad9a6-537b-4f04-9af1-69f03e776027` |
| 4000 JE lines | **31** (26 sale doc) |
| 4000 net revenue | Rs. 943,750 |
| 4000 latest JE | 2026-07-05 |
| 4000 pattern | 22 SL-native + 4 other |
| 4100 account ID | `230aef26-1818-4d41-8f96-01dba7d2b72e` |
| 4100 JE lines | **0** |
| 4100 balance / activity | **None** |
| 4100 in current code path | Fallback only |
| Imported vs native | **100% native on 4000** |

### Reclass recommendation

| Item | Assessment |
|------|------------|
| Proposed reclass amount | **Rs. 0** |
| Proposed JE | **None required** |
| TB / P&L effect | None |
| Risk | Low — same as DIN COUTURE |

**Operator confirmation required:** Fresh read-only audit; do not blanket-move 4100 balances that do not exist.

---

## 3. DIN CHINA (last — imported historical)

**Company ID:** `30bd8592-3384-4f34-899a-f3907e336485`

| Metric | Value (audit 2026-07-10; updated by SL-0010 proof) |
|--------|-----------------------------------------------------|
| 4000 account ID | `e0070cfa-5f80-45f3-b80d-cf75c1a93738` |
| 4000 JE lines (pre SL-0010 audit) | **3** sale doc |
| 4000 net revenue (audit) | Rs. 1,573,600 |
| Post-audit native proof | SL-0010 + RET-20260711-3835 on **4000** (Rs. 500 sale/return) |
| 4000 pattern | SL-native → **4000** exclusively |
| 4100 account ID | `ce23889c-07c0-4f09-9946-1e55764719e1` |
| 4100 JE lines | **96** (92 DC-import sales + 4 returns) |
| 4100 net revenue (audit) | Rs. 49,685,321.98 |
| 4100 date range | DC-import through **2026-04-23** (latest in audit) |
| 4100 pattern | DC-00xx invoices → **4100** only (92 sales) |
| 4100 in current code path | **Fallback only** when 4000 absent — not used for new native sales |
| Imported vs native | **Separated** — DC-import on 4100; SL-native on 4000 |

### Separation required (do not conflate)

| Category | Treatment |
|----------|-----------|
| Imported DC historical balances on 4100 | **Preserve** unless explicit accounting policy + Phase 2 approval |
| Native SL postings on 4000 | **Correct** — no reclass needed |
| Incorrect future postings to 4100 while 4000 exists | **None detected** post-correction (drift check PASS) |
| Fallback behavior | Code prefers 4000; 4100 only if 4000 missing |
| Manual judgment entries | Any non-DC, non-SL lines on 4100 require **per-entry** review — not identified in audit |

### Proposed reclass (placeholder — not approved)

| Item | Placeholder |
|------|-------------|
| Proposed amount | `{OPERATOR_CONFIRMED_AMOUNT}` — audit net 4100 ≈ Rs. 49,685,321.98 **must not** be moved without finance sign-off |
| Proposed effective date | `{OPERATOR_SELECTED_DATE}` |
| Proposed description | `Phase 2 sales revenue reclass — imported 4100 to canonical 4000` |
| Proposed orientation | Dr **4100** / Cr **4000** (or mirror per policy) — **amount TBD** |
| TB effect | Reduces 4100 credit balance; increases 4000 credit balance by same amount |
| P&L presentation | No net P&L change if both are revenue detail under 4050 |
| Historical statements | Prior-period reports that relied on 4100 segmentation **will change** if historical lines are rewritten — **prefer new transfer JE at cutover date only** with explicit policy |
| Rollback | Void/reverse transfer JE; document `entry_no` and lines |
| Risk notes | High — large imported balance; statutory/reporting implications; do not automate |

**DIN CHINA must remain last.** Do not recommend blanket movement merely because 4100 has a balance.

---

## Execution gates (all companies)

Before any transfer JE:

1. `APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2` recorded.
2. Fresh read-only TB balances for 4000 and 4100 per company.
3. Exact company, amount, effective date, and rollback plan signed by operator.
4. No SQL bulk update scripts.
5. No account deactivation.
6. Posting via controlled manual JE or approved RPC only — **not** in this readiness session.

---

## Code path reference (read-only)

- `src/app/lib/canonicalSalesRevenueAccount.ts` — 4000 first, 4100 fallback
- `src/app/services/saleAccountingService.ts` — native sale posting uses canonical resolver

---

`APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2`
