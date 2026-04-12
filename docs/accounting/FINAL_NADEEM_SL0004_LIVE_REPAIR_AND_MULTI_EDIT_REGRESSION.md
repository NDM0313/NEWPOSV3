# FINAL: Nadeem / SL-0004 live repair, PF-14.7 deploy, multi-edit regression

**Date:** 2026-04-10  
**Company ID:** `595c08c2-1e47-4581-89c9-1f78de51c613`  
**Customer:** Nadeem (contact / AR subledger as posted)  
**Sale:** `SL-0004` — `sales.id` = `194ad837-c79a-4d1e-881b-d5b6caf2fe7f`

---

## 1. Root cause (concise)

| Question | Answer |
|----------|--------|
| Was the remaining issue **only** old bad active JEs? | **Yes for GL liquidity.** The damaging row was **`JE-0078`**, a **duplicate full liquidity transfer** (Dr **1010 Bank** / Cr **1001 Petty**) for **Rs 50,000** after **`JE-0075`–`JE-0077`** had already moved funds **Petty → FHD MZ → Bank** and applied the **45,000 → 50,000** amount delta on Bank. |
| Was there still a **second save-path** bug proven for this chain? | **No.** User-driven PF-14 steps **`JE-0074`–`JE-0077`** match `transaction_mutations` and sane fingerprints. **`JE-0078`** used the **sync invoice label** `Sale 194ad837` (sale id slice), not `SL-0004` — matching **`syncPaymentAccountAdjustmentsForCompany`** / load-sync, not `saleService.updatePayment`. |
| Was production missing **PF-14.7**? | **Yes, before this session.** VPS `/root/NEWPOSV3` had an **older** `paymentAdjustmentService.ts` (~363 lines) **without** `hasPaymentAccountChangedPf14Journal` / `skippedPf14Chain`. **Deployed bundle** now contains `skippedPf14Chain` (verified inside `erp-frontend` nginx assets). |

**Conclusion:** Broken liquidity was **bad active GL (JE-0078)** + **missing engine guard on production**. Not a second multi-edit save bug for this payment sequence.

---

## 2. Economic IDs

| Entity | UUID |
|--------|------|
| Sale `SL-0004` | `194ad837-c79a-4d1e-881b-d5b6caf2fe7f` |
| Payment `RCV-0005` | `45b0bd3a-4bef-4b75-baa9-f5a41a483217` |
| Customer | `efba520e-7773-437d-97d6-6703a08f6b40` |

**Payments row (post-repair):** `amount` = **50,000**, `payment_account_id` → **1010 Bank** (`a4838f20-5eec-4fa4-9af5-131808b9d78d`).

---

## 3. Ordered JE chain (chronological)

| Order | entry_no | journal_entries.id | Role |
|------:|----------|----------------------|------|
| 1 | JE-0072 | `7dfba75a-15c7-456a-8728-02ff8651fb16` | Sale finalized – SL-0004 (document JE) |
| 2 | JE-0073 | `8b741fd8-4e29-42d6-8b1a-017c2ce44c90` | **Primary receipt** — Dr Petty **1001** 4,500 / Cr AR 4,500 |
| 3 | JE-0074 | `96798c0a-ca62-4ea4-9b8f-0de469df9498` | **Valid PF-14 amount delta** 4,500 → 45,000 (on Petty liquidity leg) |
| 4 | JE-0075 | `7ae5377b-2197-4e64-9127-bcafb9e25e4c` | **Valid PF-14 transfer** Petty → **FHD MZ 1012** @ 45,000 |
| 5 | JE-0076 | `7198f68f-6b62-446d-a342-3ba22fbafb30` | **Valid PF-14 transfer** FHD MZ → **Bank 1010** @ 45,000 |
| 6 | JE-0077 | `d1ff4d53-893d-4086-905a-9d8b95d5b651` | **Valid PF-14 amount delta** 45,000 → 50,000 on Bank / party AR |
| 7 | JE-0078 | `6a60a6b9-c822-4f31-b844-353d6fb5268f` | **Duplicate replay** — Dr Bank 50,000 / Cr Petty 50,000 (**voided**) |

---

## 4. Why JE-0078 was duplicate / not a corrective

