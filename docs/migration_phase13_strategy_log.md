# Phase 13 — Hybrid Data Migration (Roman Urdu)

Yeh document **legacy UltimatePOS dump (`62547.sql`)** se **modern Postgres ERP** par data lane ka dual-track roadmap hai. Production par koi structural migration nahi chalegi — sirf staging par parse → transform → validate → load.

---

## Pehle samajh lein: do alag tracks

| Track | Kya import hoga | Date rule |
|-------|-----------------|-----------|
| **Track A — Accounts & Ledgers** | Chart of accounts, journal lines, payments, vouchers | **Koi cut-off nahi** — 2022 se May 2026 tak poori audit trail |
| **Track B — Sales, Purchases & Stock** | Invoices, PO, line items, stock movements | **Sirf 1 October 2025 ke baad** — purani FY operational docs drop |
| **Track C — Master Data** | Contacts, products (Parent-Variant catalog) | **Koi cut-off nahi** — full catalog |

Target company abhi **alag staging company** (dev-only fresh UUID) — production NEW/OLD business par abhi load nahi.

---

## Legacy source (`62547.sql`)

- Format: MariaDB / phpMyAdmin dump (UltimatePOS style)
- Primary business: **`business_id = 2`** (DIN COUTURE)
- Chart of accounts table: **`accounting_accounts`**
- GL movement table: **`accounting_accounts_transactions`**
- Payment register (parallel): **`account_transactions`** + **`transaction_payments`**
- Operational docs: **`transactions`** (type `sell` / `purchase`) + lines

Pehli ledger entries sample mein **2022-10** se shuru hoti hain — Track A in sab ko chronological order mein rakhega.

---

## Modern target (TypeScript models)

Client-side models jin se output match karna hai:

| Module | File | Main shapes |
|--------|------|-------------|
| Accounts | [`erp-mobile-app/src/api/accounts.ts`](../erp-mobile-app/src/api/accounts.ts) | `AccountRow`, `JournalEntryRow`, `JournalEntryLineRow` |
| Sales | [`erp-mobile-app/src/api/sales.ts`](../erp-mobile-app/src/api/sales.ts) | `CreateSaleInput`, sale items |
| Expenses | [`erp-mobile-app/src/api/expenses.ts`](../erp-mobile-app/src/api/expenses.ts) | `ExpenseRow` |

