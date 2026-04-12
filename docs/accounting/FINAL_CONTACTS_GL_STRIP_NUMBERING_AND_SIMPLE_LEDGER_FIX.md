# Final: Contacts GL strip, RCV/PAY numbering, simple ledger

**Date:** 2026-04-09  
**Company traced on VPS:** `595c08c2-1e47-4581-89c9-1f78de51c613`  
**Shell:** `ssh dincouture-vps` → `docker exec -i supabase-db psql -U supabase_admin -d postgres`

---

## 1. Screen → source map (exact)

| Surface | Operational (grey) | GL mini-line / party column |
|--------|----------------------|-----------------------------|
| **Contacts row** | `get_contact_balances_summary` via `contactService.getContactBalancesSummary` | `get_contact_party_gl_balances` via `contactService.getContactPartyGlBalancesMap` |
| **Customer statement — Operational tab** | `customerLedgerAPI` (sales + payments + opening) | N/A |
| **Customer statement — GL tab** (fixed) | N/A | `accountingService.getCustomerArGlJournalLedger` → RPC `get_customer_ar_gl_ledger_for_contact` |
| **Customer statement — Reconciliation tab** | `get_contact_balances_summary` (per contact) | `get_contact_party_gl_balances` (per contact) via `getSingleCustomerPartyReconciliation` |
| **AR/AP Reconciliation Center** | Company-level RPCs + party maps (existing) | Same party GL family as Contacts |

---

## 2. Mandatory SQL run (live IDs)

**Contacts + receipts**

```sql
SELECT c.id, c.name, c.opening_balance,
  (SELECT json_agg(json_build_object('id', p.id, 'amount', p.amount, 'ref', p.reference_type, 'refno', p.reference_number))
   FROM payments p WHERE p.company_id = c.company_id AND p.contact_id = c.id AND p.payment_type::text = 'received' AND p.voided_at IS NULL) AS receipts
FROM contacts c WHERE c.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid AND c.name IN ('ABC','Ali','Salar') ORDER BY c.name;
```

**Result (2026-04-09)**

| name  | id (contact)                         | opening_balance | receipt ref |
|-------|--------------------------------------|-----------------|---------------|
| ABC   | `cc36436f-789c-4fd0-b6ed-e670a47a47e2` | 55,000          | `manual_receipt` PAY-0011, 50,000 |
| Ali   | `580e0f30-6f06-46ca-83f6-24bd75ec1f23` | 50,000          | `manual_receipt` PAY-0014, 24,999 |
| Salar | `2e78da1f-dabf-4622-aa2c-276f8f69d992` | 75,000          | `manual_receipt` PAY-0015, 50,000 |

**Operational vs party GL (NULL branch)**

```sql
SELECT c.name, b.receivables, g.gl_ar_receivable
FROM contacts c
JOIN LATERAL get_contact_balances_summary('595c08c2-1e47-4581-89c9-1f78de51c613'::uuid, NULL::uuid) b ON b.contact_id = c.id
JOIN LATERAL get_contact_party_gl_balances('595c08c2-1e47-4581-89c9-1f78de51c613'::uuid, NULL::uuid) g ON g.contact_id = c.id
WHERE c.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid AND c.name IN ('ABC','Ali','Salar') ORDER BY c.name;
```

| name  | receivables (OP) | gl_ar_receivable |
|-------|-----------------:|-----------------:|
| ABC   | 105,000.00       | 55,000.00        |
| Ali   | 25,001.00        | 47,501.00        |
| Salar | 25,000.00        | 25,000.00        |

**AR GL ledger JSON for ABC** (proves closing = party GL)

```sql
SELECT get_customer_ar_gl_ledger_for_contact(
  '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid,
  'cc36436f-789c-4fd0-b6ed-e670a47a47e2'::uuid,
  NULL::uuid, NULL::date, CURRENT_DATE
);
```

Last line `running_balance` in result = **55,000** = `gl_ar_receivable` for ABC.

---

## 3. Root cause — why Contacts “GL” looked wrong vs Customer Ledger “GL”

- **Contacts mini GL** was already driven by **`get_contact_party_gl_balances`** (correct party slice).
- **Customer statement → GL tab** used **`getCustomerLedger(..., 'gl_journal_only')`**, which filters raw `journal_entry_lines` in TypeScript (`arJournalLineMatchesCustomer`). That path can **diverge** from the SQL party resolver + **1100 subtree** logic used by `get_contact_party_gl_balances` / `get_customer_ar_gl_ledger_for_contact` (e.g. child AR accounts, resolver edge cases).
- **Reconciliation tab** already used the **same RPC** as Contacts for GL AR — so Reconciliation matched Contacts, but the **GL tab did not**.

