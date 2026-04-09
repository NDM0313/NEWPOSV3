# Final contacts receipt-edit / stale operational fix

**Date:** 2026-04-06  
**Prior context:** `docs/accounting/FINAL_CONTACTS_ACCOUNTING_LIVE_FIX_REPORT.md` (RPC allocation-aware body, branch filter, recon scope) — **assumed correct; not re-litigated.**

## 1. Exact remaining root cause

### A) Sale-linked customer payment edit skipped FIFO realignment

**Path:** `UnifiedPaymentDialog` edit with `context === 'customer' && referenceId` calls **`saleService.updatePayment(paymentId, saleId, …)`** (invoice / document-linked flow).

**Gap:** `updatePayment` updated `payments.amount`, posted GL **payment adjustment** JEs when needed, and called **`dispatchContactBalancesRefresh`**, but it **never** called **`rebuildManualReceiptAllocations` / `rebuildManualReceiptFifoAllocations`**.

For payments with `reference_type` **`manual_receipt`**, **operational** `get_contact_balances_summary` depends on:

- `sales` due / paid (after allocations), and  
- **`payment_allocations`** for **amount − allocated** on the manual receipt leg.

If the **payment row** was updated to Rs 50,000 but **FIFO allocations and sale totals** were still built for Rs 5,000, the **RPC** could stay on an intermediate operational number (e.g. **70,000**) while **GL / ledger / statements** (driven by adjustment JEs + line logic) showed the **final 25,000**.

**Canonical truth for “what customer owes” operationally:** **`get_contact_balances_summary`** over **aligned** `sales` / `payments` / `payment_allocations`. Ledger/GL can match once postings and document legs are consistent; the bug was **document allocation lag** relative to the edited payment header.

### B) Contacts UI: branch-label effect could interleave with balance phases

A **`useEffect`** that only refreshed `branch` labels ran whenever `companyBranches` / `getBranchLabel` changed **without** considering **`listLoading` / `balancesLoading`**. In theory it could **`setContacts`** in the middle of a balance load and make it **look** like operational numbers flickered or were overwritten (same `receivables`/`payables` on object spread, but ordering with React 18 batching is easier to reason about if the effect is suppressed during loads).

**Fix:** Only run the label-only remount when **`!listLoading && !balancesLoading`**.

### C) Extra safety / observability

- **`myGen` check** after `await Promise.all([…])` and before phase-1 `setContacts` (stale-generation guard; complements existing phase-2 checks).
- **Opt-in dev tracing** for receipt-edit: `localStorage DEBUG_CONTACTS_RECEIPT_EDIT=1` logs phase1/phase2 Salar row + refresh events.

## 2. SALAR reproduction steps (manual)

1. Company `595c08c2-1e47-4581-89c9-1f78de51c613`, customer **Salar**.
2. Ensure opening / sales / receipt such that **true** outstanding operational is **Rs 25,000** after edits.
3. Use **customer receipt** flow (including **Edit payment** from a context that uses **`saleService.updatePayment`** with a **referenceId**).
4. Change receipt amount (e.g. **5,000 → 50,000**) and save.
5. **Before fix:** Contacts grey operational could stick at an **intermediate** value (e.g. **70,000**) while Customer Ledger / reconciliation / statement showed **25,000**.
6. **After fix:** `updatePayment` runs **`rebuildManualReceiptAllocations`** for `manual_receipt` (FIFO helper only supports that type), then refresh events; Contacts row + RECV card should match RPC (**25,000** for current live data below).

## 3. Exact SQL run (VPS, `psql -U postgres`)

```sql
SELECT c.id, c.name, c.opening_balance,
  (SELECT json_agg(json_build_object('id', p.id, 'amount', p.amount, 'ref', p.reference_type, 'voided', p.voided_at IS NOT NULL))
   FROM payments p WHERE p.company_id = c.company_id AND p.contact_id = c.id AND p.payment_type::text = 'received') AS receipts
FROM contacts c WHERE c.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid AND c.name IN ('Salar','ABC','Ali');

SELECT contact_id, c.name, p.amount, p.reference_type::text,
  (SELECT coalesce(sum(pa.allocated_amount),0) FROM payment_allocations pa WHERE pa.payment_id = p.id) AS allocated
FROM payments p JOIN contacts c ON c.id = p.contact_id
WHERE p.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid AND c.name = 'Salar' AND p.payment_type::text = 'received';

SELECT name, receivables, payables FROM contacts c
JOIN LATERAL get_contact_balances_summary('595c08c2-1e47-4581-89c9-1f78de51c613'::uuid, NULL::uuid) b ON b.contact_id = c.id
WHERE c.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid AND c.name IN ('Salar','ABC','Ali') ORDER BY name;
```

