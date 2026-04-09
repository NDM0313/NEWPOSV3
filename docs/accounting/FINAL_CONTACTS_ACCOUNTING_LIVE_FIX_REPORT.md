# Final contacts / accounting live fix report

**Date:** 2026-04-06  
**Company UUID:** `595c08c2-1e47-4581-89c9-1f78de51c613`  
**Environment:** Live Postgres on VPS (`supabase-db` via `ssh dincouture-vps`).

## 1. Live root causes (proven)

### 1A. Stale `get_contact_balances_summary` body (primary)

**Proof on VPS (before patch):**

```sql
SELECT pg_get_functiondef(p.oid) LIKE '%p.amount::numeric - COALESCE%' AS has_unalloc_subtract,
       pg_get_functiondef(p.oid) LIKE '%SUM(GREATEST(0, p.amount::numeric))%' AS has_full_amount_subtract_recv
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'get_contact_balances_summary' AND n.nspname = 'public'
  AND pg_get_function_identity_arguments(p.oid) = 'p_company_id uuid, p_branch_id uuid';
```

**Result:** `has_unalloc_subtract = false`, `has_full_amount_subtract_recv = true`.

The installed function subtracted the **full** `manual_receipt` / `manual_payment` amount even when those payments were **fully allocated** to sales/purchases (already reflected in `due_amount` / `paid_amount`). That **double-subtracted** and drove operational balances away from document truth and from party GL for suppliers.

**Example (ABC):** Opening 55,000 + final sale due 50,000 = **105,000** document roll-up; a **50,000** `manual_receipt` **fully allocated** to that sale was subtracted again in full → RPC showed **55,000** (opening only).

**Fix:** Applied repo migration `migrations/20260431_get_contact_balances_unallocated_payment_subtract.sql` **as database owner**:

```bash
# From dev machine (repo root):
Get-Content migrations/20260431_get_contact_balances_unallocated_payment_subtract.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1"
```

**Note:** `psql -U postgres` failed with `must be owner of function get_contact_balances_summary` — function owner is `supabase_admin`.

**After patch:** Same spot-check RPC:

| name           | receivables | payables |
|----------------|------------:|---------:|
| ABC            | 105,000.00  | 0        |
| Ali            | 25,000.00   | 0        |
| DIN COLLECTION | 0           | 5,000.00 |
| DIN COUTURE    | 0           | 415,000.00 |
| KHURAM SILK    | 0           | 575,060.00 |
| Salar          | 75,000.00   | 0        |
| SATTAR         | 0           | 20,000.00 |

Supplier **operational payables** now match **`get_contact_party_gl_balances` GL AP** for these parties (NULL branch), as intended.

### 1B. Contacts page branch filter vs stored `branch_id` (UI)

**Bug:** `contact.branch` was set to `branch_id` (**UUID**) or the hard-coded string `'Main Branch (HQ)'` when null. The filter offered only **human names** (`Main Branch (HQ)`, `Mall Outlet`, …). Contacts with a real UUID never matched a name filter; cards/rows looked “wrong” when filtering by branch.

**Fix:** Load company branches via `branchService.getBranchesCached`, store **`branchId`** on each row, show **`branch`** as resolved **name**, and use **branch UUID** as filter option values. Compare filter with `contact.branchId`.

### 1C. Reconciliation snapshot mixed scopes (UI)

**Bug:** `getCompanyReconciliationSnapshot` was called with **`operationalReceivablesTotal` / `operationalPayablesTotal` taken from filtered card totals** (`summaryOperational`) while **customer/supplier split totals** came from the **full** `contacts` list. Aggregate variance vs GL used inconsistent inputs.

**Fix:** Stop passing the two card-total overrides; let the service use **`sumOperationalFromRpc`** for company-level operational totals. Keep split totals from the full RPC-backed `contacts` list.

## 2. SQL run on VPS (inventory)

| Script / action | Purpose |
|-----------------|--------|
| `scripts/vps-contacts-truth-table.sql` (piped to `psql`) | Raw doc legs, RPC NULL + sample branch, party GL, payment allocation detail |
| `migrations/20260431_get_contact_balances_unallocated_payment_subtract.sql` | `CREATE OR REPLACE FUNCTION` as **supabase_admin** |
| `INSERT INTO schema_migrations (name) VALUES ('20260431_get_contact_balances_unallocated_payment_subtract.sql') ON CONFLICT DO NOTHING` | Record deploy (postgres role) |

## 3. Before / after — target contacts (RPC `get_contact_balances_summary`, `p_branch_id` NULL)

