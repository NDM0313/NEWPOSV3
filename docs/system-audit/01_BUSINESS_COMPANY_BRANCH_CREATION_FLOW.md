# 01 — Business / Company / Branch Creation Flow

**Last updated:** 2026-04-12
**Domain:** Multi-tenant onboarding — company setup, branch creation, COA seeding
**Key files:**
- `src/app/services/businessService.ts`
- `src/app/services/branchService.ts`
- `src/app/services/defaultAccountsService.ts`
- `src/app/components/auth/CreateBusinessWizard.tsx`
- `src/app/context/SettingsContext.tsx`
- `src/app/context/FeatureFlagContext.tsx`

---

## Business Purpose

Every tenant in this system is a **company** (one row in the `companies` table). A company has one or more **branches** (locations). All data — sales, purchases, inventory, accounting, contacts — is scoped to `company_id`. This flow documents how a brand-new business is registered: the Supabase Auth user is created, the company row and initial branch row are inserted via a DB-level RPC transaction, the Chart of Accounts is seeded, default contacts are created, and settings are initialised.

This is the most critical flow in the system. Failures here leave the tenant in a partially-initialised state that affects every downstream operation.

---

## UI Entry Points

1. **Create Business Wizard** (`src/app/components/auth/CreateBusinessWizard.tsx`)
   - Accessed from the login/register screen when no company is linked to the current auth session.
   - A 5-step multi-page form.
   - On completion, calls `businessService.createBusiness()` then invokes the `onSuccess(email, password)` callback, which signs the user in.

2. **Settings > Branches** (Settings page, branch management tab)
   - Used to add additional branches after the initial company setup.
   - Calls `branchService.createBranch()` directly.

3. **Repair flow: "Link Auth User to Business"**
   - Triggered when a user is authenticated (has a Supabase Auth session) but the `public.users` row is missing or has no `company_id`.
   - Calls `businessService.linkAuthUserToBusiness()` → `link_auth_user_to_business` RPC.

---

## Frontend Files

| File | Role |
|------|------|
| `src/app/components/auth/CreateBusinessWizard.tsx` | 5-step onboarding wizard UI. Collects all setup data and submits via `businessService.createBusiness()`. |
| `src/app/services/businessService.ts` | Client-side service. Orchestrates Auth sign-up and the `create_business_transaction` RPC call. |
| `src/app/services/branchService.ts` | Branch CRUD service. Triggers COA seed and walk-in customer after branch insert. |
| `src/app/services/defaultAccountsService.ts` | Seeds the full Chart of Accounts for a company. Idempotent. |
| `src/app/context/SettingsContext.tsx` | On first authenticated load, reads all company settings from DB into context. |
| `src/app/context/FeatureFlagContext.tsx` | On mount, reads `erp_feature_permission_v2` from localStorage; defaults to `true`. |

---

## Backend Services (Key Function Signatures)

### `businessService`

```typescript
// src/app/services/businessService.ts

interface CreateBusinessRequest {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  currency?: string;           // default: 'PKR'
  fiscalYearStart?: string;    // YYYY-MM-DD
  branchName?: string;         // default: 'Main Branch'
  branchCode?: string;         // default: 'HQ'
  phone?: string;
  address?: string;
  country?: string;
  timezone?: string;
  businessType?: string;       // retail | wholesale | manufacturing | rental | mixed
  modules?: string[];          // module ids to enable
}

interface CreateBusinessResponse {
  success: boolean;
  userId?: string;
  companyId?: string;
  branchId?: string;
  error?: string;
}

businessService.createBusiness(data: CreateBusinessRequest): Promise<CreateBusinessResponse>

businessService.linkAuthUserToBusiness(): Promise<{ success: boolean; error?: string; email_looked_up?: string }>
```

### `branchService`