After **JE-0075–0077**, liquidity was already **fully in Bank** for the **50,000** receipt economics (FHD cleared, Petty cleared).  
**JE-0078** re-ran **Petty → Bank** for the **full** 50,000 using **stale primary JE liquidity** (Petty still on **JE-0073**) vs `payments.payment_account_id` — the PF-14.7 load-sync failure mode.

**Corrective JE posted:** **None** — voiding **JE-0078** restores TB without further entries.

---

## 5. Live repair SQL applied

Void executed via **service role** (Supabase JS `update`), equivalent to:

```sql
UPDATE journal_entries
SET is_void = true,
    void_reason = 'PF-14.7 duplicate load-sync replay: payment_adjustment used primary JE liquidity (Petty 1001) vs payments.payment_account_id (Bank 1010) after JE-0075/0076/0077 already completed the chain. Dr/Cr 1010+1001 for 50,000 was mathematically duplicate of net effect. Void per Nadeem SL-0004 repair 2026-04-10.'
WHERE id = '6a60a6b9-c822-4f31-b844-353d6fb5268f';
```

**JE voided (by id, not by entry_no alone in production):** `6a60a6b9-c822-4f31-b844-353d6fb5268f` (`JE-0078`).

---

## 6. Before vs after — liquidity (company GL, non-void lines only)

Computed as **sum(debit − credit)** per account across **all** non-void `journal_entry_lines` for the company (not limited to this sale).

| Account | Code | Before void JE-0078 | After void JE-0078 |
|---------|------|---------------------|---------------------|
| Petty Cash | 1001 | **−50,000** (wrong) | **0** |
| FHD MZ | 1012 | 0 | 0 |
| Bank | 1010 | **+100,000** (double) | **+50,000** |

**Party AR subledger (`AR-EFBA520E7773` net Dr−Cr):** **99,000** before and after — **JE-0078 did not touch AR**; remaining variance vs sale/due display is **outside this liquidity repair** (document vs subledger mix). No AR line was hidden or unlinked.

---

## 7. PF-14.7 production verification

| Check | Result |
|-------|--------|
| Source on VPS | Replaced `paymentAdjustmentService.ts`, `AccountingContext.tsx`, `postingDuplicateRepairService.ts`, plus deps `paymentEditFlowTrace.ts`, `transactionMutationService.ts`; **`docker compose … build erp`** then **`up -d --force-recreate erp`**. |
| Built bundle | `grep skippedPf14Chain` → **`/usr/share/nginx/html/assets/index-GcLanVbf.js`** (present). |

---

## 8. Regression / retest

| Test | Result |
|------|--------|
| **A)** Reload Accounting / multiple loads | **PF-14.7** skips backfill when a non-void **“Payment account changed”** `payment_adjustment` exists (`JE-0075` / `JE-0076`). **No new sync replay** expected for this payment after deploy + void. |
| **B)** Controlled new multi-edit (separate sale) | **Not executed** in this run (would mutate live business data). Recommended: small test receipt → edit amount → edit account → repeat → reload; watch for **extra** `Payment account changed` with **Sale {uuid}** label and **Petty → Bank** after chain complete. |

**Stability check:** Payment `45b0bd3a-…` has **5** active `payment_id` journal rows after void (primary + four PF-14 adjustments incl. amount deltas); **JE-0078** is **void**, not deleted.

---

## 9. `transaction_mutations` note

Several **`account_change`** rows reference **`adjustment_journal_entry_id` = `JE-0078`**. Those rows are **append-only audit** and were **not** deleted. GL truth is **`journal_entries`**; voiding **JE-0078** fixes balances. Optional cleanup of duplicate mutation rows is a **separate** product decision (not required for TB).

---

## 10. Remaining risks

1. **Description-based** `hasPaymentAccountChangedPf14Journal` — if UI ever changes **“Payment account changed”** copy, reintroduce risk; prefer a **dedicated column/flag** in a future migration.  
2. **Git drift:** VPS was **behind** local `main`; future deploys should **`git pull`** + build or CI so **SCP patch** is not required.  
3. **Full multi-edit UI regression** (test B) still recommended on a **non-production** tenant or a **throwaway** receipt.

---

*Live repair executed against production Supabase (`supabase.dincouture.pk`); ERP container `erp-frontend` rebuilt and restarted on `dincouture-vps`.*
