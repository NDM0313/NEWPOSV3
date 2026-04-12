# 03 — Contacts / Customers / Suppliers / Workers Flow

**Last updated:** 2026-04-12
**Domain:** Party management — contact creation, classification, subledger account linking, ledger balance
**Key files:**
- `src/app/services/contactService.ts`
- `src/app/services/partySubledgerAccountService.ts`
- `src/app/services/effectivePartyLedgerService.ts`

---

## Business Purpose

A **contact** is any external party the business transacts with: a customer who buys goods, a supplier who sells goods, or a worker who provides labour. One contact row can serve multiple roles (type `both`). Each contact can be linked to one or more accounts in the Chart of Accounts (AR subledger under account `1100`, AP subledger under account `2000`). The authoritative balance for any contact is computed from `journal_entry_lines` — not from `contacts.current_balance`, which is a legacy/display field and must not be trusted for accounting decisions.

---

## UI Entry Points

| View key | Component | Purpose |
|----------|-----------|---------|
| `contacts` | `src/app/components/contacts/ContactsPage.tsx` | List all contacts with AR/AP balance summary |
| `contacts` | `src/app/components/contacts/ContactList.tsx` | Filterable/searchable contact table |
| `contacts` | `src/app/components/contacts/QuickAddContactModal.tsx` | Inline contact creation from Sale/Purchase forms |
| `contacts` | `src/app/components/contacts/ImportContactsModal.tsx` | Bulk CSV import |
| `contact-profile` | `src/app/components/contacts/ViewContactProfile.tsx` | Full contact profile: details, ledger, transaction history |
| `party-ledger` | `src/app/components/contacts/ContactLedgerDrawer.tsx` | Sliding drawer showing party ledger rows with running balance |

---

## Frontend Files

| File | Role |
|------|------|
| `src/app/services/contactService.ts` | Contact CRUD, GL balance RPC wrappers, walk-in customer management, subledger name resolution. |
| `src/app/services/partySubledgerAccountService.ts` | Ensures AR/AP child accounts exist in `accounts` table for each contact. Resolves posting account ids. |
| `src/app/services/effectivePartyLedgerService.ts` | Builds the presentation ledger from sales, purchases, payments, and mutation chains. Read-only. |
| `src/app/components/contacts/ContactsPage.tsx` | Calls `getContactBalancesSummary()` and (optionally) `getContactPartyGlBalancesMap()` for GL comparison. |
| `src/app/components/contacts/ViewContactProfile.tsx` | Calls `loadEffectivePartyLedger()` to render the party statement. |

---

## Backend Services

### `contactService` (`contactService.ts`)