```typescript
// src/app/services/branchService.ts

interface Branch {
  id: string;
  company_id: string;
  name: string;
  code?: string;                          // e.g. BR-001, HQ
  branch_code?: string;                   // alias for code
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  is_active: boolean;
  fiscal_year_start?: string | null;
  fiscal_year_end?: string | null;
  default_cash_account_id?: string | null;
  default_bank_account_id?: string | null;
  default_pos_drawer_account_id?: string | null;
}

type BranchAccessMode = 'AUTO' | 'RESTRICTED';
// AUTO: company has 1 branch → auto-assigned
// RESTRICTED: company has 2+ branches → user must be assigned via user_branches

branchService.createBranch(branch: Partial<Branch>): Promise<Branch>
branchService.updateBranch(id: string, updates: Partial<Branch>): Promise<Branch>
branchService.deleteBranch(id: string): Promise<void>                    // soft delete: is_active = false
branchService.getAllBranches(companyId: string): Promise<Branch[]>        // active only
branchService.getBranchesCached(companyId: string): Promise<Branch[]>    // 5-min in-memory cache
branchService.getCompanyBranchCount(companyId: string): Promise<number>
branchService.generateBranchCode(companyId: string): Promise<string>     // BR-001, BR-002...
branchService.clearBranchCache(): void                                    // call on sign-out
```

### `defaultAccountsService`

```typescript
// src/app/services/defaultAccountsService.ts

defaultAccountsService.ensureDefaultAccounts(companyId: string): Promise<void>
// Idempotent. Seeds group accounts then leaf accounts. Repairs parent_id links.
// Throws if mandatory payment accounts (1000, 1010, 1020) are missing after seed.

defaultAccountsService.getDefaultAccountByPaymentMethod(
  paymentMethod: string,  // 'cash' | 'bank' | 'card' | 'cheque' | 'mobile_wallet'
  companyId: string
): Promise<string | null>  // returns account id

defaultAccountsService.isCorePaymentAccount(account: { code?, name?, type? }): boolean
defaultAccountsService.isMandatoryAccount(account: { code?, name? }): boolean
defaultAccountsService.getCorePaymentAccounts(): DefaultAccount[]
defaultAccountsService.coaHeaderCodes(): readonly string[]
```

---

## DB Tables

| Table | Used in this flow | Key columns |
|-------|------------------|-------------|
| `companies` | Created by `create_business_transaction` RPC | `id`, `name`, `currency`, `fiscal_year_start`, `business_type`, `modules_config` (JSONB) |
| `branches` | Created by RPC (initial) and `branchService.createBranch()` (subsequent) | `id`, `company_id`, `name`, `code`, `is_active`, `default_cash_account_id`, `default_bank_account_id` |
| `users` (public) | Created by RPC | `id`, `company_id`, `branch_id`, `role`, `email`, `full_name` |
| `accounts` | Populated by `defaultAccountsService.ensureDefaultAccounts()` | `id`, `company_id`, `code`, `name`, `type`, `parent_id`, `is_group`, `is_active`, `balance` |
| `contacts` | Walk-in Customer created by `contactService.createDefaultWalkingCustomer()` | `id`, `company_id`, `name`, `type` |
| `feature_flags` | Read on every session load by `featureFlagsService.getAll()` | `company_id`, `feature_key`, `enabled` |
| `erp_document_sequences` | Populated on first document creation per type | `company_id`, `branch_id`, `document_type`, `next_number`, `prefix` |

---

## Create Flow (Step by Step)

### Wizard Steps (CreateBusinessWizard.tsx)

The wizard has 5 steps and 1 final submit action:

**Step 1 — Business Info**
Collects: `businessName`, `businessType` (retail/wholesale/manufacturing/rental/mixed), `ownerName`, `email`, `password`, `confirmPassword`, `phone`, `address`, `country` (default: Pakistan), `timezone` (default: Asia/Karachi).
Validation: businessName required, ownerName required, email required, password min 6 chars, passwords must match.

**Step 2 — Financial Settings**
Collects: `currency` (default: PKR), `fiscalMonth` (default: July = `'7'`), `accountingMethod` (Accrual/Cash), `taxMode` (Inclusive/Exclusive), `defaultTaxRate`, `enableMultiBranch`.
`fiscalYearStart` is computed from `fiscalMonth` via `getFiscalYearStartFromMonth()` → `YYYY-MM-01`.
Default currencies offered: PKR, USD, EUR, GBP, AED, SAR.

**Step 3 — Inventory Settings**
Collects: `costingMethod` (FIFO / Weighted Average), `allowNegativeStock`, `defaultUnit` (pcs/meter/kg/liter).

