# Truth Lab Phase 2 — Table Trace, Payment Mutation, Reflection Matrix

**Date:** 2026-04-09  
**Route:** `/test/ar-ap-truth-lab`  
**Code:** `src/app/services/truthLabTraceWorkbenchService.ts`, `src/app/components/test/ArApTruthLabPage.tsx`

---

## 1. What was added

| Area | Description |
|------|-------------|
| **Tabs** | Overview · Operational rows · GL rows · Delta explainer · **Table trace** · **Reflection matrix** · **Mutation timeline** · Exception queue · **RPC/SQL inspector** · **Test actions** |
| **Section 5 — Table trace** | Contact-scoped lineage: `contacts`, `payments`, `payment_allocations`, `journal_entries`, `journal_entry_lines` (with `accounts` lookup). Click row → sheet with raw JSON. |
| **Payment mutation trace** | Workbench mode + inputs: `reference_number`, payment UUID, or journal entry UUID → `fetchPaymentDeepTrace`: payment row, linked JEs, lines, allocations, sales, **timeline**, payment-scoped lineage. |
| **Reflection matrix** | Surfaces (Truth Lab RPC, Reconciliation, Roznamcha, PF-14 adjustment JEs, legacy statement, reports) with source name, amounts, row ids, expected vs mismatch reason. |
| **Inspector** | Lists RPCs, table families, JSON filters (company, branch, contact, dates, toggles). |
| **Test actions** | Copy UUIDs, copy SQL template, open Contacts app, refresh snapshot, copy full debug payload (JSON). |
| **Debug payload** | `buildDebugPayload()` — snapshot + trace + lineage + filters for support tickets. |

Legacy customer/supplier ledger pages were **not** modified in this phase (remain frozen / labeled).

---

## 2. Tables and views traced

| Table / view | When |
|--------------|------|
| `contacts` | Contact lineage bundle (one row for selected contact). |
| `payments` | Date range + `contact_id`; payment deep trace by id/ref/JE. |
| `payment_allocations` | All allocations for surfaced payments. |
| `sales` | When payment `reference_type = sale` and `reference_id` set. |
| `journal_entries` | `payment_id IN (...)` **union** `reference_id IN (...)` (captures PF-14 `payment_adjustment` where `reference_id` = payment uuid). |
| `journal_entry_lines` | All lines for those JE ids; `accounts` joined in app by `account_id`. |
| `accounts` | Codes/names for lines and `payments.payment_account_id`. |
| `v_ar_ap_unmapped_journals` | Unchanged (exception queue via existing service). |

Not bulk-dumped: `stock_movements`, `purchase_items` — only add when a selected payment/sale chain references them in a later iteration.

---

## 3. Row lineage (how to read it)

Each lineage record includes: `source_table`, `source_pk`, optional `parent_*`, `reference_type` / `reference_id`, `payment_id`, `journal_entry_id`, `journal_entry_line_id`, document number, contact/company/branch, timestamps, amounts, `voided_at`, `badges` (`canonical`, `delta-only`, `voided`, etc.), and `extra` (full row JSON for the sheet).

**Rule:** “This number comes from **this table** and **this UUID**.”

---

## 4. Mutation timeline (how it works)

Events are derived in order:

1. **`payments`** — `created_at` → insert event; if `updated_at ≠ created_at` → in-place **update** event (Supabase row; no shadow row).
2. **`journal_entries`** — each linked JE sorted by `created_at`: primary `manual_receipt` / `sale` / …, then `payment_adjustment` for PF-14 account or amount fixes.

**PF-14 contract (from `paymentAdjustmentService.ts`):** original payment JE is **not** edited. Account or amount changes add **new** JEs (`reference_type = payment_adjustment`, `reference_id` = payment id, optional `action_fingerprint`).

---

## 5. Salar ~2,700 receipt — live breakdown (VPS)

**Company:** `595c08c2-1e47-4581-89c9-1f78de51c613`  
**Contact Salar:** `2e78da1f-dabf-4622-aa2c-276f8f69d992`

### 5.1 Payment row

| Field | Value |
|--------|--------|
| `id` | `447f4205-8578-4d0b-b04b-ab379d17146e` |
| `reference_number` | **RCV-0002** (new `CUSTOMER_RECEIPT` / RCV series) |
| `reference_type` | `manual_receipt` |
| `amount` | **2,700.00** |
| `payment_account_id` (current) | `8ae72b42-0944-4585-9f14-d659e7c42a6b` → account **1002 CASH G140** |
| `created_at` | 2026-04-09 19:36:03Z |
| `updated_at` | 2026-04-09 19:38:54Z (in-place update after account change) |

### 5.2 Accounts involved

