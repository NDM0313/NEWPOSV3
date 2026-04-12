# Final report: payment chain locking and reverse targeting (Nadeem / SL-0004)

This document closes the case where a **manual reversal** was posted against the **obsolete primary receipt journal** (Rs. 4,500) instead of the **chronological tail** of the PF-14 payment chain (effective Rs. 50,000 on Bank after edits and transfers).

---

## 1. Live case summary

| Field | Value |
|--------|--------|
| Company | `595c08c2-1e47-4581-89c9-1f78de51c613` |
| Sale | `SL-0004` — `sales.id` = `194ad837-c79a-4d1e-881b-d5b6caf2fe7f` |
| Payment | `RCV-0005` — `payments.id` = `45b0bd3a-4bef-4b75-baa9-f5a41a483217` |

**Intended active chain (before mistaken reverse):**

- JE-0072 — Sale finalized  
- JE-0073 — Primary receipt Rs. 4,500 (Petty / AR)  
- JE-0074 — Amount delta (+40,500)  
- JE-0075 — Liquidity transfer Petty → FHD MZ  
- JE-0076 — (if present in your DB) further transfer in chain  
- JE-0077 — Amount delta to effective total; **tail** of chain for mutability  
- JE-0078 — Duplicate replay row — **already voided** in prior PF-14.7 repair  

**Mistake:** JE-0079 — `correction_reversal` with `reference_id` = **JE-0073** (primary), mirroring **Rs. 4,500** Petty/AR lines instead of reversing the **latest** chain member (which reflects Rs. 50,000 and correct Bank / liquidity path).

---

## 2. Why JE-0079 was wrong

1. **Reverse used the clicked / primary journal id.** The UI and service historically keyed off **whatever journal row** the user acted on (`createReversalEntry(originalJournalEntryId)`), not “current effective payment state.”  
2. **Primary JE still carries the original posting shape** (here Rs. 4,500 on Petty). PF-14 **adjustment** journals carry deltas and transfers; the **economic total** and **final liquidity account** live at the **tail** by `created_at`.  
3. Reversing only JE-0073 **double-counts against the wrong leg**: it removes the obsolete primary from the GL while leaving later PF-14 rows effective — inconsistent with user intent (“undo this receipt as it stands today”).

**Correct business meaning of “reverse this payment”:** only the **tail** row may initiate reverse; the posted `correction_reversal` must offset the **effective payment total** (`payments.amount` on the current liquidity account and party AR/AP), not merely mirror the tail JE’s lines when that tail is a PF-14 **delta** (see §11).

---

## 2b. Follow-up mistake (JE-0080 — Rs 5,000 only)

After tail-locking shipped, reversing from **JE-0077** (correct tail) still produced **JE-0080** at **Rs 5,000** because `createReversalEntry` **mirrored the tail journal’s lines** — and JE-0077 is only the **last amount delta** (45,000 → 50,000). That is GL-correct for “undo JE-0077” but wrong for “undo the whole receipt.” **Fix:** when the payment chain has **more than one** active member, build a **composite** reversal from `payments.amount` + `payment_account_id` + party AR/AP (`paymentChainCompositeReversal.ts` + `accountingService.createReversalEntry`).

If JE-0080 is already posted in your DB, **void** it with an explicit `void_reason`, then use **Reverse** again on the latest row after deploying the composite fix (or post a one-off corrective JE only if void is insufficient).

**Live repair (2026-04-09):** `JE-0080` voided for company `595c08c2-1e47-4581-89c9-1f78de51c613` — `journal_entries.id` = `d4e055f5-42ce-4f28-8373-0cc55c48b381` (reversed tail JE `d1ff4d53-893d-4086-905a-9d8b95d5b651`). Script: `node scripts/void_je_0080_mistaken_delta_reversal.mjs` (or `scripts/void_je_0080_mistaken_delta_reversal.sql`).

---

## 3. Data restore (Phase 1) — void only, no delete

**Action:** Void the mistaken reversal JE so its lines no longer affect balances or reports that exclude void rows.

**Journal entry voided**

| Item | Value |
|------|--------|
| `entry_no` | JE-0079 |
| `id` (as identified in repair session) | `722f76f0-766b-42ee-bc78-e8ce7f07db06` |

**Example SQL** (run against production with appropriate role; adjust `void_reason` text if your policy requires a ticket id):

```sql
UPDATE journal_entries
SET
  is_void = true,
  void_reason = 'Mistaken correction_reversal: targeted primary receipt JE-0073 (Rs 4500) instead of latest PF-14 chain tail for payment 45b0bd3a-4bef-4b75-baa9-f5a41a483217. Void to restore pre-mistake GL; no delete.'
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND id = '722f76f0-766b-42ee-bc78-e8ce7f07db06'
  AND is_void IS DISTINCT FROM true;
```

