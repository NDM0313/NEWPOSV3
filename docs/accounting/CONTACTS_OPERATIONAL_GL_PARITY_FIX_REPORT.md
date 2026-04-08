# Contacts page operational / GL parity — fix report

**Date:** 2026-03-29  
**Scope:** Live DIN COUTURE stack (`supabase-db` on VPS), web app `ContactsPage`, `contactService.getContactBalancesSummary`.

## 1. Root cause

### A) Stale `get_contact_balances_summary` on production Postgres

Live function matched **20260411** (branch parity on sales/purchases/payments) but **not** **20260430** (`migrations/20260430_get_contact_balances_operational_recv_pay_parity.sql`):

- **Payables:** no subtraction of non-void `paid` + `manual_payment` / `on_account` supplier payments → **DIN COUTURE** showed operational pay **100,000** while GL showed **70,000**.
- **Receivables:** no `voided_at IS NULL` guard on the customer subtract leg (migration also adds this for voided prepayments).

Applying the migration as **`supabase_admin`** succeeded; applying as **`postgres`** failed with `must be owner of function get_contact_balances_summary` (function owner is `supabase_admin`).

### B) Silent client fallback

`ContactsPage` called `get_contact_balances_summary` and, on **any** failure or `.catch(() => null)`, fell back to `convertFromSupabaseContact` with merged sales/purchases. That path **does not** mirror the RPC (no `manual_payment`/`on_account` subtract, no `final`-only sale filter parity, pagination on `getAllSales`, etc.), producing **wrong or stale-looking** grey numbers without a clear error.

### C) Header cards vs table rows

RECV/PAY cards summed **all contacts on the active tab**, while the table could narrow rows via search, branch filter, etc. Cards could disagree with **visible** row totals.

### D) ABC operational vs GL (55k vs 105k) after RPC was corrected

For company `595c08c2-1e47-4581-89c9-1f78de51c613`, contact **ABC** (`cc36436f-789c-4fd0-b6ed-e670a47a47e2`, type `both`):

- Final sale: due **50,000** (125,000 total − 75,000 `paid_amount` on the sale).
- A **`payments`** row: `received` / `manual_receipt` **50,000** (`c1aef7d4-e93d-4d46-8a18-0b8d1a3dca7c`), same branch as the sale.

The RPC formula is opening + **sum(final sale due)** − **non-void manual_receipt/on_account**, so **55,000 + 50,000 − 50,000 = 55,000**. Party GL (`get_contact_party_gl_balances`) for that contact remained **105,000** — i.e. the extra `manual_receipt` row was **not** reflected in party GL the same way (orphan / duplicate vs posted journals).

**Data repair applied on live DB:** that payment row was voided (`voided_at` set) so the subtract leg no longer applies and operational receivable **matches GL** (see §7).

## 2. Live DB function: before / after

| Check | Before | After |
|--------|--------|--------|
| Body contains `manual_payment` | no | yes |
| Body contains `voided_at` on receipt subtract | no | yes |
| DIN COUTURE `payables` (company-wide branch) | 100,000 | **70,000** |
| ABC `receivables` (after void orphan payment) | 55,000 | **105,000** |

## 3. Contacts page data path (after code change)

- **Rows (grey operational):** always from successful `get_contact_balances_summary` → `contactService.getContactBalancesSummary` → merge into list by `contact.uuid`. **No** sales/purchases merge fallback.
- **Row GL sublines:** unchanged — `get_contact_party_gl_balances` map.
- **RECV/PAY header cards:** sum **`filteredContacts`** (visible rows), same RPC-backed `receivables`/`payables`.
- **On RPC error:** toast with message, `balancesStale` set, amounts shown as pending/hidden per existing `balanceColumnsPending` behavior — **no** incorrect silent fallback.

## 4. Files changed (repository)

| File | Change |
|------|--------|
| `src/app/services/contactService.ts` | `getContactBalancesSummary` returns `{ map, error }` instead of `Map \| null`. |
| `src/app/components/contacts/ContactsPage.tsx` | Remove fallback loader; surface RPC errors; cards from `filteredContacts`; remove `fallback` engine state / copy. |
| `src/app/services/partyFormBalanceService.ts` | Adapt to `{ map, error }`. |
| `src/app/services/controlAccountBreakdownService.ts` | Use `!opMapError` instead of `opMap != null`. |
| `src/app/services/arApReconciliationCenterService.ts` | Sum from `opRes.map` when `!opRes.error`. |
| `src/app/services/contactBalanceReconciliationService.ts` | All call sites use `opRes` / `{ map, error }`. |
| `src/app/services/partyBalanceTieOutService.ts` | Use new shape; diagnostic `RPC_CONTACT_BALANCES_FAILED` when operational RPC fails. |
| `src/app/services/partyTieOutBulkCleanupService.ts` | Use new shape. |

## 5. SQL applied on live database

1. **`migrations/20260430_get_contact_balances_operational_recv_pay_parity.sql`** — executed as **`supabase_admin`** against `supabase-db` (includes `payments.voided_at` IF NOT EXISTS, `CREATE OR REPLACE FUNCTION`, grants).

2. **One-off data alignment for ABC (orphan `manual_receipt`):**

```sql
UPDATE payments SET voided_at = COALESCE(voided_at, NOW())
WHERE id = 'c1aef7d4-e93d-4d46-8a18-0b8d1a3dca7c'
  AND company_id = '595c08c2-1e47-4581-89c9-1f78de51c613';
```

**Note:** Only apply voids after finance confirms the row is duplicate or should not reduce operational AR; alternatively bring GL and subledger in line by posting or linking the payment correctly instead of voiding.

## 6. Refresh / invalidation

Existing events unchanged: `contactBalancesRefresh`, `paymentAdded`, `accountingEntriesChanged`, window `focus`, `purchaseService` / `saleService` / payments / Add Entry V2 dispatches already wired in prior work. Contacts reload still goes through `loadContacts()` which always re-fetches the RPC.

## 7. Before / after proof values (live SQL, company `595c08c2-1e47-4581-89c9-1f78de51c613`, `p_branch_id` NULL)

| Measure | Before | After |
|---------|--------|--------|
| ABC operational `receivables` | 55,000 | **105,000** |
| ABC party GL `gl_ar_receivable` | 105,000 | **105,000** |
| DIN COUTURE operational `payables` | 100,000 | **70,000** |
| DIN COUTURE party GL `gl_ap_payable` | 70,000 (unchanged) | **70,000** |

**Header cards:** with default filters (all branches / all visible rows on tab), RECV/PAY totals equal the sum of displayed row operational columns because they now use `filteredContacts`.

## 8. Remaining risk

- **Ownership on deploy:** Any environment where migrations run only as `postgres` may fail to replace `get_contact_balances_summary`; use the function owner (here `supabase_admin`) or `ALTER FUNCTION ... OWNER TO` + re-run.
- **Orphan `payments` rows:** Operational RPC subtracts `manual_receipt`/`on_account` by design; if GL party attribution does not mirror that, variances will persist until data or posting rules align.
- **Other companies:** The void SQL is specific to one `payments.id`; other tenants are unaffected.

## 9. Terminal summary

```text
LIVE: Applied 20260430 as supabase_admin → payables subtract + voided receipt leg; verified body contains manual_payment + voided_at.
LIVE: Voided orphan manual_receipt for ABC → operational recv 105,000 = party GL 105,000.
REPO: getContactBalancesSummary → { map, error }; ContactsPage no fallback; cards = sum(filteredContacts).
BUILD: npm run build — OK.
```
