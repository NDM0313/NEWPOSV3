# Canonical source registry — NEW POSV3 (hard cutover)

**Purpose:** Single map of **screen → service → tables/RPC → balance type → status**.  
**Rule:** GL truth = `journal_entries` + `journal_entry_lines` + `accounts` (COA ids only). Nothing else is GL.

**Status legend**

| Status | Meaning |
|--------|---------|
| **canonical_keep** | Approved live path for that concern |
| **replace_now** | Must migrate to canonical or labeled operational |
| **legacy_block** | Do not use as financial truth; guard / relabel |
| **archive_only** | Backups / one-off scripts only |

---

## Core GL & reports

| Screen / area | Service / function | RPC / SQL / view | Underlying tables | Balance type | Status |
|---------------|-------------------|------------------|---------------------|--------------|--------|
| Trial Balance | `accountingReportsService.getTrialBalance` | Client query | `journal_entry_lines`, `journal_entries`, `accounts` | **GL** | canonical_keep |
| P&L / BS (reports) | `accountingReportsService` | Same pattern | `journal_*`, `accounts` | **GL** | canonical_keep |
| Account ledger (GL) | `accountingService.getAccountLedger` / lines query | — | `journal_entry_lines`, `journal_entries`, `accounts` | **GL** | canonical_keep |
| AR/AP GL snapshot | `accountingReportsService.getArApGlSnapshot` | TB slice | Same as TB | **GL** | canonical_keep |
| Account balances map | `accountingReportsService.getAccountBalancesFromJournal` | TB | Same | **GL** | canonical_keep |
| COA list / edit | `accountService` | Supabase | `accounts` | Meta + **cache** `balance`/`current_balance` on row | canonical_keep (COA); **replace_now** for displaying stored balance as truth → use journal rollups |

---

## Add Entry & party due (forms)

| Screen | Service | RPC / SQL | Tables | Balance type | Status |
|--------|---------|-----------|--------|--------------|--------|
| AddEntryV2 | `partyFormBalanceService.loadPartyFormBalances` | `get_contact_party_gl_balances` | `journal_entry_lines`, `journal_entries`, `accounts`, resolve party via `sales`/`purchases`/`payments` | **GL** party slice | canonical_keep |
| AddEntryV2 | same | `get_contact_balances_summary` | `contacts`, `sales`, `purchases`, `worker_ledger_entries`, `workers` | **operational** | canonical_keep (secondary line only) |
| AddEntryV2 fallback | inline | — | `contacts.current_balance` | **cache / legacy as truth** | **legacy_block** — must be labeled “contact cache” when RPC fails |

---

## Contacts page

| Screen | Service | RPC | Tables | Balance type | Status |
|--------|---------|-----|--------|--------------|--------|
| ContactsPage | `contactService.getContactBalancesSummary` | `get_contact_balances_summary` | `sales`, `purchases`, openings, worker paths | **operational** | canonical_keep for **operational** column |
| ContactsPage | `accountingReportsService.getArApGlSnapshot` | TB | `journal_*`, `accounts` | **GL** control totals | canonical_keep (variance strip) |
| ContactsPage phase 1 | `convertFromSupabaseContact` | — | `contacts`, `workers.current_balance` | **cache** | **legacy_block** as truth — display only with label |
| Contacts reconciliation strip | `getCompanyReconciliationSnapshot` | `get_contact_balances_summary` + TB + `count_unmapped_*` | Mixed | **reconciliation** | canonical_keep |

---

## Party “ledgers” (customer / supplier / user / worker)

| Screen | Service | Primary data | Balance type | Status |
|--------|---------|--------------|--------------|--------|
| LedgerHub → Customer | `customerLedgerAPI` + `GenericLedgerView` | `contacts`, `sales`, `rentals`, payments mix | **operational** + journal lines in some paths | **mixed** — **replace_now** per PARTY_LEDGER_UNIFICATION_PLAN |
| LedgerHub → Supplier | `ledgerDataAdapters` / `ledgerService` | `ledger_master`, `ledger_entries` | **UI subledger** (not GL) | legacy_block as “GL” |
| LedgerHub → User | `ledgerService` | `ledger_master`, `ledger_entries` | **UI subledger** | legacy_block as “GL” |
| LedgerHub → Worker | `studioService` / worker components | `worker_ledger_entries`, stages | **operational / studio** | operational_support; GL from journals separately |
| CustomerLedgerPageOriginal | `customerLedgerAPI` | Sales/rentals + `accountingService.getCustomerLedger` mix | **mixed** | replace_now |
| AccountLedgerPage / AccountLedgerView | `accountingService` | Journal lines | **GL** | canonical_keep |
| GenericLedgerView | Routes to customer vs supplier adapters | Mixed | **mixed** | replace_now |

---

## Accounting dashboard & journal list

| Screen | Source | Balance type | Status |
|--------|--------|--------------|--------|
| AccountingDashboard entries | `AccountingContext` → journal fetch | **GL** list | canonical_keep |
| ManualEntryDialog / journals | `accountingService` | **GL** | canonical_keep |

---

## Reconciliation & integrity

| Screen | Service | Tables | Type | Status |
|--------|---------|--------|------|--------|
| ArApReconciliationCenterPage | `arApReconciliationCenterService`, `integrityLabService` | `journal_*`, views `v_reconciliation_*` | GL + rules | canonical_keep |
| DeveloperIntegrityLabPage | `integrityLabService`, `resolveJournalUiRefsByJournalIds` | `journal_*`, `payments`, `contacts` | GL diagnostics | canonical_keep |
| contactBalanceReconciliationService | RPC + TB | Mixed | **reconciliation** | canonical_keep |

---

## Worker / studio

| Area | Service | Tables | Type | Status |
|------|---------|--------|------|--------|
| Worker payment posting | `workerPaymentService`, `addEntryV2Service` | `payments`, `journal_*`, `worker_ledger_entries` | GL + ops sync | canonical_keep (posting); worker_ledger = **operational_support** |
| Studio production costs | `studioCostsService` | `journal_entry_lines` primary; fallback `worker_ledger_entries` | GL + **legacy fallback** | replace_now (remove silent legacy path) |

---

## Financial dashboard & misc

| Screen | Service | Issue | Status |
|--------|---------|-------|--------|
| Financial dashboard cards | `financialDashboardService` | Reads `accounts.balance` / `current_balance` | **cache** — **legacy_block** as truth |
| AccountingTestPage | inline contacts | `current_balance` | legacy_block |
| PurchaseForm / SaleForm (due in picker) | sale/purchase aggregates | Open doc | operational — label |

---

## Explicitly not canonical for GL

| Artifact | Notes | Status |
|----------|-------|--------|
| `chart_accounts` | Not used by app services for posting | archive_only / legacy |
| `account_transactions` | Tied to chart_accounts | archive_only |
| `ledger_master` / `ledger_entries` | UI supplier/user ledger | operational_support / **not GL** |
| `backup_cr_*`, `backup_pf145_*` | Backups | archive_only |
| `contacts.current_balance`, `workers.current_balance`, `accounts.balance` | Cache columns | **cache** — legacy_block as truth |

---

*Last updated: canonical cutover pass.*