| Function | Purpose |
|----------|---------|
| `getAllContacts(companyId, type?)` | Fetches all contacts filtered by `company_id`. Optional filter by `type`. Ordered by `name`. |
| `getContacts(companyId, type?)` | Alias for `getAllContacts`. Used by Party Ledger and pickers. |
| `getContact(id)` | Single contact by `id`. |
| `createContact(contact)` | Insert with document number generation (CUS-NNN for customers). On success: calls `syncOpeningGlForContact()` then `ensurePartySubledgersForContact()`. Three-layer retry on column errors. |
| `updateContact(id, updates)` | Update contact. Blocks name/type changes for system-generated Walk-in Customer. Calls `syncOpeningGlForContact()` after update. |
| `deleteContact(id)` | Soft delete: sets `is_active = false`. Blocks deletion of `is_default` or `system_type = 'walking_customer'` contacts. |
| `getContactBalancesSummary(companyId, branchId?)` | Calls `get_contact_balances_summary` RPC. Returns a `Map<contactId, { receivables, payables }>`. On RPC error, returns empty map with error string — callers must not substitute client-side math. |
| `getContactPartyGlBalancesMap(companyId, branchId?)` | Calls `get_contact_party_gl_balances` RPC. Returns `Map<contactId, { glArReceivable, glApPayable, glWorkerPayable }>`. Used for GL-vs-operational comparison. Returns `null` on RPC error (migration not applied). |
| `searchContacts(companyId, query)` | ILIKE search on `name`, `email`, `phone`. Limit 20. |
| `createDefaultWalkingCustomer(companyId)` | Creates one Walk-in Customer per company: `code = 'CUS-0000'`, `system_type = 'walking_customer'`, `is_default = true`. DB enforces uniqueness via `unique_walkin_per_company_strict` constraint. |
| `getDefaultCustomer(companyId)` | Returns the walk-in customer row. Primary: `system_type = 'walking_customer'`. Fallback: `is_default = true`. |
| `getWalkingCustomer(companyId)` | Alias for `getDefaultCustomer`. |
| `ensureDefaultWalkingCustomerForCompany(companyId)` | Idempotent: calls `createDefaultWalkingCustomer`, swallows errors if already exists. |
| `resolveSupplierContactIdFromSubledgerAccountName(companyId, accountName)` | Matches an AP subledger account name to a single `supplier`/`both` contact by name (strips ` - AP` suffix variants). Returns `null` if ambiguous or not found. |
| `resolveCustomerContactIdFromSubledgerAccountName(companyId, accountName)` | Same for AR accounts and `customer`/`both` contacts (strips ` - AR` suffix variants). |

### `partySubledgerAccountService` (`partySubledgerAccountService.ts`)

| Function | Purpose |
|----------|---------|
| `ensurePartySubledgersForContact(companyId, contactId, type)` | Dispatcher: calls `ensureReceivableSubaccountForContact` for `customer`/`both`; calls `ensurePayableSubaccountForContact` for `supplier`/`both`. |
| `ensureReceivableSubaccountForContact(companyId, contactId)` | Finds or creates AR child account under control `1100`. Account code: `AR-{slug}`. Type: `asset`. |
| `ensurePayableSubaccountForContact(companyId, contactId)` | Finds or creates AP child account under control `2000`. Account code: `AP-{slug}`. Type: `liability`. |
| `resolveReceivablePostingAccountId(companyId, customerContactId)` | Returns the AR child account id if it exists, else falls back to `1100` control id. Used when posting JE lines for sales/receipts. |
| `resolvePayablePostingAccountId(companyId, supplierContactId)` | Returns the AP child account id if it exists, else falls back to `2000` control id. Used when posting JE lines for purchases/payments. |

### `effectivePartyLedgerService` (`effectivePartyLedgerService.ts`)

| Function | Purpose |
|----------|---------|
| `loadEffectivePartyLedger(params)` | Main entry point. Loads contact row, all sales/purchases/payments for the party, and mutation chains. Collapses mutation chains into single effective rows. Computes running balance. Returns `EffectiveLedgerResult`. |

**Key types:**
- `EffectiveLedgerRow` — one ledger line: `id`, `date`, `referenceNo`, `type` (union of `'sale' | 'purchase' | 'payment' | 'receipt' | 'opening' | 'return' | 'reversal' | 'expense' | 'adjustment' | 'journal'`), `debit`, `credit`, `runningBalance`, `status`, `mutationCount`, `mutations[]`.
- `EffectiveLedgerSummary` — `openingBalance`, `totalDebit`, `totalCredit`, `closingBalance`, `totalSales`, `totalReceived`, `totalPurchases`, `totalPaid`.
- `MutationStep` — one step in a payment mutation chain: `timestamp`, `type`, `oldAmount`, `newAmount`, `journalEntryNo`.

---

## DB Tables

