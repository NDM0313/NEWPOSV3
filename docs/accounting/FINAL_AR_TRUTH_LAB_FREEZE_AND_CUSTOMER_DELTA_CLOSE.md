# FINAL: AR Truth Lab, Legacy Ledger Freeze, Customer AR Delta (Operational vs Party GL)

**Date:** 2026-04-09  
**Scope:** Freeze legacy mixed ledger UX, ship canonical **AR/AP Truth Lab** (`/test/ar-ap-truth-lab`), line-attribute company receivables variance **27,500**, live VPS SQL evidence, numbering verification.

---

## 1. Screen → source map

| UI / screen | Primary source | Notes |
|-------------|----------------|-------|
| Contacts — RECV (operational total) | `get_contact_balances_summary` | Sum of receivables for scoped contacts; not GL. |
| Contacts — Party GL (1100 signed) | `get_contact_party_gl_balances` | Per-contact AR/AP/worker GL slices from journal attribution. |
| AR/AP Reconciliation Center — variance | Same two RPCs vs GL control snapshot | No frontend-forced equality. |
| Customer statement (Contacts full-screen) | `CustomerLedgerPageOriginal` — **LEGACY** | Three tabs (operational / GL / recon); labeled legacy; not canonical SOT. |
| Supplier/worker statement (Contacts) | `GenericLedgerView` — **LEGACY** | Same warning in header. |
| **AR/AP Truth Lab** (new) | `get_contact_balances_summary`, `get_contact_party_gl_balances`, `customerLedgerAPI.getLedgerSummary` OR `getSupplierOperationalLedgerData`, `get_customer_ar_gl_ledger_for_contact` / `get_supplier_ap_gl_ledger_for_contact`, `v_ar_ap_unmapped_journals`, manual receipt allocations | One contact, one basis (AR or AP), explicit tables. |

---

## 2. SQL run on VPS (live)

**Host:** `ssh dincouture-vps`  
**DB:** `docker exec -i supabase-db psql -U supabase_admin -d postgres`

**Company ID used:** `595c08c2-1e47-4581-89c9-1f78de51c613`  
**Branch:** `NULL` (company-wide) for RPCs below.

### 2.1 Company receivables roll-up (already confirmed)

- Sum operational receivables (`get_contact_balances_summary`, customers + both): **227,001**
- Sum party GL AR (`get_contact_party_gl_balances`): **199,501**
- **Variance:** **27,500**

### 2.2 Per-contact IDs (ABC, Ali, Salar)

```sql
SELECT id, name, type, code FROM contacts
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
  AND name ILIKE ANY (ARRAY['%ABC%','%Ali%','%Salar%'])
ORDER BY name;
```

| Name  | id | type | code |
|-------|-----|------|------|
| ABC   | `cc36436f-789c-4fd0-b6ed-e670a47a47e2` | both | CUS-0003 |
| Ali   | `580e0f30-6f06-46ca-83f6-24bd75ec1f23` | customer | CUS-0001 |
| Salar | `2e78da1f-dabf-4622-aa2c-276f8f69d992` | customer | CUS-0002 |

### 2.3 Per-contact operational vs party GL (NULL branch)

| Contact | OP recv | GL AR | OP − GL |
|---------|--------:|------:|--------:|
| ABC     | 105,000 | 55,000 | **+50,000** |
| Ali     | 25,001  | 47,501 | **−22,500** |
| Salar   | 97,000  | 97,000 | **0** |

**Check:** 50,000 + (−22,500) = **27,500** → entire company receivables variance is explained by **ABC + Ali** only (no third mystery contact in this roll-up).

### 2.4 Unmapped AR journal (reconciliation view)

Query against `v_reconciliation_ar_ap_line_audit` (heuristic `is_unmapped_heuristic`):

- One AR line: **JE-0049**, `reference_type = correction_reversal`, **1100** debit **40,000**, `entry_no = JE-0049`, `journal_entry_id = 1fb4cce9-9f9e-4ffd-bbe5-e678c4f7e0b4`.

### 2.5 Salar — SL-0002 and 50,000 receipt (control path)

**Sale**

| invoice_no | total | paid_amount | due_amount | customer_id |
|------------|------:|------------:|-----------:|-------------|
| SL-0002 | 122,000.00 | 50,000.00 | 72,000.00 | Salar |

**Payments (sample rows for the three contacts)**

