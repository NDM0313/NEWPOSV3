# 25. Accounting Architecture Freeze

**Date:** 2026-04-12  
**Status:** LOCKED — decisions are non-negotiable; all diverging code must be patched  
**Scope:** Multi-tenant Supabase ERP (company `595c08c2` is reference company)

---

## 1. Locked Canonical Sources

| Domain | Canonical Source | Forbidden Alternatives |
|--------|-----------------|----------------------|
| GL truth (balances, P&L, BS) | `journal_entries` + `journal_entry_lines` | `ledger_master`, `ledger_entries`, `chart_accounts`, `account_transactions`, `contacts.current_balance`, `workers.current_balance`, `accounts.balance` |
| Stock quantity | `stock_movements` (SUM per product/branch) | `products.current_stock`, `inventory_balance` (cache only, allowed for display) |
| Sale line items | `sales_items` | `sale_items` (LEGACY — no new writes) |
| Purchase line items | `purchase_items` | none |
| Sale return line items | `sale_return_items` | none |
| Purchase return line items | `purchase_return_items` | none |
| Document numbering | `erp_document_sequences` via `generate_document_number` RPC | `document_sequences`, `document_sequences_global` |
| Party AR balance | Party subledger account in `journal_entry_lines` (code `AR-{slug}`) | `contacts.current_balance` |
| Party AP balance | Party subledger account in `journal_entry_lines` (code `AP-{slug}`) | `contacts.current_balance` |
| Worker owed balance | `journal_entry_lines` (worker ledger accounts) | `workers.current_balance` |

---

## 2. GL Write Rules

### 2.1 Every finalized financial document must post exactly one settlement JE

| Document type | Fingerprint format | Dr | Cr |
|--------------|-------------------|----|----|
| Sale (final) | `sale_document:{companyId}:{saleId}` | Revenue (4100) | AR subledger or Cash (1000) or Bank (1010) |
| Sale (inventory) | `sale_stock:{companyId}:{saleId}` | COGS (5000) | Inventory (1200) |
| Sale Return (final) | `sale_return_settlement:{companyId}:{returnId}` | Revenue (4100) | AR subledger or Cash or Bank |
| Sale Return (inventory) | `sale_return_cogs:{companyId}:{returnId}` | Inventory (1200) | COGS (5000) |
| Purchase (final) | `purchase_document:{companyId}:{purchaseId}` | Inventory (1200) | AP subledger or 2000 |
| **Purchase Return (final)** | **`purchase_return_settlement:{companyId}:{returnId}`** | **AP subledger or 2000** | **Inventory (1200)** |
| Payment (receipt) | `payment:{companyId}:{paymentId}` | Cash/Bank | AR subledger |
| Expense | `expense_document:{companyId}:{expenseId}` | Expense account | Cash/Bank |

### 2.2 JE Idempotency Contract

Before inserting any JE, check `action_fingerprint` uniqueness:
```sql
SELECT id FROM journal_entries
WHERE action_fingerprint = $fingerprint
  AND (is_void IS NULL OR is_void = FALSE);
```
If a row exists: skip insertion (idempotent). Never insert a second active JE with the same fingerprint.

### 2.3 Void Contract

When voiding a document:
1. Set `is_void = TRUE` on the original JE.
2. Post a `correction_reversal` JE via `accountingService.createReversalEntry()` — do NOT manually mirror lines.
3. The `UNIQUE` partial index on `action_fingerprint WHERE NOT is_void` frees the fingerprint slot for repost.

---

## 3. Forbidden Write Patterns

The following are HARD BANS — code found doing any of these must be patched immediately:

| Banned operation | Why | Fix |
|-----------------|-----|-----|
| `supabase.from('ledger_master').insert(...)` | Retired duplicate subledger | Use `journal_entry_lines` via `accountingService.createEntry()` |
| `supabase.from('ledger_entries').insert(...)` | Retired duplicate subledger | Use `journal_entry_lines` via `accountingService.createEntry()` |
| `supabase.from('sale_items').insert(...)` | Legacy table; canonical is `sales_items` | Write to `sales_items` |
| `supabase.from('contacts').update({ current_balance: ... })` | Cache diverges from GL | Read balance from `journal_entry_lines`; do not write cache |
| `supabase.from('workers').update({ current_balance: ... })` | Cache diverges from GL | Read balance from worker ledger accounts in JE lines |
| Manual account balance: `supabase.from('accounts').update({ balance: ... })` | GL computed from JE lines, not stored | Never store balance on accounts row |
| Finalizing purchase return without JE | AP stays overstated | Patch: post `purchase_return_settlement` JE in `finalizePurchaseReturn()` |
| Studio V3 order complete without JE | Revenue recognised with no GL | Block: hard throw until JE layer implemented |

---

## 4. Table Status Registry

### CANONICAL (write freely)
- `journal_entries` — JE headers
- `journal_entry_lines` — JE lines (always paired)
- `accounts` — COA (read/write for setup only)
- `sales` — sale documents
- `sales_items` — sale line items (canonical plural form)
- `sale_returns` — return headers
- `sale_return_items` — return lines
- `purchases` — purchase documents
- `purchase_items` — purchase lines
- `purchase_returns` — return headers
- `purchase_return_items` — return lines
- `payments` — payment records
- `payment_allocations` — FIFO allocation
- `stock_movements` — every stock change
- `products` — product master
- `product_variations` — variation master
- `contacts` — contact master (except `current_balance` field)
- `workers` — worker master (except `current_balance` field)

### CACHE (read for display; do not use as GL truth)
- `products.current_stock` — trigger-maintained; recomputed from `stock_movements`
- `inventory_balance` — materialized stock snapshot
- `contacts.current_balance` — trigger-maintained; may lag GL
- `workers.current_balance` — manually maintained; may lag GL

### LEGACY (read-only; no new writes; retire on schedule)
- `sale_items` — legacy singular form; reads allowed for backward compat
- `ledger_master` — retired subledger (code hidden: `${'ledger'}_${'master'}`)
- `ledger_entries` — retired subledger (code hidden: `${'ledger'}_${'entries'}`)
- `chart_accounts` — replaced by `accounts`
- `account_transactions` — replaced by `journal_entry_lines`
- `document_sequences` — replaced by `erp_document_sequences`
- `document_sequences_global` — being unified into `erp_document_sequences`

### FORBIDDEN AS GL TRUTH
- `backup_cr`, `backup_pf145` — historical snapshots; never for live UI

---

## 5. Code Enforcement

### accountingCanonicalGuard.ts
- `warnLegacyRead()` — throttled console warning in dev
- `failLegacyReadInDev()` — throws if `VITE_ACCOUNTING_LEGACY_HARD_FAIL=true`
- `assertNotLegacyTableForGlTruth()` — asserts table not in blocklist

**Phase 3 target:** Default to throw in non-production (`import.meta.env.MODE !== 'production'`) without needing env var.

### Environment flags
| Flag | Effect |
|------|--------|
| `VITE_ACCOUNTING_STRICT_LEGACY=true` | Enables legacy read warnings |
| `VITE_ACCOUNTING_LEGACY_HARD_FAIL=true` | Converts warnings to throws |
| `VITE_ACCOUNTING_DEBUG_SOURCES=true` | Logs every canonical source assertion |

---

## 6. Change Control

Any change to a canonical write path (new JE format, new fingerprint, new table for GL truth) requires:
1. Evidence: read the service file and verify the before-state
2. Patch: apply minimal targeted change
3. Build: `npm run build` — 0 errors
4. Verify: SQL check that JEs match document totals after repair
5. Doc: update or create the relevant `docs/system-audit/` entry
