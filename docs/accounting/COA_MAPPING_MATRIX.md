# COA Mapping Matrix (Phase 2)

**Status:** Locked from Phase 2. Every business component maps to one explicit GL rule.  
**Reference:** `docs/accounting/RESET COMPANY/ACCOUNTING_PHASE_PLAN_AND_PROMPTS.md` — Phase 2.

---

## 1. Final COA mapping matrix

| Component | Canonical code | Account name | Used for |
|-----------|----------------|-------------|----------|
| **Sale revenue** | 4000 (sale JEs) / **4100** (default COA seed) | Sales Revenue | Cr product revenue on sale finalize |
| **Accounts receivable** | 1100 | Accounts Receivable | Dr on credit sale; Cr on customer payment |
| **Sales discount** | 5200 | Discount Allowed | Dr on sale discount (contra-revenue) |
| **Shipping income** | **4110** | Shipping Income | Cr when shipping charged to customer (not 4100 — that is Sales Revenue in seed) |
| **Sale extra expense** | 5300 | Extra Expense | Dr when sale has extra expense; Cr = Cash (1000) or **AP 2000** (not 2020) |
| **Inventory** | **1200** | Inventory | Dr purchase; Cr COGS; single asset account for stock |
| **COGS** | 5000 | Cost of Production | Dr on sale (COGS); Cr on reversal |
| **Supplier payable** | **2000** | Accounts Payable | Cr on purchase; Dr on supplier payment; **sale extra expense credit when payable** |
| **Purchase discount** | 5210 | Discount Received | Cr on purchase discount (prefer 5210); fallback name "Discount Received" / "Purchase Discount" |
| **Purchase freight/labor/extra** | 1200 + 2000 | Inventory + AP | Dr Inventory, Cr AP (capitalize to inventory); no separate expense account |
| **Cash** | 1000 | Cash | Payment account |
| **Bank** | 1010 | Bank | Payment account |
| **Courier payable** | 203x | Per-courier (e.g. TCS Payable) | RPC `get_or_create_courier_payable_account`; Cr on shipment cost, Dr on courier payment |
| **Worker payable** | 2010 | Worker Payable | Dr on worker payment; Cr on studio cost post |
| **Shipping expense** | 5100 | Shipping Expense | Dr when recording actual courier cost (shipment) |
| **Salesman payable** | 2040 | Salesman Payable | Cr on commission post |
| **Sales commission expense** | **5110** (preferred) | Sales Commission Expense | Dr on commission post; **if 5110 missing, 5100 used (conflict — see below)** |

---

## 2. Duplicate / conflict list

| Issue | Detail | Status / action |
|-------|--------|-----------------|
| **AP 2000 vs 2020** | saleAccountingService previously used **2020** for "Accounts Payable" when crediting sale extra expense. Canonical supplier payable is **2000**. 2020 creates a second AP-like account. | **Fixed in Phase 2:** Code now uses 2000 only. Accounts with code 2020 = **legacy/duplicate**; do not use for new posting. |
| **Inventory 1200 vs 1500** | saleAccountingService and studio use **1200** for Inventory. purchaseAccountingService and PurchaseContext used **1500** or name "Inventory"/"Stock". One inventory asset account required. | **Locked:** Canonical = **1200**. Purchase flows now prefer 1200 with fallback to 1500/name. Accounts with code 1500 only (no 1200) = **legacy**; migrate to 1200 when safe. |
| **5100 Shipping vs Commission** | **5100** used for (1) Shipping Expense (shipmentAccountingService) and (2) Sales Commission Expense (commissionReportService). One code, two meanings. | **Resolved:** 5100 = **Shipping Expense** only. Commission expense = **5110** (Sales Commission Expense) when present. commissionReportService: use 5110 if exists else fallback 5100 (document only in Phase 2; optional code change later). |
| **chartAccountService default 5100** | `chartAccountService.createDefaultAccounts` creates 5100 as "Cost of Goods Sold". Correct COGS code is **5000**. | **Legacy/wrong:** Default account set should use 5000 for COGS, 5100 for Shipping Expense. Document only; no DB cleanup without preview. |
| **Duplicate AR/AP (by name)** | FINAL_DUPLICATE_CLASSIFICATION: duplicate "accounts receivable" and "bank" were marked inactive; canonical 1100/1010 kept. | **Already handled;** no new action. |

---

## 3. Account classification (for live DB)

| Code | Name | Classification |
|------|------|----------------|
| 1000 | Cash | Canonical active |
| 1010 | Bank | Canonical active |
| 1100 | Accounts Receivable | Canonical active |
| 1200 | Inventory | Canonical active |
| 1500 | Inventory / Stock (if exists) | Legacy/duplicate if 1200 exists; prefer 1200 |
| 2000 | Accounts Payable | Canonical active |
| 2010 | Worker Payable | Canonical active |
| 2020 | (any) | Duplicate accidental; do not use for new posting |
| 203x | Courier Payable (per courier) | Canonical active |
| 2040 | Salesman Payable | Canonical active |
| 3000 | Capital | Canonical active |
| 4000 | Sales Revenue | Canonical active (saleAccountingService product lines) |
| 4100 | Sales Revenue | Canonical active (default COA seed) |
| 4110 | Shipping Income | Canonical active |
| 5000 | Cost of Production | Canonical active |
| 5100 | Shipping Expense | Canonical active (do not use for commission) |
| 5110 | Sales Commission Expense | Canonical when created; preferred for commission |
| 5200 | Discount Allowed | Canonical active |
| 5210 | Discount Received | Canonical when created; purchase discount |
| 5300 | Extra Expense | Canonical active |

---

## 4. Usage rules (code)

- **Supplier payable:** Always 2000. Never use 2020 for posting.
- **Inventory:** Prefer 1200; fallback 1500 or name "Inventory"/"Stock" for backward compatibility.
- **Shipping expense:** 5100 only. Commission expense: 5110 preferred, 5100 fallback until 5110 exists.
- **Sale extra expense credit:** Cash = 1000; Payable = 2000 (not 2020).

---

*Last updated: Phase 2 completion.*
