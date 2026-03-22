# Balance source policy — hard cutover

**Effective:** Canonical cutover pass. **Enforcement:** `src/app/services/accountingCanonicalGuard.ts` + this document.

---

## 1. GL balance (financial truth)

- **Source:** `journal_entries` + `journal_entry_lines` only (joined to `accounts` for codes/names).
- **Derivation:** Sum debits/credits per account, per party resolution rules where applicable (`get_contact_party_gl_balances`, Trial Balance, account ledger).
- **Forbidden as GL:** `accounts.balance`, `accounts.current_balance`, `contacts.current_balance`, `workers.current_balance`, `ledger_entries`, `chart_accounts`, any `backup_*` table.

---

## 2. Operational due (open items)

- **Source:** Document math — `sales`/`purchases`/`rentals` due fields, contact openings as defined in `get_contact_balances_summary`, studio `worker_ledger_entries` where that RPC specifies.
- **Use:** Collections, **Add Entry secondary line**, Contacts “operational” totals, DSO-style views.
- **Never:** Present as “GL” or “Trial Balance” without a second line showing GL.

---

## 3. Worker pending / payable (operations)

- **Studio / unpaid jobs:** `worker_ledger_entries` + stage workflow (operational).
- **GL:** Worker-related postings on `journal_entry_lines` (Worker Payable 2010, Advance 1180, etc.).
- **Rule:** Operational worker due **≠** worker GL slice unless reconciliation proves alignment.

---

## 4. Stored balance fields (cache only)

| Field | Meaning |
|-------|---------|
| `contacts.current_balance` | Cache / UX; may lag |
| `workers.current_balance` | Cache; studio also updates for display |
| `accounts.balance` / `current_balance` on `accounts` | Cache; optional sync from journals |

**Policy:** May be **shown** only with label **“Cached”** or **“Non-GL”**, or in admin diagnostics. **Never** the sole number for “true balance” on a canonical accounting screen.

---

## 5. UI labeling (no silent mix)

- Any screen showing **both** operational and GL must label both.
- **Add Entry:** Primary due = GL RPC when available; secondary = operational; fallback to contact cache must say so.
- **Contacts:** Variance strip already explains operational vs GL; list columns = operational unless explicitly labeled.

---

*This policy overrides ad hoc docs that suggest dual truth without labels.*
