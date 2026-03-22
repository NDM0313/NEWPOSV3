# Party ledger unification plan

**Problem:** Multiple screens use the word **“ledger”** while calling **different engines** (sales/rentals dues vs `ledger_entries` vs journal lines).

**Target:** Exactly three **named** experiences — no ambiguous “ledger”.

---

## 1. Party Operational Statement

**Engine:** `sales`, `purchases`, `rentals`, `worker_ledger_entries`, `contacts` openings — same family as `get_contact_balances_summary`.

**Surviving UI:**  
- **LedgerHub** customer tab **renamed in UI** to **“Customer — Open items (operational)”** (or subheading under existing nav).  
- Supplier **operational** view: purchases due rollup (if not already a dedicated report).

**Replace:** Any customer “ledger” that **only** shows journal lines **without** saying GL — either switch label to GL (see #2) or keep as operational.

---

## 2. Party GL Statement

**Engine:** `journal_entry_lines` filtered by party resolution (AR/AP/worker accounts + JE refs), same basis as `get_contact_party_gl_balances` / account ledger / customer GL journal view.

**Surviving UI:**  
- **Account ledger** / **GL account detail** (existing `AccountLedgerPage`, `AccountLedgerView`).  
- Future: **“Customer — GL (AR)”** page = journal-based AR lines for one contact (thin wrapper over existing `accountingService` customer ledger if journal-only).

**Replace:** Do **not** call **GenericLedgerView** “Customer Ledger” if it mixes sales tables with journals without tabs — split or label.

---

## 3. Reconciliation View

**Engine:** `getCompanyReconciliationSnapshot`, Reconciliation Center, Contacts variance strip — operational totals vs GL control accounts.

**Surviving UI:**  
- **ArApReconciliationCenterPage**  
- **Contacts** variance / recon blocks  

**Rule:** This is the **only** place that should show **both** numbers **without** pretending they are one.

---

## Current pages — disposition

| Page / component | Current engine | Action |
|-------------------|----------------|--------|
| `LedgerHub` + `CustomerLedgerPageOriginal` | `customerLedgerAPI` (sales/rentals) + mixed | **Relabel** → Operational statement; add link to GL view |
| `LedgerHub` + `GenericLedgerView` (supplier/user) | `ledger_master` / `ledger_entries` | **Relabel** → “Supplier subledger (non-GL)” |
| `LedgerHub` worker | Worker + `worker_ledger_entries` | **Relabel** → “Worker — Studio ledger (operational)” |
| `AccountLedgerPage` | Journal | **Keep** name **“GL account ledger”** or **“Account ledger (journal)”** |
| `CustomerLedgerTestPage` | Test harness | Keep as **test**; not production canonical |

---

## Naming rule

- **Ban:** Two top-level nav items both titled **“Ledger”** with different engines.
- **Require:** Subtitle or badge: **Operational** | **GL (journal)** | **Reconciliation**.

---

*Implementation: incremental relabels + navigation copy; deep refactor of `customerLedgerAPI` optional phase 2.*
