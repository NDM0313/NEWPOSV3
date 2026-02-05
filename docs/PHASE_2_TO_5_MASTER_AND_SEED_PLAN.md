# Phase 2–5: Master Data, Transaction Flows, Seed Strategy, Validation

This document follows **Phase 1 – Frontend Data Requirement Blueprint** (`FRONTEND_DATA_REQUIREMENT_BLUEPRINT.md`). Blueprint defines what each screen needs; here we lock master data design, transaction order, seed strategy, and validation.

---

## Phase 2 – Master Data Design (Linked)

All master data is linked; no orphan records. Counts are minimums for a testable seed.

### Users (Staff / Admin)

| Role      | Count | Link to ledger |
|-----------|-------|-----------------|
| Admin     | 1     | Can have user ledger for salary/expense if paid to self or used in expense. |
| Salesman  | 1     | **Mandatory:** Salary/expense user ledger linked (debit = salary or expense, credit = payment PAY-xxxx). |

**Tables:** `users`, `user_branches`, `companies`, `branches`. User ledger = `ledger_master` (ledger_type = 'user', entity_id = user id) + `ledger_entries`.

---

### Workers (Production Only)

| Category   | Count | Requirement |
|------------|-------|--------------|
| Dyeing     | 2     | Each has rows in `workers`; used in studio_production_stages (stage_type = dyer). |
| Stitching  | 2     | Same; stage_type = stitching. |
| Handwork   | 2     | Same; stage_type = handwork. |
| **Total**  | **6** | Every worker has own ledger: `worker_ledger_entries` with JOB-xxxx and optionally PAY-xxxx. |

**Tables:** `workers` (company_id). Ledger: `worker_ledger_entries.worker_id` → workers.id; `document_no` = JOB-xxxx; `payment_reference` = PAY-xxxx when paid.

---

### Customers

| Type              | Count | Requirement |
|-------------------|-------|--------------|
| Regular customers | 3–4   | Used in SL sales; customer ledger shows SL + payments. |
| Studio customers  | 2–3   | Used in STD sales; same customer ledger (SL/STD + payments). |
| **Total**         | **5–6** | All in `contacts` with type = 'customer'. Ledger from sales + payments (customerLedgerApi / ledger). |

---

### Suppliers

| Count | Requirement |
|-------|--------------|
| 1–2   | `contacts` type = 'supplier'. Purchases (PUR-xxxx) and payments (PAY-xxxx) post to supplier ledger (`ledger_master` + `ledger_entries`). |

---

### Products

| Type            | Count   | Requirement |
|-----------------|---------|--------------|
| Simple          | 4–6     | No variations; used in sale_items, purchase_items, inventory, studio productions. |
| With variations | 2–4     | `product_variations` linked; same usage as simple. |
| **Total**       | **8–10**| All linked: sale_items, inventory, studio_productions, purchase_items. |

**Tables:** `products`, `product_categories`, `product_variations`. Every product has category_id.

---

## Phase 3 – Transaction Flow Design (End-to-End)

**Rule:** No entry stands alone; every record has a reference (document no or link to parent).

### Regular Sale Flow

```
Product → Sale (SL-xxxx) → Sale Items → Customer Ledger (debit invoice, credit payment)
```

- `sales.invoice_no` = SL-xxxx, `sales.customer_id` required.
- `sales_items.sale_id` → sales.id, product_id → products.id.
- Customer ledger: sales (SL) + payments (PAY); balance = invoice − payment.

---

### Studio Sale Flow

```
Product → Studio Sale (STD-xxxx) → Studio Production → Stage (Dyeing/Stitching/Handwork)
  → Worker Job (JOB-xxxx) → Worker Ledger (unpaid → paid with PAY-xxxx)
  → Customer Ledger (STD + payments)
```

- `sales.is_studio` = true, invoice_no = STD-xxxx.
- `studio_productions.sale_id` → sales.id; `studio_production_stages.production_id` → productions.id.
- Stage completion → `worker_ledger_entries` with document_no = JOB-xxxx, reference_id = stage id.
- Worker payment → PAY-xxxx, update worker_ledger_entries.status = paid, payment_reference = PAY-xxxx.
- Customer ledger: STD sales + payments.

---

### Purchase Flow

```
Supplier → Purchase (PUR-xxxx) → Purchase Items
  → Payment (PAY-xxxx) → Supplier Ledger (credit PUR, debit PAY)
```