| Contact        | RPC recv before | RPC recv after | RPC pay before | RPC pay after | GL AR (party) | GL AP (party) |
|----------------|----------------:|---------------:|---------------:|--------------:|--------------:|--------------:|
| ABC            | 55,000          | **105,000**    | 0              | 0             | 55,000        | 0             |
| Ali            | 25,000          | 25,000         | 0              | 0             | 47,500        | 0             |
| DIN COLLECTION | 0               | 0              | 5,000          | 5,000         | 0             | 5,000         |
| DIN COUTURE    | 0               | 0              | 370,000        | **415,000**   | 0             | 415,000       |
| KHURAM SILK    | 0               | 0              | 560,060        | **575,060**   | 0             | 575,060       |
| Salar          | 75,000          | 75,000         | 0              | 0             | 75,000        | 0             |
| SATTAR         | 0               | 0              | 20,000         | 20,000        | 0             | 20,000        |

## 4. Frontend mapping table (Contacts page)

| UI location | Source | `company_id` | `branch_id` to RPC | Refresh events | Notes |
|-------------|--------|--------------|--------------------|----------------|-------|
| A. Top RECV card (operational) | Sum `receivables` on **`filteredContacts`** | `useSupabase().companyId` | `branchId === 'all' ? null : branchId` | `loadContacts` via `CONTACT_BALANCES_REFRESH_EVENT`, `paymentAdded`, `accountingEntriesChanged`, `ledgerUpdated`, focus | Scoped to **visible rows** after tab/filters |
| B. Top PAY card (operational) | Sum `payables` on **`filteredContacts`** | same | same | same | same |
| C. Row grey recv | `get_contact_balances_summary` → `contactService.getContactBalancesSummary` merged by `contact.uuid` | same | same | same | Canonical **operational** |
| D. Row grey pay | same | same | same | same | same |
| E. Row GL recv mini-line | `get_contact_party_gl_balances` → `getContactPartyGlBalancesMap` → `contactPartyGlReceivableSigned` | same | same | same load cycle after balances settle | **Signed** party AR |
| F. Row GL pay mini-line | same map → `contactPartyGlPayableSigned` | same | same | same | **Signed** AP / worker |

**Linked-party drawer (Accounts):** `AccountingDashboard` → `contactService.getContactPartyGlBalancesMap` — **same RPC** as row GL mini-lines; listeners include `accountingEntriesChanged`, `paymentAdded`, `ledgerUpdated`, `CONTACT_BALANCES_REFRESH_EVENT` (from prior session + this codebase).

**Account statements:** `AccountLedgerReportPage` — same event set for `journalRefreshTick`.

**Journal list amounts / refresh:** `AccountingContext` bumps on `accountingEntriesChanged`, `paymentAdded`, `ledgerUpdated`, `CONTACT_BALANCES_REFRESH_EVENT`; grouped amount uses `groupedDocumentDisplayAmount` (excludes payment-settlement rows from purchase/sale principal).

## 5. Files changed (this fix)

| File | Change |
|------|--------|
| `migrations/20260431_get_contact_balances_unallocated_payment_subtract.sql` | Deploy comment (`supabase_admin`) |
| `src/app/components/contacts/ContactsPage.tsx` | Branch list load + `branchId` / display label; dynamic branch filter; recon options fix |
| `scripts/vps-contacts-truth-table.sql` | New VPS verification script |
| `docs/accounting/FINAL_CONTACTS_ACCOUNTING_LIVE_FIX_REPORT.md` | This report |

*(Prior session already added `ledgerUpdated` / `CONTACT_BALANCES_REFRESH_EVENT` listeners on `AccountingContext`, `AccountingDashboard`, `AccountLedgerReportPage`; neutralized duplicate `20260431` migration body.)*

## 6. Intentional operational vs GL differences (remaining)

After the RPC fix, **suppliers** in the sample set align **OP pay vs GL AP** (NULL branch).

**Customers may still differ** where journals and open-document rules diverge, e.g. **Ali:** operational recv **25,000** vs party GL AR **47,500** — treat as **two truths**; row badge / tooltips already describe OP vs party GL. **Do not** force equality in UI.

## 7. Auto-refresh (without hard reload)

Mutation paths should continue to dispatch **`accountingEntriesChanged`**, **`paymentAdded`**, **`ledgerUpdated`**, and/or **`dispatchContactBalancesRefresh`** (`CONTACT_BALANCES_REFRESH_EVENT`). Contacts page listens to all of the above plus window **focus**.

**Manual verification** on live UI is recommended for: sale finalize, receipt, supplier payment, purchase edit, payment edit — after each, confirm Contacts rows/cards and Journal/Accounts without F5.

## 8. Build

`npm run build` — **succeeded** (exit 0).

## 9. Remaining risks

1. **`deploy/run-migrations-vps.sh`** runs `psql -U postgres`. Any migration that `CREATE OR REPLACE`s objects owned by **`supabase_admin`** may **fail** until run as owner (documented in migration header).
2. **`schema_migrations`** on VPS was historically **out of sync** with manual SQL; one row was inserted for `20260431_get_contact_balances_unallocated_payment_subtract.sql` after apply — full reconcile of all `202604*` files may still be needed for other environments.
3. **Customer OP vs GL** variance can still appear where posting uses child AR accounts or timing differs — **by design** until a single party-ledger convention is chosen.
