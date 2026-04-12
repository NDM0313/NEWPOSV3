# Final: inventory account unification (1200 canonical) and returns / stock alignment

**Date:** 2026-04-11  
**Goal:** One **posting** inventory asset account (**1200**). Chart **1090** remains the **group** parent only — not a second inventory asset.

---

## 1. Why both 1090 and 1200 appeared “in use”

- **Designed COA:** `defaultAccountsService` / seed defines **1090** as `is_group: true` (“Inventory” **section header**) and **1200** as the real **`type: inventory`** leaf under it.
- **Bug class:** `AccountingContext.createEntry` resolved logical account **`Inventory`** by scanning `accounts` with **name equality / includes** `"inventory"`. The **first** matching row was often **1090** (same display name `"Inventory"`, type `asset`, group) **before** **1200** in list order — so **purchase returns** and any other `creditAccount: 'Inventory'` / `debitAccount: 'Inventory'` path could post **journal lines to the group id** instead of **1200**.
- **Purchase document JEs** already preferred **1200** in `purchaseAccountingService` via explicit code lookup — so **purchases vs returns** could split across two GL accounts even though stock quantity signs were correct.

**Purchase return negative quantity in stock movements** is still the correct economic sign (stock out to supplier); this work fixes **GL routing**, not movement polarity.

---

## 2. Engine changes (no new fake totals; DB-backed)

### 2.1 `src/app/lib/inventoryAccountRouting.ts` (new)

- `pickCanonicalInventoryAssetAccount(accounts)`  
  - Prefers **`code === '1200'`** (active, non-group).  
  - Then **`type === 'inventory'`** (non-group).  
  - Excludes **`code === '1090'`** and **`is_group === true`**.

### 2.2 `AccountingContext.tsx`

- **`metadata.creditAccountId`** supported (parallel to `debitAccountId`).
- **`createEntry`:** if debit/credit logical side is **Inventory**, resolve via **`pickCanonicalInventoryAssetAccount`** before generic name matching; generic find **skips** Inventory name heuristics when already handled.
- **Retry path** (after `ensureDefaultAccounts`): same canonical rule; refreshed rows include **`is_group`** / **`parent_id`** for the helper.
- **`recordPurchaseReturn`:** when crediting **Inventory**, resolves **`1200`** via `accountHelperService.getAccountByCode('1200', companyId)` and passes **`creditAccountId`** into metadata so the credit line cannot fall back to 1090.

### 2.3 `purchaseAccountingService.ts`

- **`resolveInventoryGlAccountIdForPurchase(companyId)`** uses the same canonical picker over `1200` / `1500` / `type = inventory` rows.
- **`createPurchaseJournalEntry`** and **`postPurchaseEditAdjustments`** use it; removed the unsafe fallback **“first random asset account”** when inventory was missing.

### 2.4 `defaultAccountsService.ts`

- New companies / seed repair: group **1090** display name set to **`Inventory (group — post to 1200)`** to reduce operator confusion.

---

## 3. Data repair / freeze policy (SQL)

**Migration:** `migrations/20260443_inventory_canonical_1200_remap_1090_group_lines.sql`

1. **Relabel** all **`code = 1090`**, **`is_group = true`** accounts (name + description). **Does not** `DELETE` the row. **Does not** force `is_active = false` (keeps hierarchy stable for trees that expect an active parent).
2. **`UPDATE journal_entry_lines`** where **`account_id`** pointed at the **1090 group** row → same company’s **1200** leaf id.
3. **Rare path:** non-group duplicate coded **1090** → **1200** if both exist.

**After apply:** re-open TB / account statements; if `refresh_journal_entry_totals_from_lines` trigger exists (`20260434`), header totals stay consistent with lines.

---

## 4. Sales / POS / rental parity

- **`saleAccountingService`** already resolves inventory via **1200** (`getAccountByCode('1200', …)` pattern) for COGS / sale document flows — no change required for the 1090 name-collision class.
- **Rental / POS:** any future path that posts through **`createEntry`** with **`Inventory`** now inherits the same canonical resolution.

---

## 5. UI / COA behaviour

- **Operational COA** (`useAccountsHierarchyModel`) already excludes **`is_group`** rows from operational lists — **1090** should not appear as a normal posting line there.
- **Payment-only** pickers (`accountService.getPaymentAccountsOnly`) already exclude **`COA_HEADER_CODES`** including **1090**.
- **Relabelled 1090** in DB + seed makes the **Chart** and statements self-explanatory: “group — post to 1200”.

---

## 6. Validation checklist (post-migrate + deploy)

1. Purchase final → **Dr 1200** inventory (document JE).  
2. Purchase return → **Cr 1200** (not 1090) on new postings.  
3. Sale / COGS → **1200** as before.  
4. Sales return (if uses `Inventory` via `createEntry`) → **1200**.  
5. Stock ledger: **purchase_return** quantity still **negative** where applicable (correct).  
6. **1090** balance on new transactions should **not** grow; legacy mistaken lines remediated by migration.  
7. SATTAR / PUR-0002: re-check **party AP**, **1200** statement, and **no new lines on 1090**.

**SQL probes (replace company / account ids as needed):**

```sql
-- Lines still hitting 1090 group id (should be empty after repair + new code)
SELECT jel.id, je.entry_no, a.code, a.name, jel.debit, jel.credit
FROM journal_entry_lines jel
JOIN accounts a ON a.id = jel.account_id
WHERE trim(a.code) = '1090' AND coalesce(a.is_group,false) = true
LIMIT 50;

-- 1200 activity for purchase_return reference type (sample)
SELECT je.entry_no, je.reference_type, jel.debit, jel.credit
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE trim(a.code) = '1200'
  AND lower(coalesce(je.reference_type,'')) LIKE '%purchase%return%'
ORDER BY je.created_at DESC
LIMIT 20;
```

---

## 7. Build / deploy

- Run **`npm run build`** locally before deploy.  
- Apply **`20260443_inventory_canonical_1200_remap_1090_group_lines.sql`** on Supabase / production in your migration runner.  
- Deploy app bundle (e.g. **`ssh dincouture-vps`** + your `git pull` / `deploy-erp-domain.sh` flow) so **`AccountingContext`** / **`purchaseAccountingService`** fixes are live.

---

## 8. Summary

| Item | Outcome |
|------|---------|
| Root cause | Name-based `Inventory` match picked **1090 group** before **1200**. |
| Engine | Canonical **`pickCanonicalInventoryAssetAccount`** + **`creditAccountId`** on purchase return. |
| Purchases | Explicit resolver; no random asset fallback. |
| 1090 | **Not deleted**; **relabeled**; **JE lines remapped** off group id where applicable. |
| Stock signs | **Unchanged** by design (returns still negative qty where engine already did). |

This document is the closure report for **inventory GL unification** aligned with returns and operational reporting.