### `public.contacts`
The central party table. All transactional references (sales, purchases, payments) use `contacts.id`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | Tenant isolation key |
| `branch_id` | uuid FK | Optional; the branch that created the contact |
| `type` | text | `'customer'`, `'supplier'`, `'both'`, `'worker'` |
| `name` | text | Required |
| `code` | text | `CUS-NNN` for customers (global sequence), `CUS-0000` for walk-in |
| `email`, `phone`, `mobile`, `cnic`, `ntn` | text | Contact details |
| `address`, `city`, `state`, `country`, `postal_code` | text | Address fields |
| `opening_balance` | numeric | Customer opening balance (AR side). Also used for supplier if `supplier_opening_balance` absent. **Do not use for live balance.** |
| `supplier_opening_balance` | numeric | Supplier-specific opening balance. Present after migration. |
| `current_balance` | numeric | **LEGACY/DISPLAY ONLY. Not the source of truth.** Not reliably maintained. |
| `credit_limit` | numeric | Customer credit ceiling |
| `payment_terms` | integer | Days |
| `is_active` | boolean | Soft-delete flag |
| `is_system_generated` | boolean | True for Walk-in Customer and other auto-created contacts |
| `system_type` | text | `'walking_customer'` for the default walk-in contact |
| `is_default` | boolean | True for Walk-in Customer (legacy flag; `system_type` is now preferred) |
| `created_by` | uuid | `public.users.id` of the creator |

### `public.contact_groups`
Optional grouping of contacts (e.g. "Wholesale", "Retail"). Referenced by contacts via `group_id` (an optional column that may not exist on all installs).

| Column | Notes |
|--------|-------|
| `id` | PK |
| `company_id` | Tenant key |
| `name` | Group label |

### `public.workers`
Supplementary table for worker-type contacts. Holds payroll-specific data.

| Column | Notes |
|--------|-------|
| `id` | PK |
| `company_id` | Tenant key |
| `contact_id` | FK to `contacts.id` |
| `worker_role` | e.g. `'Dyer'`, `'Stitcher'` |
| `daily_wage` / `rate` | Wage rate |

### `public.employee_ledger`
Worker-specific transaction ledger. Records advances, wage payments, deductions for worker contacts.

| Column | Notes |
|--------|-------|
| `id` | PK |
| `company_id` | Tenant key |
| `worker_id` | FK to `workers.id` |
| `contact_id` | FK to `contacts.id` |
| `type` | Transaction type (advance, salary, deduction) |
| `amount` | Amount |
| `date` | Transaction date |
| `journal_entry_id` | FK to `journal_entries` — links to GL |

---

## Contact Types

The `contacts.type` column is a text field. Four valid values:

| Value | Meaning | AR Subledger | AP Subledger |
|-------|---------|-------------|-------------|
| `'customer'` | Can be invoiced (sales, receipts) | Created under `1100` | None |
| `'supplier'` | Can be invoiced for purchases | None | Created under `2000` |
| `'both'` | Acts as both customer and supplier | Created under `1100` | Created under `2000` |
| `'worker'` | Labour provider; tracked via `workers` + `employee_ledger` | None | Tracked via `2010`/`1180` GL accounts (worker-specific) |

The walk-in customer always has `type = 'customer'`.

---

## Create Flow

1. User opens **Add Contact** form or **Quick Add Contact** modal.
2. Fills required fields: `name`, `type`, `company_id`. Optional: `email`, `phone`, `opening_balance`, `credit_limit`, etc.
3. On submit: `contactService.createContact(contact)` is called.
4. Service logic:
   - Strips `undefined`/`null` fields.
   - For `type === 'customer'` or `type === 'both'` (and not `is_system_generated`): calls `documentNumberService.getNextDocumentNumberGlobal(companyId, 'CUS')` to assign `code = 'CUS-NNN'`.
   - Inserts into `contacts` via Supabase client.
   - **On success (primary insert):**
     - Calls `syncOpeningGlForContact(newId)` — syncs the `opening_balance` to the GL as a journal entry via `openingBalanceJournalService`.
     - Calls `ensurePartySubledgersForContact(companyId, newId, type)` asynchronously (fire-and-forget; errors swallowed).
   - **On column error (400 / PGRST204):** strips optional columns listed in `optionalColumns` array and retries. If still failing, retries with a minimal base-column set.