**Step 4 — Module Selection**
Collects: `modules[]` — list of enabled module ids.
Pre-populated by business type template:
- `retail` → `[sales, pos, accounting, reports]`
- `wholesale` → `[sales, purchases, accounting, reports]`
- `manufacturing` → `[purchases, studio, sales, accounting, reports]`
- `rental` → `[rentals, sales, accounting, reports]`
- `mixed` → `[sales, purchases, rentals, pos, studio, accounting, expenses, payroll, reports]` (default)

Available modules: `sales`, `purchases`, `rentals`, `pos`, `studio`, `accounting`, `expenses`, `payroll`, `reports`.

**Step 5 — Branch Setup**
Collects: `branchName` (default: "Main Branch"), `branchCode` (default: "HQ"), `defaultWarehouse` (default: "Main").

**Final Submit (on Step 5 Next/Submit button)**

1. Calls `businessService.createBusiness(formData)`.
2. Inside `businessService.createBusiness()`:
   a. **Step 1 — Auth user creation:**
      Calls `supabase.auth.signUp({ email, password, options: { data: { full_name: ownerName } } })`.
      If the email is already registered (HTTP 422 or "already registered" in message), falls back to `supabase.auth.signInWithPassword()` — this allows an existing user to add a second business.
   b. **Step 2 — DB transaction via RPC:**
      Calls `supabase.rpc('create_business_transaction', { p_business_name, p_owner_name, p_email, p_password, p_user_id, p_currency, p_fiscal_year_start, p_branch_name, p_branch_code, p_phone, p_address, p_country, p_timezone, p_business_type, p_modules })`.
      The RPC runs in a single DB transaction and performs:
      - INSERT into `companies` → returns `companyId`
      - INSERT into `branches` (name = `p_branch_name`, code = `p_branch_code`) → returns `branchId`
      - INSERT into `public.users` (linking auth user to company + branch) → returns `userId`
      - Sets `modules_config` on the company row from `p_modules`
      Returns `{ success: true, userId, companyId, branchId }` on success.
   c. On RPC success, `businessService.createBusiness()` returns `{ success: true, userId, companyId, branchId }`.
3. The wizard's `onSuccess(email, password)` callback is invoked. This triggers a sign-in flow in the parent component.

### Post-Auth Settings Load (SettingsContext)

On first authenticated session load, `SettingsProvider` (in `SettingsContext.tsx`) runs:

1. Reads `companyId` and `branchId` from `SupabaseContext`.
2. Fetches company settings from Supabase (`companies` table).
3. Fetches branch list via `branchService.getAllBranches(companyId)`.
4. Fetches module toggles from `companies.modules_config`.
5. Fetches feature flags via `featureFlagsService.getAll(companyId)`.
6. Loads user permissions via `permissionService`.
7. Sets `isPermissionLoaded = true` (gates module rendering).

### COA Seeding (defaultAccountsService.ensureDefaultAccounts)

Triggered by `branchService.createBranch()` after the DB insert:

```typescript
// Inside createBranch():
const { defaultAccountsService } = await import('@/app/services/defaultAccountsService');
await defaultAccountsService.ensureDefaultAccounts(data.company_id);
```

`ensureDefaultAccounts(companyId)` runs the following seeding sequence:

**Group rows seeded first** (header accounts, `is_group: true`):

| Code | Name | Type |
|------|------|------|
| 1050 | Cash & Cash Equivalents | asset |
| 1060 | Bank Accounts | asset |
| 1070 | Mobile Wallets | asset |
| 1080 | Worker Advances | asset |
| 1090 | Inventory (group — post to 1200) | asset |
| 2090 | Trade & Other Payables | liability |
| 3090 | Equity | equity |
| 4050 | Revenue | revenue |
| 6090 | Operating Expenses | expense |

**Leaf rows seeded second** (posting accounts, children of groups):

