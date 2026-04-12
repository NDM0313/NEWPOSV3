# Case study: `JE-0074`, `JE-0075`, `JE-0078` — edited payment chain (company `595c08c2-1e47-4581-89c9-1f78de51c613`)

This document is the **line-level companion** to [FINAL_MULTI_EDIT_PAYMENT_EFFECTIVE_STATE_ROOT_FIX.md](./FINAL_MULTI_EDIT_PAYMENT_EFFECTIVE_STATE_ROOT_FIX.md) (PF-14.7). It explains how to **analyze** three specific `entry_no` values that came from an **edited customer receipt** workflow, how to tell **legitimate** PF-14 history from a **duplicate load-sync replay**, and how to **repair** data after the engine fix is deployed.

---

## Scope

| Field | Value |
|--------|--------|
| Company | `595c08c2-1e47-4581-89c9-1f78de51c613` |
| Journal entry numbers | `JE-0074`, `JE-0075`, `JE-0078` |

These numbers are **human-facing `entry_no` values** in `journal_entries`. They are **not** the auto pattern `JE-PAY-ACC-…` / `JE-PAY-ADJ-…` used by some code paths; your deployment may assign sequential `JE-00xx` per company regardless of how the row was created.

---

## What each class of row usually means

Use **`reference_type`**, **`payment_id`**, and **`description`** together — never `entry_no` alone.

1. **Primary receipt JE**  
   - `journal_entries.payment_id` = the payment UUID.  
   - `reference_type` is typically `sale`, `manual_receipt`, etc. (not `payment_adjustment`).  
   - For PF-14, this row is often **left unchanged** after edits (audit trail): liquidity on this JE can still show the **original** cash/bank account.

2. **PF-14 amount delta** (`payment_adjustment`, description like “Payment edited: was Rs …, now Rs …”)  
   - Adjusts **AR vs liquidity** for the **difference** only.  
   - Legitimate when the user changed the posted amount.

3. **PF-14 account transfer** (`payment_adjustment`, description contains **“Payment account changed”**)  
   - **Dr new liquidity, Cr old liquidity** for the **full current amount** (sale context).  
   - One or more of these can be **valid** if the user moved the receipt across accounts in steps.

4. **Duplicate replay (bug, pre–PF-14.7)**  
   - Same pattern as (3) — full transfer from **primary JE’s old account** toward **`payments.payment_account_id`** — but **after** a valid PF-14 chain already funded the destination.  
   - Often appears **on repeated Accounting loads**, not only on save.  
   - Typical tell: **two or more** “Payment account changed” JEs where the **later** one **re-credits** an account that should already be cleared, or **double-funds** the bank.

---

## How to analyze (SQL)

Run the queries in:

`scripts/analyze_case_je_0074_0075_0078.sql`

Recommended order:

1. **Section 1–2** — For each of `JE-0074`, `JE-0075`, `JE-0078`, capture `id`, `payment_id`, `reference_type`, `description`, `is_void`, and **all lines** with `accounts.code`.

2. **Section 3** (after you know the **`payment_id`**) — List **every** JE for that payment in time order (primary + all `payment_adjustment` rows).

3. Cross-check with **`scripts/verify_payment_effective_state_pf14_7.sql`** for the same `payment_id`: payments row vs primary JE vs PF-14 “Payment account changed” list.

---

## Decision checklist before voiding anything

- **Do not void** the **primary** receipt JE unless you have a separate reversal strategy (almost never for this bug class).

- **Legitimate PF-14 account transfer** rows: description matches **`Payment account changed – … (same amount, new account)`**, `reference_type = payment_adjustment`, `reference_id = payment_id`, lines are **Dr new / Cr old** for one hop at **current** payment amount (per user action).

- **Suspect duplicate (candidate void)** — confirm **all** of:
  - A **prior** non-void PF-14 “Payment account changed” already moved liquidity for this payment; **and**
  - The suspect JE is **another** full same-amount transfer from the **same old account** implied by the **primary JE** (stale) rather than from a **new** user-declared hop; **and**
  - Net effect on liquidity accounts (Petty / Bank / wallets) is **wrong** without this row (e.g. Petty negative, bank double-counted).

- Prefer **void** with **`void_reason`** text referencing PF-14.7 duplicate sync — do **not** delete rows.

---

## Engine fix (already in codebase)

`syncPaymentAccountAdjustmentsForCompany` skips backfill when **`hasPaymentAccountChangedPf14Journal`** is true, so **new** duplicate replays from load sync should **stop** after deploy. See `paymentAdjustmentService.ts` and the FINAL PF-14.7 doc.

---

## Example repair pattern (after you identify the duplicate `id`)

Only run against the UUID you confirmed as duplicate — **not** by `entry_no` alone (numbers can be reused in theory across companies/branches).

```sql
-- EXAMPLE — replace journal_entries.id and company_id after investigation
-- UPDATE journal_entries
-- SET is_void = true,
--     void_reason = 'PF-14.7: duplicate load-sync replay; void after line reconciliation — see JE_0074_0075_0078 doc'
-- WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
--   AND id = '…confirmed-uuid…';
```

Then re-check trial balance and the payment’s liquidity accounts.

---

## Likely narrative for *this* triple (hypothesis until SQL confirms)

Without direct DB access from this repo, the **usual** pattern matching this story is:

| Entry | Typical role (verify with SQL) |
|--------|--------------------------------|
| `JE-0074` | Primary receipt or first adjustment in the chain |
| `JE-0075` | Second PF-14 event (amount delta **or** first/second account transfer) |
| `JE-0078` | **Often** the **extra** “Payment account changed” created by **pre–PF-14.7** sync replay — **candidate** for void if it duplicates an already-complete chain |

**Your database is authoritative:** if `JE-0078` is the only full transfer and `0074/0075` are not PF-14 duplicates, the roles differ — follow the lines, not this table.

---

## References

- [FINAL_MULTI_EDIT_PAYMENT_EFFECTIVE_STATE_ROOT_FIX.md](./FINAL_MULTI_EDIT_PAYMENT_EFFECTIVE_STATE_ROOT_FIX.md) — root cause and PF-14.7 behavior  
- `scripts/verify_payment_effective_state_pf14_7.sql` — payment vs primary vs PF-14 chain  
- `scripts/analyze_case_je_0074_0075_0078.sql` — this case’s entry numbers  

---

*Written as part of the multi-edit payment / effective liquidity closure work; data repair must be confirmed in SQL before execution.*