| reference_number | reference_type | amount | contact | voided |
|------------------|-----------------|-------|---------|--------|
| PAY-0015 | manual_receipt | 50,000 | Salar | live |
| PAY-0016 | manual_receipt | 40,000 | ABC | **voided** 2026-04-09 |
| PAY-0006 | manual_receipt | 50,000 | ABC | voided |
| PAY-0011 | manual_receipt | 50,000 | ABC | live |
| PAY-0014 | manual_receipt | 24,999 | Ali | live |

Salar’s operational receivable and party GL AR both **97,000** → **control case: no per-contact OP vs GL gap** after SL-0002 + 50k receipt path.

---

## 3. Why ABC differs (105,000 vs 55,000)

- **Operational** side (open-document / `get_contact_balances_summary`) reflects **full** customer receivable position from sales, receipts, void rules, and allocations — including activity that may not sit in party GL at the same net (timing, reversals, mapping).
- **Party GL** side is **1100 subtree** net for that contact via `get_contact_party_gl_balances` / AR GL ledger RPCs.
- Live data shows **large positive delta (OP > GL)** for ABC: consistent with **more operational receivable than journal net** on the party slice (e.g. document-side credits vs journal reversals such as **JE-0049** reversing a **FROM CONTACT** flow, voided manual receipts, or attribution gaps). The Truth Lab surfaces **JE-0049** as an unmapped-heuristic AR line for review (not auto-cleared in UI).

---

## 4. Why Ali differs (25,001 vs 47,501)

- **Negative delta (OP − GL):** GL party AR **higher** than operational receivable for Ali — typical patterns include **journal-side AR** (manual postings, child 1100 mapping, or payments not yet reflected the same way operationally). Truth Lab shows both numbers explicitly; no subtraction trick to force equality.

---

## 5. Why Salar matches (97,000 vs 97,000)

- After **SL-0002** (122k sale, 50k paid, 72k due) and the **50,000** `manual_receipt` (**PAY-0015**) on **2026-04-09**, operational receivable and party GL AR both land at **97,000** in live RPC output — suitable **control** for “sale + receipt + GL” alignment.

---

## 6. What was frozen (legacy)

- **Customer statement** (`CustomerLedgerPageOriginal`): prominent **LEGACY** banner; points to Truth Lab / reconciliation flows.
- **Supplier/worker full-screen statement** from Contacts: **LEGACY** copy in header.
- **Developer Tools → Customer Ledger Test:** label → **Legacy: Customer Ledger Test**; subtitle warns not canonical.

No new canonical business rules were added inside those legacy surfaces in this pass.

---

## 7. What was added (Truth Lab)

- **Route:** `/test/ar-ap-truth-lab`
- **Nav:** Developer Tools → **AR / AP Truth Lab (canonical)**
- **Implementation:** `src/app/components/test/ArApTruthLabPage.tsx`, `src/app/services/arApTruthLabService.ts`
- **Behavior:** One contact, one AR/AP basis; cards for operational (Contacts RPC), party GL, delta, company unmapped JE count, allocated/unallocated manual receipts (AR); sections for operational movement, GL lines, delta explainer (heuristic buckets), exception queue (`v_ar_ap_unmapped_journals`).

---

## 8. Numbering verification (RCV / PAY / company-wise)

Live query on `erp_document_sequences` (same company):

- **`CUSTOMER_RECEIPT`** → prefix **`RCV`**, `last_number` seeded for year (new receipts use **RCV-xxxx** per engine).
- **`PAYMENT`** / outgoing series → prefix **`PAY`** (historical rows still show **PAY-xxxx**; no silent renumber of historical `payments.reference_number`).
- **`EXPENSE`** → **`EXP-xxxx`** where configured.
- Sequences are **per company** (and branch where branch-based rows exist); no shared counter across companies.

Application code routes new document types `customer_receipt`, `supplier_payment`, `expense` through `documentNumberService` / ERP numbering (see branch diff).

---

## 9. Build result

- **`npm run build`:** **passed** (2026-04-09 in this workspace).

---

## 10. Closing statement

**Not “fixed” by forcing OP = GL.** The **27,500** company receivables gap is **fully line-attributed at contact level** to **ABC (+50,000)** and **Ali (−22,500)**; **Salar** is the **matched control**. One **unmapped-heuristic AR JE** (**JE-0049**, `correction_reversal`, 40k on 1100) remains visible for mapping/reversal/exclusion decisions.

**Outcome:** **Real business / mapping variance remains, now surfaced explicitly** in Truth Lab, Reconciliation Center, and Contacts party GL strip — without frontend fake reconciliation or legacy mixed ledger as source of truth.