| Code | Name | Type | Parent |
|------|------|------|--------|
| 1000 | Cash | cash | 1050 |
| 1001 | Petty Cash | cash | 1050 |
| 1010 | Bank | bank | 1060 |
| 1020 | Mobile Wallet | mobile_wallet | 1070 |
| 1100 | Accounts Receivable | asset | (none — control account) |
| 1180 | Worker Advance | asset | 1080 |
| 1200 | Inventory | inventory | 1090 |
| 2000 | Accounts Payable | liability | 2090 |
| 2010 | Worker Payable | liability | 2090 |
| 2011 | Security Deposit | liability | 2090 |
| 2020 | Rental Advance | liability | 2090 |
| 2030 | Courier Payable (Control) | liability | 2090 |
| 3000 | Owner Capital | equity | 3090 |
| 4100 | Sales Revenue | revenue | 4050 |
| 4110 | Shipping Income | revenue | 4050 |
| 4200 | Rental Income | revenue | 4050 |
| 5000 | Cost of Production | expense | 6090 |
| 6100 | General operating expenses | expense | 6090 |
| 6110 | Salary Expense | expense | 6090 |
| 6120 | Marketing Expense | expense | 6090 |

**Post-seed operations:**
1. `repairParents(companyId)` — iterates `REPAIR_PARENT_BY_CODE` list and ensures `parent_id` links are correct for all seeded codes (handles companies created before groups were added).
2. `repairLegacyOperatingExpense6100Name(companyId)` — if account 6100 is named "Operating Expense" (old name), renames it to "General operating expenses" to distinguish from group 6090.

**Mandatory payment account validation:**
After seeding, checks that accounts `1000` (Cash), `1010` (Bank), and `1020` (Mobile Wallet) all exist. If any are missing, throws an error:
```
Mandatory payment account {code} missing after COA seed
```

**Idempotency:** Every account is inserted only if `findByCode(list, code)` returns falsy. Re-running on an already-seeded company is safe — it skips existing accounts.

**4100 vs 4000 logic:** If an account with code `4000` or `4100` already exists (legacy companies used `4000` as "Sales Revenue"), the seed skips inserting `4100` to avoid duplication (`shouldSkipSalesRevenueSeed`).

### Walk-in Customer Creation

After COA seeding, `branchService.createBranch()` calls:
```typescript
const { contactService } = await import('@/app/services/contactService');
await contactService.createDefaultWalkingCustomer(data.company_id);
```
This creates a "Walk-in Customer" contact scoped to the company (not branch-specific). Idempotent. Used as the default customer in POS transactions.

---

## Edit / Update Flow

### Update Company Settings

- UI: Settings page → Company Info tab
- Service: `settingsService.updateCompanySettings(companyId, updates)`
- Table: `companies` — updates name, address, phone, email, currency, logo, timezone, date/time format, business type
- Context: `SettingsProvider.updateCompanySettings()` calls the service then updates local state

### Update Branch

- UI: Settings page → Branches tab → Edit branch
- Service: `branchService.updateBranch(id, updates)`
- Table: `branches` — updates name, code, address, phone, `default_cash_account_id`, `default_bank_account_id`, `default_pos_drawer_account_id`
- Note: `company_id` is never updated (immutable after creation)

### Update Module Toggles

- UI: Settings page → Modules tab
- Service: `settingsService.updateModules(companyId, modules)` — writes to `companies.modules_config`
- Context: `SettingsProvider.updateModules()` → updates local `ModuleToggles` state → re-evaluates module-gated views in `App.tsx`

### Update Feature Flags (DB-backed)

- UI: Settings page → Feature Flags / Developer panel
- Service: `featureFlagsService.setEnabled(companyId, featureKey, enabled)` — upserts `feature_flags` row on `(company_id, feature_key)`
- Context: `SettingsProvider.updateFeatureFlag()` → updates local `featureFlags` record

---

## Delete / Deactivate Flow

### Deactivate Branch

- Service: `branchService.deleteBranch(id)` — sets `is_active = false` on the branch row. Hard deletes are not performed.
- Effect: The branch disappears from `branchService.getAllBranches()` (which filters `is_active = true`). The in-memory branch cache (`branchListCache`) is **not** automatically invalidated — `clearBranchCache()` must be called after deactivation.
- Risk: If the deactivated branch's `id` is still stored as the selected `branchId` in `GlobalFilterContext` (via localStorage), queries will find no data for that branch. Users will see empty screens until they clear the filter or select another branch.
- Company deletion is not supported in the UI. No `deleteCompany` function exists in `businessService`.

---

## Accounting Effect

### At Company/Branch Creation