5. The contact now has an ERP record and a GL opening entry. Its AR/AP subledger accounts are created in the background.

---

## Edit Flow

1. User opens contact profile and edits fields.
2. On submit: `contactService.updateContact(id, updates)` is called.
3. Service fetches the existing contact to check `is_default` and `is_system_generated`:
   - If `is_default === true` OR (`is_system_generated && system_type === 'walking_customer'`): blocks `name` changes away from `'Walking Customer'` and blocks `type` changes away from `'customer'`.
4. Updates the `contacts` row.
5. Calls `syncOpeningGlForContact(id)` — re-syncs the opening balance JE if `opening_balance` or `supplier_opening_balance` changed.
6. Subledger accounts are NOT re-created on edit. If `type` changes (e.g. from `customer` to `both`), the AP subledger will only be created if `ensurePartySubledgersForContact` is called explicitly (this currently does NOT happen on `updateContact`).

---

## Party Subledger Account Linking (`partySubledgerAccountService.ts`)

Each contact can have child accounts in the `accounts` table that sit beneath the AR or AP control accounts. These are called "party subledger accounts" or "party leaf accounts".

### AR Subledger (customer/both)

```
accounts
  └─ code: '1100'  name: 'Accounts Receivable'  type: 'asset'   ← control account
       └─ code: 'AR-{slug}'  name: 'Receivable — {contact.name}'  type: 'asset'
            linked_contact_id: {contactId}
            parent_id: {1100.id}
```

- **Triggered by:** `ensureReceivableSubaccountForContact(companyId, contactId)`.
- **Slug:** first 12 hex chars of the UUID (dashes removed), uppercased. E.g. contact id `550e8400-e29b-...` → slug `550E8400E29B` → code `AR-550E8400E29B`.
- **Name:** `"Receivable — {contact.name}"` (truncated to 250 chars).
- **Type:** `'asset'`.
- **Lookup before create:** `findSubledgerByContact(companyId, contactId, control.id)` checks for an existing account with matching `linked_contact_id` and `parent_id` to avoid duplicates.
- **Fallback on `linked_contact_id` column missing:** retries `createAccount` without `linked_contact_id` (for pre-migration installs).
- **Fallback on unique conflict (23505):** queries by `code` to return the existing account id.
- Control account looked up by code `'1100'` via `accountHelperService.getAccountByCode('1100', companyId)`.

### AP Subledger (supplier/both)

```
accounts
  └─ code: '2000'  name: 'Accounts Payable'  type: 'liability'  ← control account
       └─ code: 'AP-{slug}'  name: 'Payable — {contact.name}'  type: 'liability'
            linked_contact_id: {contactId}
            parent_id: {2000.id}
```

- **Triggered by:** `ensurePayableSubaccountForContact(companyId, contactId)`.
- Control account looked up by code `'2000'` (note: code is `'2000'`, not `'2100'`).
- Same slug, naming, and fallback logic as AR.
- **Type:** `'liability'`.

### Posting Resolution

When a journal entry is created for a sale or purchase, the system resolves the actual account to post to:

- **Sale/Receipt (AR line):** `resolveReceivablePostingAccountId(companyId, customerContactId)` → returns `AR-{slug}` child id if it exists, else `1100` control id.
- **Purchase/Payment (AP line):** `resolvePayablePostingAccountId(companyId, supplierContactId)` → returns `AP-{slug}` child id if it exists, else `2000` control id.

This means new transactions post to the child (subledger) account, while older data posted before subledgers were created sits on the control account.

---

## Party Balance / Ledger View (`effectivePartyLedgerService.ts`)

`loadEffectivePartyLedger(params)` is the read model for the party statement. Parameters:

```typescript
{
  companyId: string;
  contactId: string;
  partyType: 'customer' | 'supplier';
  fromDate: string;   // 'YYYY-MM-DD'
  toDate: string;     // 'YYYY-MM-DD'
  branchId?: string | null;
}
```

