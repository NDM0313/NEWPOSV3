# Transaction cancel / remove guide

ERP **never hard-deletes** money rows. "Delete" means **soft void** (`journal_entries.is_void = true`): the row stays for audit but disappears from Cash, Trial Balance, and normal Day Book.

## By transaction type

| Type | Example | Where to act | Button / action |
|------|---------|--------------|-----------------|
| Payment receipt | RCV-* | Transaction detail on active payment | **Cancel Payment** |
| Manual journal | Manual JE | Transaction detail / Journal list | **Cancel Entry** |
| Sale / Purchase / Rental invoice | SL-*, PUR-* | Sales / Purchases / Rentals module | Cancel document there — not from Journal |
| **Stale correction reversal** | JE-0168 class | AR/AP → **Journal hygiene** or Transaction detail | **Remove from live GL** (Admin/Owner) |
| GL correction repair | JV-* | Hybrid Repair / Developer Center | Repair workflow — not ad-hoc delete |

## Stale payment reversals (JE-0168 class)

When a payment is **cancelled**, the system voids the original receipt JE but may leave an active **`correction_reversal`** row. That reversal still counts on **Official Posted GL** (Cash, Trial Balance).

**Symptoms:** Rs 1 (or any amount) on Cash after you already cancelled the receipt; Day Book may show reversal in Audit mode.

**Self-service fix (Admin / Owner / Developer):**

1. **Accounting → AR/AP Reconciliation Center → Journal hygiene**
2. Section **Stale payment reversals**
3. Click **Remove from live GL** → confirm

Or open the reversal from **Day Book** → transaction detail → **Remove from live GL**.

Requirements:

- Source payment already voided, **or** source journal already voided
- Reversal still active (`correction_reversal`, not void)
- Not a developer `gl_correction` repair fingerprint

After void: hard refresh browser. Audit mode can still show the voided trail.

## Journal hygiene — voided history card

The **Voided history (info)** stat on Journal hygiene is **not** a fix queue. It counts journals already soft-voided (`is_void = true`). Expand **Voided history (audit)** at the bottom of the tab to browse those rows — the table loads **all voided entries** (up to 500 per page, with **Load more** if needed) and supports horizontal scroll for full void reason / description text. Click a row to open transaction detail (read-only audit). Actionable items are only **Duplicates**, **Stale reversals**, and **Orphans**.

**Duplicates** scan active `sale_adjustment` and `payment_adjustment` JEs only (PF-14.5B). **Stale reversals** lists active `correction_reversal` rows whose payment or source JE is already void. The **Active correction reversals (review)** subsection under Stale reversals shows every live reversal with eligibility (why it is or is not removable).

## Ledger navigation (where to look)

| Need | Where |
|------|--------|
| Quick effective party balance (collapsed mutations) | Sidebar **Party Ledger** |
| Full GL statement + PDF / share | Accounting → **Account Statements** (Standard view) |
| Effective / audit filters, control 1100 rollup | Same tab → **Advanced (effective / audit)** |
| Single-account JE lines from chart | Accounts row ⋮ → **View Ledger** |

Legacy **Reports → Ledger Center V2** and Accounting **Ledger** dropdown were removed; deep links to `/reports/ledger-statement-center-v2` open Accounting → Account Statements.

## If the button is missing or disabled

- **Not Admin/Owner** — read-only list in Journal hygiene
- **Payment still active** — use **Cancel Payment** first, then remove stale reversal if it remains
- **Sale / purchase document JE** — cancel from the business module
- **Developer repair JV** — use Hybrid Repair / Developer Center

## Hard delete

Not supported in production. Use void only.

See also: [`remaining-tasks-2026-06-12.md`](remaining-tasks-2026-06-12.md)