Database tables (staging load): `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `sales`, `sales_items`, `purchases`, `purchase_items`, `products`, `product_variations`, `contacts`.

---

## Execution sequence (step-by-step)

### Step 0 — Tayyari

1. Dump copy karein: `62547.sql` repo root ya `migration-tools/data/` mein.
2. Config copy karein: `migration-tools/config/mapping.example.json` → `mapping.json`
3. Staging Postgres par nayi company UUID set karein (`targetCompanyId`).
4. **Production par kuch load mat karein** jab tak reconcile na ho.

### Step 1 — Chart of Accounts extract (abhi)

```bash
node migration-tools/extractAccounts.js
```

- Input: `accounting_accounts` rows (`business_id = 2`)
- Output: `migration-tools/output/accounts.json` + `account_id_map.json`
- Legacy integer ID → deterministic UUID (`phase13:accounting_accounts:{id}`)
- Parent-child groups preserve (CASH IN HAND, BANK, AR, AP headers)

### Step 2 — Full ledger extract (Track A — no cut-off) ✅

```bash
node migration-tools/extractLedger.js
```

- Source: `accounting_accounts_transactions` (GL), `accounting_acc_trans_mappings`, `transaction_payments`
- Filter: **date par koi cut-off nahi** — poori history (dump mein ~2022-10-01 se 2025-07-23)
- Output: `migration-tools/output/ledgers.json` — `entries[]` = `JournalEntryRow` shape + nested `lines`
- `account_id_map.json` se legacy account → UUID map
- Verified run: **5059 journal entries**, **8913 lines** (8997 raw GL rows; 84 skipped unmapped/zero account)

**Zaroori:** Legacy `account_transactions` alag `accounts` table use karti hai (cashbook) — GL ke liye `accounting_accounts_transactions` canonical hai. Payment-linked cashbook rows `cashbookSupplement` mein hain, double-load mat karein.

### Step 3 — Sales / Purchases (Track B — FY cut-off) ✅

```bash
node migration-tools/extractSales.js
node migration-tools/extractPurchases.js
```

- Cut-off: **`transaction_date >= 2025-10-01`** (strict — purani FY docs drop)
- Output: `migration-tools/output/sales.json`, `purchases.json`
- Parent-Variant line items: legacy `products` (design/parent) + `variations` (SKU) → `productId` + `variationId` UUIDs
- Verified run on dump `62547.sql` (Jul 2025 snapshot — **koi row 2025-10-01 ke baad nahi**):

| Document | Legacy headers (biz 2) | Extracted | Skipped (before cut-off) | Line items |
|----------|------------------------|-----------|--------------------------|------------|
| **Sales** | 969 | **0** | **965** (+ 4 quotations) | 0 |
| **Purchases** | 240 | **0** | **240** | 0 |

Yeh **expected** hai jab tak Oct 2025–May 2026 ka fresh dump na ho. Scripts sahi filter laga rahe hain — `meta.dateFilterApplied: true` dono JSON mein confirm.

### Step 4 — Contacts & Products (Track C — Master Data) ✅

```bash
node migration-tools/extractContacts.js
node migration-tools/extractProducts.js
```

- **Koi date cut-off nahi** — poora master catalog (`business_id = 2`)
- Contacts → `migration-tools/output/contacts.json`
- Products (Parent-Variant) → `migration-tools/output/products.json` + `product_id_map.json`

**Contact type mapping:** legacy `customer` / `supplier` / `both` → modern `contacts.type`; default walk-in (`is_default=1`, "Customers") → `system_type: walking_customer`

**Product architecture:**
- Level 1 (Parent): design/base item — consolidated singles (`SHIRT-D 01 - 110` → parent `SHIRT-D 01`)
- Level 2 (Variant): SKU row from legacy `variations` with unique `sub_sku`
- Legacy `variable` products: 1 parent + N variants as-is

Verified run on dump `62547.sql`:

| Artifact | Count |
|----------|------:|
| **Contacts extracted** | **510** (461 customer, 48 supplier, 1 both, 1 walk-in) |
| **Parent products** | **701** |
| **Variants (SKUs)** | **746** |
| Consolidated design groups | 8 (from 716 legacy singles) |
| Legacy variable products | 14 |

### Step 5 — Party linking at load-time

- AR sub-accounts (`parent_account_id = 10`) → `accounts.linked_contact_id`
- Supplier AP sub-ledgers similarly

### Step 6 — Validate

Script: `validateReconciliation.js`

- Trial balance: sum debits = sum credits per company
- AR/AP sub-ledger vs contact balances spot check
- Track B: invoice count legacy (post cut-off) vs imported count
- Payment sequence sanity

### Step 7 — Go-Live import (Supabase uploader) ✅

Script: [`migration-tools/importToSupabase.js`](../migration-tools/importToSupabase.js)

Yeh step **sirf nayi live company** par chalega — purani test company ya extraction placeholder (`00000000-0000-4000-8000-000000000001`) par **kabhi mat chalao**.

#### Pehle tayyari

1. Supabase / ERP mein **naya business (company + kam az kam ek branch)** create karo.
2. Company ka **UUID copy** karo — yeh hi `TARGET_COMPANY_ID` hoga.
3. `migration-tools/.env.migration.example` ko copy karke `.env.migration` banao (secrets commit mat karo):

```env
TARGET_COMPANY_ID=<apka-naya-live-company-uuid>
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...   # Dashboard → Settings → API → service_role
```

4. Confirm karo ke `migration-tools/output/` mein yeh files maujood hain:
   - `contacts.json` (510)
   - `accounts.json` (70)
   - `products.json` (701 parent + 746 variants)
   - `ledgers.json` (5059 journals + 8913 lines)

#### Dry-run (pehle hamesha yeh)

```bash
node migration-tools/importToSupabase.js --dry-run --target-company-id <live-uuid>
```

- Network par **koi insert nahi** — sirf counts aur mapping preview
- Agar walk-in conflict ho sakta hai to log mein warning dikhegi

#### Live import (jab Company ID confirm ho)

```bash
node migration-tools/importToSupabase.js --confirm --target-company-id <live-uuid>
```

**Zaroori:** `--confirm` ke bina script live write **nahi** karegi.

#### Insert order (FK-safe)

| Order | Tables | Source JSON |
|------:|--------|-------------|
| 1 | `contacts`, `accounts` | `contacts.json`, `accounts.json` |
| 2 | `products`, `product_variations` | `products.json` (parents pehle, phir variants) |
| 3 | `journal_entries`, `journal_entry_lines` | `ledgers.json` |

- Har row ka `company_id` **force** ho kar `TARGET_COMPANY_ID` set hota hai
- Upsert mode (`ON CONFLICT id`) — failed chunk dubara run kar sakte ho
- Batch size default **100** (`--batch-size 200` optional)
- Report: `migration-tools/output/import_report.json`

#### Partial rerun (agar koi phase fail ho)

```bash
node migration-tools/importToSupabase.js --confirm --phase ledgers --target-company-id <live-uuid>
```

Phases: `contacts` | `accounts` | `products` | `ledgers` | `all`

#### Abhi scope ke bahar

- `sales.json` / `purchases.json` (current dump par 0 rows — Oct 2025 cut-off)
- `payments` table alag se
- Stock movements
- Trial balance reconcile → agla step `validateReconciliation.js`

#### Safety reminders

- **Service role key** sirf migration machine par — git mein mat daalo
- Purani test companies par script **block** karti hai agar placeholder UUID use karo
- GL load ke baad account `balance` vs journal sum reconcile alag step hai

---

## Folder layout (`migration-tools/`)

```
migration-tools/
  README.md
  extractAccounts.js          ← Step 1 ✅
  extractLedger.js            ← Step 2 Track A ✅
  extractSales.js             ← Step 3 Track B ✅
  extractPurchases.js         ← Step 3 Track B ✅
  extractContacts.js          ← Step 4 Track C ✅
  extractProducts.js          ← Step 4 Track C ✅
  importToSupabase.js         ← Step 7 Go-Live ✅
  .env.migration.example
  config/mapping.example.json
  lib/
    parseSqlInsert.js
    legacyId.js
    mapAccountType.js
    fyCutoff.js
    mapProductVariant.js
    mapOperationalPayments.js
    consolidateProducts.js
    loadMigrationEnv.js
    batchUpsert.js
  output/
    import_report.json        ← after Go-Live run
    accounts.json
    account_id_map.json
    ledgers.json
    sales.json
    purchases.json
    contacts.json
    products.json
    product_id_map.json
```

Aage ke scripts same pattern follow karenge: pure Node, koi live DB DDL nahi.

---

## Safety rules (system-lockdown)

- **No** `DROP TABLE`, **no** production schema change
- Staging company only jab tak user explicitly production cutover na kare
- Money/stock tables par bulk load se pehle GL posting triggers ka plan clear ho
- Har step ke baad JSON output git ya backup mein save karein

---

## Agla kaam

1. User se **naya live Company UUID** lo → Step 7 dry-run → `--confirm` import
2. `validateReconciliation.js` — trial balance + operational spot checks
3. Fresh dump (Oct 2025 – May 2026) se Track B dubara run jab data available ho

---

*Phase 13 — Hybrid Migration Strategy — locked per Nadeem bhai, May 2026*