**Customer flow:**
1. Fetches `contacts` row: reads `opening_balance` (customer opening AR balance).
2. Loads all `sales` for the contact where `status IN ('final', 'delivered')` and date in range. Each sale → `debit` row.
3. Loads all `payments` for the contact (receipts from customer). Each non-voided payment → `credit` row, collapsed through `buildEffectivePaymentRows()` to handle mutation chains.
4. Loads `sale_returns` — credit rows reducing the AR balance.

**Supplier flow:**
1. Fetches `contacts` row: reads `supplier_opening_balance` (falls back to `opening_balance`).
2. Loads all `purchases` for the contact in range. Each purchase → `credit` row (increases AP).
3. Loads all outgoing payments to the supplier. Each payment → `debit` row (reduces AP).

**Mutation chain collapse:** `buildEffectivePaymentRows(payments, mutations, accountMap, rowType)` groups `payment_mutations` by `entity_id` and reconstructs the effective final state, counting how many edits occurred (`mutationCount`). This prevents showing multiple rows for a payment that was edited.

**Running balance:** computed by iterating `rows` in date order, starting from `openingBase`, and accumulating `debit - credit` (for customers; reversed for suppliers).

**Output:**
- `rows: EffectiveLedgerRow[]` — ledger lines with full mutation history attached.
- `summary: EffectiveLedgerSummary` — `openingBalance`, `totalDebit`, `totalCredit`, `closingBalance`, `totalSales`, `totalReceived`, `totalPurchases`, `totalPaid`.
- `partyName: string` — contact name from the `contacts` row.

---

## Accounting Effect (party subledger account in `accounts` table)

When a contact transacts:

**Sale (customer):**
```
DR  AR-{slug} (1100 child, asset)      ← receivable from customer
  CR  Revenue / Income account          ← sale revenue
```

**Receipt (customer pays):**
```
DR  Cash / Bank account
  CR  AR-{slug} (1100 child, asset)    ← clears receivable
```

**Purchase (supplier):**
```
DR  Inventory / Expense account
  CR  AP-{slug} (2000 child, liability) ← payable to supplier
```

**Payment to supplier:**
```
DR  AP-{slug} (2000 child, liability)  ← clears payable
  CR  Cash / Bank account
```

If no subledger child exists (pre-migration or creation failure), postings go to the control account (`1100` or `2000`) directly. The control account balance then represents the aggregate across all customers/suppliers without per-party breakdown at the GL level.

---

## Source of Truth for Party Balance (GL `journal_entry_lines`, NOT `contacts.current_balance`)

**`contacts.current_balance` is NOT the source of truth.** It is a legacy field that is not reliably updated by all transaction paths. It must not be used for:
- Displaying a contact's outstanding balance in accounting views.
- Making credit decisions.
- Reconciliation.

**The true balance** is always derived from `journal_entry_lines`:

```sql
-- AR balance for a customer (net debit on 1100 or AR-{slug} child)
SELECT
  SUM(CASE WHEN jel.type = 'debit' THEN jel.amount ELSE -jel.amount END) AS ar_balance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :company_id
  AND je.status = 'posted'
  AND (a.code = '1100' OR a.parent_id = (SELECT id FROM accounts WHERE code = '1100' AND company_id = :company_id))
  AND jel.contact_id = :contact_id;  -- or via linked_contact_id on account
```

The `get_contact_party_gl_balances` RPC implements this logic server-side and returns `{ gl_ar_receivable, gl_ap_payable, gl_worker_payable }` per contact.

The `get_contact_balances_summary` RPC returns the operational view (from `sales` and `purchases` tables), which may diverge from the GL if postings were missed or transactions were not fully journalised.

**When these two figures diverge**, the GL (`journal_entry_lines`) is always authoritative for the financial statements. The operational summary is useful for operational workflows (what invoices are outstanding) but must not be used to produce financial reports.