| Code | Name |
|------|------|
| 1000 | Cash |
| **1002** | **CASH G140** (current liquidity account on payment row) |

### 5.3 Journal entries

**JE-0052** `f97440df-25c3-4eb0-84b3-d2e4ec9627f0` — `reference_type = manual_receipt`, `payment_id = 447f4205…`, `reference_id = contact` (customer uuid).

| Account | Dr | Cr |
|---------|---:|---:|
| 1100 AR | 0 | 2,700 |
| **1000 Cash** | **2,700** | 0 |

→ First post credited AR and debited **Cash (1000)** — matches “first posted into one cash account.”

**JE-0053** `773101a5-84d3-4400-b8fd-58c754531a6d` — `reference_type = payment_adjustment`, `reference_id = 447f4205…` (payment uuid).

| Account | Dr | Cr |
|---------|---:|---:|
| **1002 CASH G140** | **2,700** | 0 |
| **1000 Cash** | 0 | **2,700** |

`action_fingerprint` (prefix `payment_adjustment_account:`) encodes company, payment id, **old** account `95b1e088-5bb4-436a-b440-3070f4494f33` (1000), **new** account `8ae72b42-…` (1002), amount **2700**.

### 5.4 Answers to the ten questions

1. **Original payment row id:** `447f4205-8578-4d0b-b04b-ab379d17146e`.  
2. **Original payment account (first GL liquidity side):** **1000 Cash** (from JE-0052 line).  
3. **Edited payment account (current row):** **1002 CASH G140** (`payment_account_id` on `payments`).  
4. **Original amount:** 2,700 (unchanged in this test).  
5. **Edited amount:** no change; only account moved.  
6. **Related JE ids:** **JE-0052** (primary), **JE-0053** (PF-14 account transfer).  
7. **JE updated or replacement?** Primary JE **not** updated; **new** adjustment JE **JE-0053** posted (correct PF-14 behavior).  
8. **Stale row on statement?** `payments` row is **current** (G140). Any UI still showing **1000** for this receipt is **wrong surface** or **pre-refresh** — not a second active payment row.  
9. **Multiple reflections expected?** **Yes:** Roznamcha / day-book style lists show **two** journal documents (0052 + 0053) for **one** payment — **not** duplicate economic receipt; it is **Dr new cash / Cr old cash** transfer.  
10. **Reversal neutralizing surfaces:** A proper reversal must target **both** the operational payment state **and** the stack of JEs (or void rules); not covered here as no void was performed on this row.

---

## 6. “Overload” / duplicate reflection — real or illusion?

**Conclusion: overwhelmingly a presentation / listing issue, not duplicate active `payments` rows.**

- **Net on 1000:** +2,700 (JE-0052) − 2,700 (JE-0053) = **0**.  
- **Net on 1002:** +2,700 (JE-0053).  
- **AR:** single net credit 2,700 from JE-0052 (adjustment only moves cash).

If the user sees “2,700 twice” on **cash**, it is usually **two lines on two accounts** (1000 and 1002) in sequence, or **two JE rows** in Roznamcha, **not** two different payment amounts.

---

## 7. Root cause (structured)

| Factor | Role |
|--------|------|
| **PF-14** | Account change creates a **second** JE; original liquidity line stays on old account until transfer JE nets it. |
| **List UIs** | Day book / Roznamcha list **each JE** — user sees 2+ lines per payment without a “single payment” grouping key. |
| **Statement APIs** | If any view sums **debits** on “cash” without netting **transfer pairs**, perception of “double” can appear. Truth Lab + matrix explain this explicitly. |

---

## 8. Remaining gaps / unresolved surfaces

- **Document mutation trace** tab label is placeholder — same payment inputs apply; dedicated sale/purchase id resolver can be added.  
- **Stock / purchase** lineage not auto-loaded unless linked through payment/sale.  
- **Opening existing edit dialogs** from Truth Lab would require wiring to `ViewSaleDetailsDrawer` / shared modals — not implemented (copy UUID + manual navigation only).

---

## 9. Build result

- **`npm run build`:** **passed** (after Phase 2 changes).

---

## 10. Recommended next cleanup

1. Roznamcha / Day book: optional **collapse by `payment_id`** or tag lines from the same fingerprint.  
2. Truth Lab: add **sale id** resolver in “Document trace” mode.  
3. Optional **server RPC** `get_payment_mutation_timeline(payment_uuid)` returning ordered events for faster loads on large tenants.

---

**Summary:** Truth Lab Phase 2 gives **table-level UUID lineage**, **payment mutation timeline**, and a **reflection matrix** so operators can see **exactly** where **RCV-0002 / 2,700** lives (`payments` + **JE-0052** + **JE-0053**) and why **two journal rows** after an account change is **by design**, not a duplicate receipt.
