# Database Truncate Analysis

## Total Tables: 53 (public schema)

### ✅ KEEP (9 tables) – Core system data
| Table | Rows | Purpose |
|-------|------|---------|
| companies | 3 | Companies |
| branches | 3 | Branches |
| users | 5 | Users |
| user_branches | 5 | User-branch mapping |
| roles | 0 | Roles |
| settings | 6 | App settings |
| modules_config | 12 | Module config |
| units | 3 | Units (master) |
| schema_migrations | 56 | Migration history |

---

### 🔴 TRUNCATE (44 tables) – Transaction + Master data

#### Phase A: Child/Line items (FK dependencies first)
| # | Table | Rows | Notes |
|---|-------|------|-------|
| 1 | sale_return_items | 0 | FK: sale_returns, sale_items, products |
| 2 | purchase_return_items | 0 | FK: purchase_returns, purchase_items, products |
| 3 | sale_items | 0 | FK: sales, products |
| 4 | sales_items | 0 | FK: sales, products (duplicate?) |
| 5 | purchase_items | 0 | FK: purchases, products |
| 6 | journal_entry_lines | 0 | FK: journal_entries, accounts |
| 7 | rental_items | 0 | FK: rentals, products |
| 8 | product_combo_items | 0 | FK: product_combos, products |
| 9 | studio_order_items | 0 | FK: studio_orders |
| 10 | rental_payments | 0 | FK: rentals |
| 11 | studio_production_logs | 0 | FK: studio_productions |
| 12 | studio_production_stages | 0 | FK: studio_productions, workers |
| 13 | account_transactions | 0 | FK: chart_accounts |
| 14 | accounting_audit_logs | 0 | FK: chart_accounts |
| 15 | ledger_entries | 17 | FK: ledger_master |
| 16 | worker_ledger_entries | 0 | FK: workers |

#### Phase B: Transactions
| # | Table | Rows | Notes |
|---|-------|------|-------|
| 17 | activity_logs | 0 | FK: accounts |
| 18 | payments | 0 | FK: accounts |
| 19 | journal_entries | 0 | FK: payments |
| 20 | stock_movements | 0 | FK: products, branches |
| 21 | sale_returns | 0 | FK: sales, contacts |
| 22 | purchase_returns | 0 | FK: purchases, contacts |
| 23 | sales | 0 | FK: contacts |
| 24 | purchases | 0 | FK: contacts |
| 25 | expenses | 0 | FK: accounts, expense_categories, workers |
| 26 | rentals | 0 | FK: contacts |
| 27 | studio_orders | 0 | FK: contacts |
| 28 | studio_productions | 0 | FK: workers, products, sales |
| 29 | credit_notes | 0 | FK: sales |
| 30 | refunds | 0 | FK: credit_notes, accounts, contacts |
| 31 | job_cards | 0 | FK: studio_orders, workers |

#### Phase C: Master data
| # | Table | Rows | Notes |
|---|-------|------|-------|
| 32 | contacts | 0 | FK: contact_groups |
| 33 | product_variations | 0 | FK: products |
| 34 | products | 0 | FK: brands, product_categories, units |
| 35 | product_combos | 0 | FK: products |
| 36 | product_categories | 0 | Self-ref parent |
| 37 | brands | 3 | FK: companies |
| 38 | contact_groups | 0 | FK: companies |
| 39 | expense_categories | 2 | Self-ref parent |
| 40 | workers | 0 | FK: companies |
| 41 | ledger_master | 10 | FK: chart_accounts? |
| 42 | chart_accounts | 0 | Self-ref parent |
| 43 | automation_rules | 0 | FK: chart_accounts |
| 44 | inventory_balance | 0 | FK: products, branches |

#### Phase D: Special handling
| # | Table | Action |
|---|-------|--------|
| 45 | accounts | UPDATE branches/settings refs → DELETE → Recreate default |
| 46 | document_sequences | UPDATE current_number = 0 |
| 47 | accounting_settings | TRUNCATE (if exists) |

---

### Tables MISSING from current truncate script
- account_transactions
- accounting_audit_logs
- accounting_settings
- automation_rules
- brands
- chart_accounts
- ledger_entries
- ledger_master
- product_combo_items
- product_combos
- rental_payments
- sales_items
- studio_production_logs
- studio_production_stages
- studio_productions
- worker_ledger_entries
- expense_categories

### Tables that don't exist (in script but not in DB)
- expense_items
- numbering_rules