**No corrective JE** was required if voiding JE-0079 fully neutralized the mistaken reversal and the prior chain (through JE-0077) was already consistent.

**Post-restore verification queries** (liquidity + AR sanity — non-void lines only):

```sql
-- Replace account ids with your chart ids for 1001 / 1012 / 1010 / 1100 party AR as needed.
SELECT account_id, SUM(debit::numeric) AS dr, SUM(credit::numeric) AS cr
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.journal_entry_id
WHERE je.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND je.is_void IS DISTINCT FROM true
  AND je.reference_type IS DISTINCT FROM 'correction_reversal'
GROUP BY account_id
ORDER BY account_id;
```

**Expected narrative after repair** (from session verification): Petty **1001** and FHD MZ **1012** net to **0** on active payment-chain legs; Bank **1010** holds **50,000**; Nadeem AR reflects the sale less the effective receipt total consistent with SL-0004. Re-run your existing `scripts/verify_payment_effective_state_pf14_7.sql` / Truth Lab trace for `payment_id = 45b0bd3a-4bef-4b75-baa9-f5a41a483217` for a signed checklist.

---

## 4. Root cause (Phase 2) — routing

| Question | Answer |
|----------|--------|
| What did reverse operate on? | **The journal entry id passed from the UI** (clicked row or group primary), i.e. **not** an resolved “effective node” until the fix. |
| Why Rs. 4,500? | Reversal **copies lines from the original JE**; that JE was **JE-0073** (primary receipt at 4,500). |
| Responsible layer | **UI:** Journal Entries / ledger modals passing `entry.id` / `transaction.id` into `createReversalEntry`. **Service:** `accountingService.createReversalEntry` did not previously refuse non-tail payment-chain rows. |

---

## 5. Implemented business rules (Phases 3–5)

### 5.1 Chain index (client)

- **`src/app/lib/paymentChainMutability.ts`** — `buildPaymentChainIndex`, `paymentChainFlagsForJournalEntry`: groups rows by `payments.id` (or `payment_adjustment` + `reference_id` = payment id), excludes void and `correction_reversal`, picks **tail** by `created_at`, sets `paymentChainIsHistorical`, `paymentChainIsTail`, `paymentChainTailJournalId`, `paymentChainMemberCount`.

### 5.2 Context metadata

- **`src/app/context/AccountingContext.tsx`** — When converting journal rows to `AccountingEntry`, merges chain flags into `metadata`; `createReversalEntry` catches `PAYMENT_CHAIN_HISTORICAL:` errors and toasts a stripped user message.

### 5.3 Service hardening

- **`src/app/services/accountingService.ts`** — Before posting a reversal, resolves payment chain id from the original row; loads **tail** via `fetchPaymentChainState`; if `tail !== originalJournalEntryId`, **throws** `PAYMENT_CHAIN_HISTORICAL:…`. If the chain has **multiple** active members and the payment type is supported (`sale`, `manual_receipt`, `on_account`, `purchase`, `manual_payment`), posts a **composite** `correction_reversal` for **full `payments.amount`** (Dr AR / Cr liquidity or supplier mirror) instead of mirroring only the tail JE lines; links `payment_id` on the reversal header when composite; voids the `payments` row after composite so allocations and due amounts stay aligned.
- **`src/app/services/paymentChainCompositeReversal.ts`** — Builds effective-total reversal lines from Supabase `payments` + party subledger resolvers.
- **`src/app/services/paymentChainMutationGuard.ts`** — `fetchPaymentChainState` / `fetchPaymentChainActiveEntries` (DRY tail resolution + member count).

### 5.4 Supporting modules

- **`src/app/services/paymentChainMutationGuard.ts`** — `extractPaymentChainIdFromJournalRow`, `fetchPaymentChainTailJournalEntryId` (wraps state), `getPaymentChainMutationBlockReason`, prefix helpers.  
- **`src/app/lib/journalEntryEditPolicy.ts`** — `allowsGenericAccountingUnifiedEdit` returns **false** when `paymentChainIsHistorical`.  
- **`src/app/lib/unifiedTransactionEdit.ts`** — Honors optional `payment_chain_is_historical` / blocked resolution for unified edit.

### 5.5 UI