**ABC (105,000 OP vs 55,000 GL)**  
- **Operational** = document/RPC truth (opening + open sales − allocated receipts, etc.).  
- **Party GL** = net Dr−Cr on **1100 subtree** attributed to the contact. Live ledger JSON shows multiple postings on control and child AR accounts; **final party net 55,000** matches `get_contact_party_gl_balances`. The 50,000 gap is **real variance between subledger rules and posted journal attribution**, not a Contacts UI bug.

**Ali (25,001 OP vs 47,501 GL)**  
- Same pattern: **RPC operational** below **party GL AR** (journal shows higher exposure than open-document roll-up). The earlier “1 rupee” symptom can appear from rounding/unallocated legs; live snapshot shows **25,001 vs 47,501**.

**Salar (25,000 vs 25,000)**  
- **Control case**: operational receivable and party GL AR **match** — confirms the pipeline is sound when postings align with documents.

---

## 4. Code changes (this fix)

| Area | Change |
|------|--------|
| **Customer statement GL tab** | `CustomerLedgerPageOriginal.tsx`: load **`getCustomerArGlJournalLedger`** with **life-to-date** dates (`undefined`/`undefined`), not `getCustomerLedger` `gl_journal_only`. |
| **Contacts copy** | `ContactsPage.tsx`: balance notes now state mini GL matches **Customer statement GL + Reconciliation** engine. |
| **Numbering: RCV vs PAY** | New migration `migrations/20260432_erp_customer_receipt_prefix_rcv.sql`: `CUSTOMER_RECEIPT` → **RCV**, `SUPPLIER_PAYMENT` → **PAY**. |
| **TS `ErpDocumentType`** | `documentNumberService.ts`: `customer_receipt`, `supplier_payment`. |
| **Customer money in** | `saleService` (sale + on-account receipts), `AccountingContext` manual receipt, `addEntryV2Service.createCustomerReceiptEntry` → **`customer_receipt`**. |
| **Money out / supplier / worker / courier** | `supplier_payment` or same PAY series via `supplier_payment` / existing payment types; `addEntryV2Service` supplier/worker/courier use **`getOutgoingPaymentRef`**. |
| **Expense payment rows** | `AccountingContext` + `addEntryV2Service` expense path → **`expense`** doc type (**EXP-**). |
| **Simple statement (dev)** | `SimpleCanonicalStatementPage.tsx` + route **`/test/simple-canonical-statement`**. |

---

## 5. Numbering design (company-scoped)

- **Engine:** existing `generate_document_number` / `erp_document_sequences` keyed by **`(company_id, branch_id sentinel, document_type, year)`** — already company-scoped.
- **New document types:** `CUSTOMER_RECEIPT` (RCV-…), `SUPPLIER_PAYMENT` (PAY-…, shared with outgoing payment style). **Historical rows are not rewritten.**

**Deploy DB migration on VPS (owner may need `supabase_admin`):**

```bash
Get-Content migrations/20260432_erp_customer_receipt_prefix_rcv.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1"
```

---

## 6. SKU / product code safety (audit)

- `migrations/product_categories_brands_sku_fix.sql` documents **`UNIQUE (company_id, sku)`** when applied — SKU is **company-scoped**, not a single global sequence across tenants.
- **No change** to SKU generation in this pass; a full migration to branch-based SKU would be a separate project.

---

## 7. Simple canonical statement (new)

- **Route:** `/test/simple-canonical-statement`
- **Purpose:** Operational summary (customer) **or** GL/reconciliation pair from the **same RPCs as Contacts**, explicitly **one engine at a time** — no blended running balance.

---

## 8. Remaining / related surfaces

- **Reports → Account ledger** with **Customer** statement type still uses **`getCustomerLedger`** (blended operational + journal) for the default customer view — different product from the **three-tab Customer statement**. Users who need pure GL should use **Customer statement → GL** or **account 1100 + linked contact** mode where applicable.

---

## 9. Build

`npm run build` — **succeeded** (exit 0).

---

## 10. Blockers

- **DB migration** `20260432_erp_customer_receipt_prefix_rcv.sql` must be applied on each environment before **`customer_receipt`** / **`supplier_payment`** types resolve to **RCV** / **PAY**; otherwise RPC may fall through `erp_document_default_prefix` ELSE branch.
- **ABC / Ali** OP vs GL variance remains **data/attribution truth sets**, not fixed by UI math — investigate journals (child AR vs control, allocations, manual JEs) using Integrity Lab / AR-AP center.