No journal entries are created at company or branch creation time. The Chart of Accounts is seeded with all accounts at balance `0`. Opening balances must be entered separately via the Accounting module → Opening Balances form, which posts a `journal_entry` with `source_type = 'opening_balance'`.

### Payment Method → Account Mapping

`defaultAccountsService.getDefaultAccountByPaymentMethod(method, companyId)` resolves a payment method string to an account ID:
- `'cash'` → account code `1000` (Cash)
- `'bank'`, `'card'`, `'cheque'` → account code `1010` (Bank)
- `'mobile_wallet'` (or any string containing "wallet") → account code `1020` (Mobile Wallet), fallback to `1010`

This mapping is used by all sales, purchase, and expense posting flows to identify the debit/credit account for payments.

### Branch Default Account Columns

`branches.default_cash_account_id`, `branches.default_bank_account_id`, and `branches.default_pos_drawer_account_id` allow a branch to override the company-level default payment accounts. These must be set manually in Settings after branch creation. If null, all modules fall back to the company-level accounts (codes 1000, 1010, 1020).

---

## Source of Truth

| Data | Source of Truth | Location |
|------|----------------|----------|
| Company identity (id, name, currency) | `companies` table | Supabase DB |
| Branch list | `branches` table | Supabase DB |
| Company settings (POS, sales, purchase, rental, accounting) | `companies` table (JSONB settings columns) | Supabase DB |
| Module toggles | `companies.modules_config` (JSONB) | Supabase DB |
| Feature flags (studio V2/V3, etc.) | `feature_flags` table | Supabase DB |
| Permission V2 UI toggle | `localStorage['erp_feature_permission_v2']` | Browser |
| Branch filter selection | `localStorage['erp-global-filters']` | Browser |
| Legacy module toggles | `localStorage['erp_modules']` | Browser |
| Auth session | Supabase Auth (JWT) | Supabase Auth |
| COA (Chart of Accounts) | `accounts` table | Supabase DB |

---

## Editable vs Non-Editable

| Field | Editable After Creation? | Notes |
|-------|--------------------------|-------|
| `companies.id` | No | UUID, generated by DB |
| `companies.name` | Yes | Via Settings |
| `companies.currency` | Technically yes | Changing currency after transactions exist is dangerous — no currency conversion is performed |
| `companies.fiscal_year_start` | Yes | Via Settings; affects report date ranges |
| `branches.company_id` | No | Multi-tenant key; never changes |
| `branches.code` | Yes | Via Settings — but changing a code after documents reference it can break display |
| `branches.is_active` | Yes (soft-delete only) | `deleteBranch()` sets to false |
| `accounts.code` | Yes (via accountService.updateAccount) | Changing a code that is hard-referenced by `CORE_PAYMENT_CODES` will break payment posting |
| `accounts.company_id` | No | RLS key |
| `users.company_id` | No | Set by RPC; cannot be changed in application |

---

## Known Failure Points / Risk

### 1. RPC transaction atomicity — partial COA seed

`create_business_transaction` runs in a single DB transaction: if it fails mid-way, company + branch + user are all rolled back cleanly. However, `defaultAccountsService.ensureDefaultAccounts()` is called **after** the RPC returns, inside `branchService.createBranch()`. If the COA seed fails (e.g. network error, DB constraint violation), the branch exists in the DB but has no Chart of Accounts.

**Impact:** Every subsequent accounting operation (sale posting, purchase posting, expense) will fail because the required accounts (1000, 1010, 1020, 1100, 2000, etc.) do not exist.

**Mitigation:** `ensureDefaultAccounts` is idempotent. It can be re-run at any time by navigating to Settings → Branches → (trigger any action that calls `branchService.createBranch()` again, or call from a developer repair page). The error is caught with `console.warn` and does not block branch creation, so the branch row exists but is in a degraded state.

**Detection:** If payment accounts 1000, 1010, or 1020 are missing after seeding, `ensureDefaultAccounts` throws `Mandatory payment account {code} missing after COA seed`. This propagates to the caller as an uncaught exception.

### 2. Walk-in Customer not created

Similarly, `contactService.createDefaultWalkingCustomer()` is called after branch creation with only a `console.warn` on failure. If it fails, POS transactions will have no default customer — the POS page may error or require manual customer selection for every transaction.