- `purchases.po_no` = PUR-xxxx, supplier_id required.
- Supplier ledger: ledger_master (entity_id = supplier_id, type = 'supplier') + ledger_entries (source = purchase | payment).

---

### Expense / Salary (User Ledger)

```
Expense (EXP-xxxx) → User Ledger (debit salary/expense)
  → Payment (PAY-xxxx) → User Ledger (credit)
```

- Expense category = salary/commission/bonus/advance; paidToUserId = user → debit to that user’s ledger.
- Payment to user → credit to same ledger. Only **users** (not workers) in this flow.

---

## Phase 4 – Clean Seed Strategy (ONE TIME)

**No SQL seed written in Phase 1.** Here we define how the one-time seed is done.

### Database Handling

1. **TRUNCATE** all business tables in dependency-safe order (learned: activity_logs, journal_entry_lines, journal_entries before accounts; then child tables before parents).
2. **Single company + single branch** for seed.
3. **Auth user** already linked to that company/branch in `public.users` and `user_branches` (no seed of auth; link existing auth user to seeded company).

### Fresh Seed Insert Order

Strict order (no orphan FKs):

1. **Company / Branch** (if not exists)
2. **Users** (admin, salesman) + user_branches
3. **Contacts:** Customers, Suppliers, Workers (or workers table + sync from contacts if applicable)
4. **Products + Categories + Variations**
5. **Accounts** (chart of accounts)
6. **Sales** (SL + STD) with correct invoice_no
7. **Sale Items** (sales_items) for each sale
8. **Studio Productions** (linked to STD sales)
9. **Studio Stages** (dyeing/stitching/handwork) with assigned workers
10. **Worker Jobs** (worker_ledger_entries with JOB-xxxx, some paid with PAY-xxxx)
11. **Purchases** (PUR-xxxx) + purchase_items
12. **Expenses** (EXP-xxxx) + user ledger entries where applicable
13. **Payments** (PAY-xxxx) for customer, supplier, worker, user
14. **Ledgers** (ledger_master, ledger_entries for supplier/user; customer from sales+payments; worker_ledger_entries already in step 10)
15. **Document sequences** (document_sequences) so next numbers are correct (e.g. SL-0003, STD-0003, PAY-0010, JOB-0007)

**Rules:**

- No dummy orphan data.
- Every entity clickable and viewable (sale → items → production → stages → worker ledger; purchase → supplier ledger; expense → user ledger).
- All references (SL, STD, PUR, EXP, PAY, JOB) used consistently.

---

## Phase 5 – Validation Checklist (Before Moving Forward)

After seed runs, verify; **if any check fails → fix seed, do not proceed.**

### Sales & Items

- [ ] **View Sale (SL)** → Items show (sales_items with product/variation names).
- [ ] **View Studio Sale (STD)** → Productions and stages show; stages show worker and cost.

### Studio & Workers

- [ ] **Studio Sale → Production** → Production detail shows stages (Dyeing/Stitching/Handwork).
- [ ] **Worker Ledger** → JOB-xxxx ref + amount; unpaid vs paid; PAY-xxxx when paid; stage/production/sale ref visible where designed.

### Purchases & Supplier

- [ ] **Supplier Ledger** → Purchases (PUR) and payments (PAY) show; balance correct.

### Expenses & User

- [ ] **User Ledger** → Salary/expense entries (EXP or category) and payments (PAY); no sales/purchases in user ledger.

### Accounting & Global

- [ ] **Accounting totals** match (e.g. account balances consistent with journal_entry_lines and ledger summaries).
- [ ] **Inventory** updates where expected (e.g. sale reduces stock, purchase increases, studio completion adds finished goods if applicable).
- [ ] **Every reference** clickable where designed (sale → items, production → stages, ledger → source document).
- [ ] **No orphan** ledger entries or documents.

---

## Document Cross-Reference

| Phase | Document / output |
|-------|--------------------|
| 1     | `FRONTEND_DATA_REQUIREMENT_BLUEPRINT.md` – screens, data, tables, relations |
| 2     | This doc – Master Data Design (users, workers, customers, suppliers, products) |
| 3     | This doc – Transaction Flow Design (SL, STD, Purchase, Expense/User) |
| 4     | This doc – Clean Seed Strategy (order, no orphans) |
| 5     | This doc – Validation Checklist |

Existing seed script: `seed/fresh_data_seed.sql`. Align it with this plan and the blueprint; run after truncate and auth-user link.