**Live snapshot after this fix session (RPC NULL branch):**

| name  | receivables | payables |
|-------|------------:|---------:|
| ABC   | 105,000.00  | 0        |
| Ali   | 25,000.00   | 0        |
| Salar | **25,000.00** | 0      |

**Salar payment row:** one `manual_receipt`, amount **50,000**, **allocated 0** (unallocated against opening), opening **75,000** → operational **25,000** consistent with RPC.

**Supplier spot check (no regression):**

| name        | payables   |
|-------------|-----------:|
| DIN COUTURE | 415,000.00 |
| KHURAM SILK | 575,060.00 |

## 4. Frontend event trace (intended after patch)

On successful **`saleService.updatePayment`** for `manual_receipt`:

1. `rebuildManualReceiptAllocations(paymentId)` (FIFO + sale/payment alignment).
2. `dispatchContactBalancesRefresh(companyId)` → **`CONTACT_BALANCES_REFRESH_EVENT`**.
3. `ledgerUpdated` `{ ledgerType: 'customer', entityId: contact_id }`.

`UnifiedPaymentDialog` still calls **`dispatchContactBalancesRefresh`** + **`dispatchAccountingEditCommitted`** on success → **`accountingEntriesChanged`**, **`paymentAdded`**, **`ledgerUpdated`** again.

**ContactsPage** reloads via **`CONTACT_BALANCES_REFRESH_EVENT`**, **`accountingEntriesChanged`**, **`paymentAdded`**, **`ledgerUpdated`**, **`focus`**. Multiple serialised loads are OK (in-progress ref + pending refresh); operational merge remains **only** from **`get_contact_balances_summary`** in phase 2.

**Opt-in logging:** set `localStorage DEBUG_CONTACTS_RECEIPT_EDIT=1` in dev to log phase1/phase2 Salar merge and each refresh event.

## 5. Exact files changed

| File | Change |
|------|--------|
| `src/app/services/saleService.ts` | After `updatePayment` succeeds: **`rebuildManualReceiptAllocations`** for `manual_receipt` only; **`ledgerUpdated(customer)`**; keep **`dispatchContactBalancesRefresh`**. |
| `src/app/components/contacts/ContactsPage.tsx` | Stale-gen guard before phase1; branch-label effect gated by **`!listLoading && !balancesLoading`**; opt-in **`DEBUG_CONTACTS_RECEIPT_EDIT`** trace logs. |

## 6. Before / after table (conceptual for SALAR bug class)

| Surface | Before (failure mode) | After |
|---------|-------------------------|--------|
| DB `payments.amount` | 50,000 | 50,000 |
| `payment_allocations` / sale paid | Could lag at old split | Rebuilt via FIFO after edit |
| `get_contact_balances_summary` | Could show stale OP (e.g. 70k) | Matches aligned docs (e.g. 25k) |
| Contacts grey row | Could mirror stale RPC | Matches RPC after reload |
| Ledger / statement | Often already GL-correct | Unchanged expectation |

**ABC / Ali / suppliers:** Re-run RPC on VPS after patch — **no intentional regression**; supplier totals unchanged in spot check.

## 7. Proof: no stale overwrite from branch-label effect

Branch relabel **`useEffect`** no longer runs while **`listLoading || balancesLoading`**, so it does not interleave with phase 1/2 **`setContacts`** for balances. Label updates run once the list is idle.

## 8. Proof: no hard reload required

Refresh is still driven by existing window events plus **`dispatchContactBalancesRefresh`** and **`ledgerUpdated`** from **`updatePayment`**. No new requirement for full page reload.

## 9. ABC regression check

VPS RPC: **ABC 105,000**, **Ali 25,000** — consistent with prior stabilized RPC behavior.

## 10. Build result

`npm run build` — **succeeded** (exit 0).

## 11. Honest residual risk

- If a **non–`saleService.updatePayment`** path edits a manual receipt **without** FIFO rebuild, the same class of bug could recur — grep other `payments.update` call sites for `manual_receipt`.
- **RLS** or **replica lag** could still cause rare transient RPC drift; not addressed here.
