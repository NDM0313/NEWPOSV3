# Data & Ledger Rules – Master Entities, Insertion Order, Testing

## PART 1 – Master Entities (Base)

Verify these tables are clean and use unique IDs:

| Entity     | Table / concept        | Notes |
|------------|------------------------|--------|
| Customers  | contacts (type customer) / customers | Unique IDs, no duplicates. |
| Suppliers  | contacts (type supplier) / suppliers | Unique IDs. |
| Users      | users / staff / admin  | Staff, salesman, admin. **User ≠ Worker.** |
| Workers    | workers                | Production only. Not users. |
| Products   | products               | Unique IDs. |
| Accounts   | chart of accounts      | Cash, Bank, AR, AP, etc. |

**Rules:**
- **User ≠ Worker.** Salary/commission/bonus/advance apply only to **User**. Job payment applies only to **Worker**.
- No module uses another module’s document counter (see REFERENCE_NUMBERING_ANALYSIS.md).

---

## PART 2 – Proper Data Insertion (Correct Order)

### STEP 1: Sales (Regular + Studio)

- **Regular Sale**
  - `invoice_no` = **SL-xxxx** (from Numbering Rules).
  - `customer_id` required.
  - Accounting: Customer Ledger → Debit; Sales Account → Credit.

- **Studio Sale**
  - `invoice_no` = **STD-xxxx**.
  - `customer_id` required.
  - Creates `studio_production` with `sale_id` = sale.id; stages (e.g. Dyeing / Handwork / Stitching) created.

### STEP 2: Studio → Worker Jobs

When a worker is assigned and/or a stage is completed:

- Create **worker_ledger_entries**:
  - `document_no` = **JOB-xxxx** (from Numbering Rules).
  - `ref_id` = `studio_production_stage.id`.
  - `amount` = worker cost.
  - `status` = unpaid.
- No payment here; only payable is created.

### STEP 3: Worker Payment (Later)

When paying the worker:

- Payment ref = **PAY-xxxx**.
- Update `worker_ledger_entries.status` = paid; set `payment_reference` = PAY-xxxx where applicable.
- Accounting: Worker Payable → Debit; Cash/Bank → Credit.

### STEP 4: Purchases → Supplier Ledger

- Ref = **PUR-xxxx**; `supplier_id` required.
- Supplier Ledger: Credit (we owe supplier). If payment at same time: Debit also posted.

### STEP 5: Expenses → User Ledger

- **Only for Users** (not Workers).
- Types: Salary, Commission, Bonus, Advance → Debit. Payment → Credit.
- Worker does not appear in User Ledger for these.

### STEP 6: Accounting Ledger Sync

- All ledger entries come **from modules** (Sale, Studio, Purchase, Expense, Payment, Job).
- **No manual ledger-only inserts** for these flows; modules push to ledger.

---

## PART 3 – Final Testing Checklist

### Customer Ledger
- [ ] Only **SL** / **STD** sales and payments.
- [ ] Aging correct.
- [ ] Balance = invoice − payment.

### Supplier Ledger
- [ ] Only **PUR** and payments.
- [ ] Balance = payable.

### User Ledger
- [ ] Only salary / commission / bonus and payments.
- [ ] No sales, no purchases.

### Worker Ledger
- [ ] **JOB** references (JOB-xxxx) for stage payables.
- [ ] Unpaid vs paid clear; payment ref (PAY-xxxx) when paid.
- [ ] Stage name + STD reference visible where applicable.

### Global
- [ ] Every reference clickable where designed.
- [ ] No orphan entries.
- [ ] No ledger empty when data exists for that entity.

---

## Recommendation

1. **Normalize** existing data to match the above rules.
2. **Insert fresh test data:** 1–2 customers, 1–2 suppliers, 2 users, 6 workers.
3. **Run full flow** end-to-end (sales → studio → jobs → payments → purchases → expenses).
4. **Then** allow production data.