### 3. Email already registered — password mismatch

If a user's email is already in Supabase Auth (from a previous business creation attempt that failed mid-way), `businessService.createBusiness()` falls back to `signInWithPassword`. If the password entered in the wizard does not match the existing Supabase Auth password, this returns an error: "This email is already registered. Sign in with your password above, or use a different email to create a new business." The user is stuck — they cannot complete onboarding with that email unless they know the original Auth password.

### 4. Currency change after data exists

`companies.currency` can be updated via Settings. However, the system does not perform any currency conversion. Changing from PKR to USD after sales exist means all historical figures remain in PKR amounts with a USD label — corrupting all financial reports.

### 5. Branch cache staleness

`branchListCache` in `branchService.ts` has a 5-minute TTL. After `deleteBranch()` or `updateBranch()`, the cache is not proactively invalidated. Components reading branches from the cache will see stale data for up to 5 minutes. `clearBranchCache()` must be called explicitly (it is wired to the sign-out flow, not to branch mutations).

### 6. `user_branches` not populated on initial setup

The `create_business_transaction` RPC creates the user and the first branch, but it may not automatically insert a row in `user_branches`. In RESTRICTED mode (2+ branches), users must be assigned to branches via `user_branches`. If this link is missing, a user will have no branches available in the branch selector, making all filtered queries return empty. Check after adding a second branch.

### 7. `parent_id` repair runs on every `ensureDefaultAccounts` call

`repairParents()` calls `accountService.getAllAccounts()` in a loop — once per account in `REPAIR_PARENT_BY_CODE` (21 entries). On a company with many accounts, this is 21 sequential DB round-trips. This is acceptable during setup but should not be called in hot paths.

---

## Recommended Standard

### When creating a new company

1. Always use `businessService.createBusiness()` — never insert directly into `companies` or `branches`. The RPC handles atomicity.
2. After `createBusiness()` succeeds, verify that `defaultAccountsService.ensureDefaultAccounts(companyId)` completes without error before allowing the user to post any transactions.
3. Verify the walk-in customer exists (`contactService.createDefaultWalkingCustomer`) before enabling POS.

### When adding a new branch

1. Use `branchService.createBranch()` — it auto-generates a branch code and triggers COA seed and walk-in customer.
2. After branch creation, set `default_cash_account_id`, `default_bank_account_id`, and `default_pos_drawer_account_id` on the branch (via `branchService.updateBranch`) to point to the correct accounts for that branch.
3. Add the user to `user_branches` for the new branch if the company is in RESTRICTED mode (2+ branches).
4. Call `branchService.clearBranchCache()` or wait for the 5-minute cache TTL to expire before expecting branch selectors to show the new branch.

### COA seed integrity

1. Never delete accounts with codes `1000`, `1010`, `1020`, `1100`, or `2000` — these are mandatory for all posting flows.
2. Accounts `1050`, `1060`, `1070`, `1080`, `1090`, `2090`, `3090`, `4050`, `6090` are group headers (non-posting). Do not post journal lines to these accounts — use child accounts.
3. If a company's COA is suspected to be incomplete, run `defaultAccountsService.ensureDefaultAccounts(companyId)` from a developer repair page — it is fully idempotent.
4. Account code changes must be audited for downstream dependencies: payment method mappings (`getDefaultAccountByPaymentMethod`), branch default account columns, and any hard-coded references in posting services.

### Feature flags

1. DB-backed flags (`feature_flags` table) control Studio V2/V3 and customer invoice features. Default is disabled (no row = off). Enable only after verifying the feature is stable for the company.
2. The `permissionV2` localStorage flag is a UI toggle only — it does not gate data access. It defaults to `true`. Changing it to `false` hides the enterprise permissions UI but does not remove underlying permissions.
3. Module toggles (`companies.modules_config`) gate view rendering in `App.tsx`. Disabling a module does not delete its data — it only hides the UI.

### Multi-tenant isolation checklist

Every new service function that queries data must:
- Accept `companyId` as a parameter (never read it from a singleton or global)
- Apply `.eq('company_id', companyId)` on every Supabase query
- Not rely solely on RLS — application-layer filtering is a defence-in-depth requirement
- Never expose data from one company in another company's query results