- **`src/app/components/accounting/TransactionDetailModal.tsx`** — Loads `getPaymentChainMutationBlockReason`; banner; **Reverse** / unified edit disabled when blocked.  
- **`src/app/components/accounting/AccountingDashboard.tsx`** — **By document:** Historical / Latest badges; **Reverse** disabled when group primary ≠ chain tail; **View** opens tail ref when locked. **All entries (audit):** same badges, **Reverse** disabled for historical rows, row click / ref link / **View** open **tail journal id** when historical so the user lands on the editable row.  
- **`src/app/components/accounting/AccountLedgerPage.tsx`** — Opens `TransactionDetailModal` (inherits the same guards).

---

## 6. Reverse targeting rule (authoritative)

1. Resolve **payment chain key** from the candidate journal row: `payment_id` **or** (`reference_type = payment_adjustment` and `reference_id = payments.id`).  
2. Load all **active** chain members for that payment in the company (non-void, not `correction_reversal`).  
3. **Tail** = max `created_at`.  
4. **Mutations** (edit, account change, reverse-as-whole-receipt) are allowed only when `candidate.id === tail.id`.  
5. **Reverse** must be initiated from the **tail** row (UI + server). **Amount semantics:** if `memberCount === 1`, mirror that JE’s lines. If `memberCount > 1` and the payment is sale / manual_receipt / on_account / purchase / manual_payment, post a **composite** reversal for **`payments.amount`** on **`payments.payment_account_id`** vs party AR/AP — **not** the tail JE’s delta-only lines. **Server** rejects reversing non-tail ids even if the UI is bypassed.

---

## 7. Regression checklist (Phase 6)

Performed / expected after deploy:

1. Small receipt on account A → edit amount → change account → edit amount again → change account again.  
2. After each step: refresh Accounting; **no** duplicate primary replay; **only** tail row **Edit** / **Reverse** enabled; older rows show **Historical** and locked **Reverse**.  
3. Attempt reverse on a historical row: **blocked** (button disabled + toast if API called with old id).  
4. Reverse on **Latest**: reversal **GL effect** matches **effective** `payments.amount` (e.g. Rs 50,000), not the tail delta alone (e.g. Rs 5,000).  
5. Nadeem / SL-0004: JE-0079 **void**; active chain ends at intended tail; liquidity and AR tie to expectations.

**Build:** `npm run build` succeeds on the branch containing these changes.

---

## 8. Remaining risks

| Risk | Mitigation |
|------|------------|
| **Clock skew** — tail chosen by `created_at` if sequence is ambiguous | Prefer a future `mutation_sequence` column if you ever see equal timestamps in one chain. |
| **Bypass** — raw SQL or old mobile client | Service-side guard in `createReversalEntry` remains the source of truth. |
| **Grouped row primary is a Sale** — reverse disabled when payment tail exists | User uses **View** to jump to latest payment JE or opens from audit list. |
| **ExpenseContext** direct `accountingService.createReversalEntry` | Expense journals are not payment-chain rows in normal flows; if ever combined, ensure catch maps `PAYMENT_CHAIN_HISTORICAL` to a clear message. |

---

## 9. Deliverables checklist

| Deliverable | Status |
|-------------|--------|
| Wrong reverse neutralized (void JE-0079) | Documented SQL + id above |
| Chain mutability: historical locked | Implemented (UI + policy + service) |
| Reverse targets tail + effective amount | Implemented (`fetchPaymentChainState` + composite reversal when `memberCount > 1`) |
| UX badges / messaging | Journal grouped + **audit** flat list + modal |
| Report | This file |

---

## 10. Screenshot / trace references

- Prior UI: Journal Entries showed **Edit** / **Reverse** on every PF-14 leg (see workspace asset `2026-04-10_23-10-15-cd5712a7-edfb-4b74-a7d9-a9d1d90b22ce.png`).  
- Post-fix: use **Developer Tools → AR/AP Truth Lab** and **Transaction detail → Full payment trace** for `45b0bd3a-4bef-4b75-baa9-f5a41a483217` to confirm mutation order and tail id.

---

## 11. Composite reversal (PF-14 multi-member chain)

| Item | Detail |
|------|--------|
| Trigger | `createReversalEntry` on a journal row that is the **tail** of a payment chain with **memberCount > 1** |
| Supported `payments.reference_type` | `sale`, `manual_receipt`, `on_account`, `purchase`, `manual_payment` |
| Fallback | Other types, or missing `payment_account_id` / amount: **mirror tail lines** (legacy) |
| Idempotency | Unchanged: at most one active `correction_reversal` per `reference_id` = tail JE id |
| Operational | After a successful composite reversal, **`voidPaymentAfterJournalReversal`** runs for that `payments.id` (clears allocations, sets `voided_at`; primary `sale` JE is not void-hidden — composite JE does the GL offset) |

---

*End of report.*