---

## Known Failure Points

1. **`contacts.current_balance` drift.** Multiple transaction paths (POS, quick sales, some payment flows) update `current_balance` via direct `UPDATE` rather than through GL postings. This causes it to diverge from the GL balance. Any UI that displays `current_balance` as if it were the real balance is showing stale or incorrect data.

2. **Subledger not created on type change.** If a contact is created as `customer` and later updated to `both`, `ensurePayableSubaccountForContact` is never called during `updateContact`. The AP subledger is missing; purchase postings fall through to the `2000` control account for that contact.

3. **`linked_contact_id` column missing pre-migration.** If the `accounts.linked_contact_id` column does not exist (migration not applied), `ensureReceivableSubaccountForContact` and `ensurePayableSubaccountForContact` silently create the account without the link. `findSubledgerByContact` then cannot find it by `linked_contact_id`, leading to duplicate account creation on subsequent calls. The duplicate is caught by the unique constraint on `code`, and the existing account is returned via fallback lookup.

4. **`get_contact_balances_summary` RPC failure returns empty map.** The caller cannot distinguish "this contact has zero balance" from "the RPC failed". The `error` field in the return value must be checked. If callers substitute client-side AR/AP math when the RPC fails, the displayed balance is an approximation that can be significantly wrong.

5. **Walk-in customer uniqueness not enforced on old installs.** The DB constraint `unique_walkin_per_company_strict` was added in a migration. On pre-migration installs, multiple walk-in rows can exist per company. `getDefaultCustomer` returns the first match by `system_type`, but the `is_default` fallback may return any of several candidates.

6. **`opening_balance` sync via `openingBalanceJournalService` can fail silently.** `syncOpeningGlForContact` catches all errors and logs them without re-throwing. If the opening balance JE fails, the GL does not reflect the opening balance but the contact row shows it. The GL balance will appear understated by the opening amount.

7. **AP control code is `2000`, not `2100`.** The `partySubledgerAccountService` uses `getAccountByCode('2000', companyId)` for the AP control. If the Chart of Accounts was seeded with AP at `2100` (a common alternative), the lookup returns null and no AP subledger is created. All AP postings fall to whatever account code exists; there is no error surfaced to the user.

8. **Three-layer retry in `createContact` can mask real errors.** If the first insert fails for a legitimate reason (e.g. a constraint violation unrelated to optional columns), the service retries with stripped columns and may insert an incomplete record, or the error may eventually propagate from the minimal-columns attempt with a misleading message.

---

## Recommended Standard

1. **Never read `contacts.current_balance` for accounting decisions.** Always use the GL RPC (`get_contact_party_gl_balances`) or the effective ledger service (`loadEffectivePartyLedger`) for any balance displayed in financial views.

2. **Always call `ensurePartySubledgersForContact` after any contact type change.** Add a call in `updateContact` when `updates.type` is present, mirroring the post-create behaviour.

3. **Check `get_contact_balances_summary` error field before rendering balances.** Do not fall back to client-side derived values if the RPC fails — surface the error to the user instead.

4. **Verify AR control account code.** Confirm `accounts` table has a row with `code = '1100'` and a row with `code = '2000'` (not `'2100'`) for the AP control account, or update `partySubledgerAccountService` to use the correct code for the install's COA.

5. **Run migrations before onboarding new tenants.** Ensure `accounts.linked_contact_id` column exists, `unique_walkin_per_company_strict` constraint is present, and `get_contact_party_gl_balances` RPC is deployed.

6. **Use `contactService.getContacts()` (not direct Supabase queries) in components.** This ensures consistent `company_id` filtering and type-based filtering patterns. Direct queries in components bypass the service's error handling and retry logic.

7. **Do not hard-code contact type strings.** Use the four canonical values: `'customer'`, `'supplier'`, `'both'`, `'worker'`. UI filters and GL routing both depend on exact string matching.
