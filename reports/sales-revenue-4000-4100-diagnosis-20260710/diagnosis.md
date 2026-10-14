# Sales Revenue 4000 vs 4100 — Read-Only Diagnosis

**Date:** 2026-07-10  
**Scope:** OLD ERP production (VPS read-only SQL)  
**Script:** [`scripts/sql/diag_sales_revenue_4000_4100_split.sql`](../../scripts/sql/diag_sales_revenue_4000_4100_split.sql)  
**Safety:** No GL mutation, no COA merge, no repairs run

---

## Executive summary

| Finding | Detail |
|---------|--------|
| **P&L UI is correct** | Two lines appear because **two active GL accounts** both named “Sales Revenue” exist |
| **Company matched** | Amounts **Rs. 1,573,600 (4000)** and **Rs. 49,685,321.98 (4100)** match **DIN CHINA**, not DIN COUTURE |
| **Root cause** | Known **dual revenue code** split: legacy/import path → **4100**; current sale engine → **4000** |
| **Not mis-entry on same sale** | **0** sales credit both 4000 and 4100 on one document JE |
| **Merge** | **Deferred** — requires explicit approval + transfer JEs (Phase 2) |

---

## Company context

### DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`)

This is the company behind the P&L figures you reported.

| Code | Name | All-time net revenue (JE) | Sale document credits | Return debits |
|------|------|---------------------------|------------------------|---------------|
| **4000** | Sales Revenue | **1,573,600.00** | 1,573,600 (3 sales) | 0 |
| **4100** | Sales Revenue | **49,685,321.98** | 50,745,224.98 (92 sales) | 1,059,903 (4 returns) |

**Combined merchandise revenue:** Rs. 51,258,921.98 — matches P&L Revenue section total.

### DIN COUTURE (`2ab65903-62a3-4bcf-bced-076b681e9b74`) — reference

| Code | All-time net (JE) | Notes |
|------|-------------------|--------|
| 4000 | 21,250.00 | 1 sale (SL-0001) |
| 4100 | 0 | Account exists but **no JE activity** |

DIN COUTURE does **not** currently exhibit the 4000/4100 split in production GL.

---

## COA state (DIN CHINA)

Both accounts are active, postable, under Revenue group **4050**:

| Code | Name | Parent | `accounts.balance` |
|------|------|--------|-------------------|
| 4000 | Sales Revenue | 4050 Revenue | -1,573,600.00 |
| 4100 | Sales Revenue | 4050 Revenue | -49,685,321.98 |

Also present: 4010 Studio Service Revenue, 4110 Shipping Income, 4120 Extra Service Income (no split issue).

---

## Recent sales — which revenue account?

### Sales posting to **4000** (current engine path)

| Invoice | Invoice date | Total | Created | Created by |
|---------|--------------|-------|---------|------------|
| SL-0003 | 2026-05-10 | 672,000 | 2026-07-07 14:21 | din@yahoo.com (admin) |
| SL-0002 | 2026-05-10 | 672,000 | 2026-07-07 14:19 | din@yahoo.com (admin) |
| SL-0001 | 2026-04-30 | 229,600 | 2026-07-07 14:14 | din@yahoo.com (admin) |

- **Revenue credit:** 100% on account **4000**
- **Sum:** Rs. 1,573,600 — matches P&L line for 4000
- These are **new-format** invoices (`SL-xxxx`), entered/finalized July 2026 (likely mobile or recent web workflow)
- Creator is **admin** user, not a separate Salesman test account

### Sales posting to **4100** (legacy / import path)

| Pattern | Count | Total revenue credit | Typical created |
|---------|-------|----------------------|-----------------|
| `DC-00xx` invoices | **92** | Rs. 50,745,224.98 | 2026-06-15 bulk (import) |
| Examples | DC-0093 … DC-0072 | Rs. 213,394 … Rs. 361,594 | `created_by` empty on import rows |

- **Net after returns:** Rs. 49,685,321.98 (4 sale returns debited **4100** only: Rs. 1,059,903)
- Historical bulk load used **4100** (COA seed “Sales Revenue” under 4050)

---

## Period note (Jul 1–10, 2026)

Section 6 of the script shows **0 sales** in that invoice-date window because:

- The three **SL-** sales have **invoice_date** in Apr/May 2026 but were **created** on 2026-07-07
- Legacy **DC-** sales have older invoice dates

P&L for a date range uses **journal activity in range**, not `sales.created_at`. The all-time / unified TB view still shows both codes correctly.

---

## Engine behavior (code reference)

| Path | Preferred revenue code | File |
|------|------------------------|------|
| Sale finalize (web) | **4000** (`ensureRevenueAccount`) | `src/app/services/saleAccountingService.ts` |
| Sale edit (mobile) | **4000** then 4100 fallback | `erp-mobile-app/src/api/saleEditAccounting.ts` |
| Sale return settlement | **4100** then 4000 fallback | `src/app/context/AccountingContext.tsx` |
| COA seed | **4100** under 4050 | `src/app/services/defaultAccountsService.ts` |

This explains why **new** sales land on **4000** while **imported/legacy** history sits on **4100**.

---

## Checks performed

| Check | Result |
|-------|--------|
| Same sale credits both 4000 and 4100 | **0 rows** |
| Final sales missing revenue line | **0 rows** |
| 4100 used for sale returns | **4 JEs**, Rs. 1,059,903 debit |
| Mis-posting (wrong account on single sale) | **Not found** — split is **by cohort**, not duplicate posting |

---

## Conclusion

**Classification: `SPLIT_CONFIRMED_LEGACY_VS_CURRENT`**

- Entries are **not wrong** in the sense of double-counting one sale
- P&L correctly shows **two real accounts** with the same display name
- Your hypothesis is **partly correct**: recent **SL-** sales (phone/new workflow) use **4000**; bulk historical **DC-** sales use **4100**
- **Merging in P&L UI only** would hide the split; true fix needs COA/posting standardization

---

## Phase 2 options (blocked — not executed)

Requires explicit operator approval and named repair scope:

1. **Pick one canonical code** (4100 = COA tree standard, or 4000 = sale engine standard)
2. **Standardize all engines** to same code order (including sale returns)
3. **Transfer JE** — move historical balance from retired code to canonical (no account delete)
4. **Deactivate** duplicate account only when balance = 0
5. **Optional P&L rollup** — cosmetic “combined Sales Revenue” with footnote

**Do not run** until finance sign-off. See [`docs/accounting/ERP_REPORTS_AND_COA_FINAL_REMEDIATION_PLAN.md`](../../docs/accounting/ERP_REPORTS_AND_COA_FINAL_REMEDIATION_PLAN.md) Phase 5.

---

## Operator next steps

1. ~~Confirm which company you were viewing in mobile P&L~~ — **DIN CHINA** confirmed
2. ~~Decide canonical revenue account~~ — **4000** decided and production-verified (SL-0010)
3. Historical DIN CHINA **4100** merge/reclass — **blocked** until `APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2`
4. For new companies: seed **one** merchandise revenue code (**4000**)

**Closeout:** [`reports/sales-revenue-canonical-account-correction-20260710/closeout.md`](../sales-revenue-canonical-account-correction-20260710/closeout.md)

---

## Safety

| Item | Status |
|------|--------|
| DB migrations | not run |
| GL repairs | not run |
| R8 | not run |
| Production mutation | none |
