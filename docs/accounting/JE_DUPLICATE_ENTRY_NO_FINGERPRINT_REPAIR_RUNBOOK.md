# Journal duplicate repair — `entry_no`, fingerprints, and primary payment JEs

## Context (e.g. JE-0039 / JE-0040, company `595c08c2-1e47-4581-89c9-1f78de51c613`)

When **two or more active** `journal_entries` rows share the same **`entry_no`** (case-insensitive) or the same **`action_fingerprint`**, or when **one `payment_id`** has multiple **primary** journals (excluding `reference_type = payment_adjustment`), the GL and UI can:

- Throw or behave unpredictably on **`.maybeSingle()`** lookups (PostgREST “multiple rows”).
- Open the **wrong** voucher when searching by `JE-00xx`.
- **Double-count** AP/AR or cash effects until extras are voided.

This runbook describes **detection**, **in-app auto-repair** (void duplicates, keep oldest), **SQL verification**, and the **app fix** that picks a canonical row when duplicates still exist.

---

## 1. App changes (code)

| Area | Change |
|------|--------|
| `accountingService.getEntryByReference` | Replaced fragile `.maybeSingle()` on `entry_no` / `payment_id` / partial `entry_no` with **limited queries + deterministic pick**: non-void first, then **oldest** `created_at` (same rule as repair). Sale-invoice path uses **newest** non-void. Payment path excludes `payment_adjustment` rows when resolving by `payment_id`. |
| `postingDuplicateRepairService` | New scans: **duplicate `entry_no`**, **duplicate `action_fingerprint`**, plus existing **duplicate primary per payment**. New **`previewAllJournalPostingDuplicates`**. **`runFullPostingRepair`** can void all three categories (batched `is_void = true`). |
| Developer Integrity Lab → Fix tab | **Preview** shows all three scans; **Repair** voids all three groups then runs **`syncPaymentAccountAdjustmentsForCompany`**. |
| Migration **`20260436_party_gl_rpc_effective_payment_id.sql`** | AR/AP party GL RPCs return **`payment_id`** = `COALESCE(journal_entries.payment_id, reference_id::uuid)` when `reference_type = payment_adjustment`, so **`payments.payment_account_id`** resolves to **Cash G140** (etc.) on PF-14 lines (JE-0039 / JE-0040), not only on the primary voucher (JE-0032). |
| Account Statements (supplier/customer GL) | **Payment account** column + **Reference** subtitle **Cash/bank voucher: JE-00xx** links PF-14 rows to the **oldest primary** JE for the same payment (excludes `payment_adjustment`). |

---

## 2. In-app repair (recommended path)

1. Sign in as a user who can open **Developer Tools → Developer Integrity Lab** (or your routed path to that page).
2. Open the **Fix** tab.
3. Click **Preview duplicates** — JSON shows `primary`, `entryNo`, `fingerprint` sections with counts and groups.
4. If counts &gt; 0, click **Void duplicates + sync accounts** (same button label as before; behavior now includes entry_no + fingerprint).

**Rule:** For each duplicate group, the row with the **earliest** `created_at` (tie-break `id`) is **kept**; all other rows in that group are set to **`is_void = true`**. No hard deletes.

---

## 3. SQL analysis (read-only)

Run `scripts/analyze_journal_duplicates_by_company.sql` after substituting your `company_id` (file currently uses `595c08c2-1e47-4581-89c9-1f78de51c613` as an example). Sections **A–C** list duplicate groups; section **D** is a commented template to drill into specific `entry_no` values.

Also use existing `scripts/detect_duplicate_payment_posting.sql` for PF-14–specific payment adjustment chains.

---

## 4. When auto-repair is **not** enough

- **Wrong economic substance** (e.g. posted to wrong accounts but not a duplicate row): void + repost via normal flows; do not rely on duplicate repair alone.
- **Orphan** adjustment JEs: classify with Truth Lab / `verify-payment-mutation-chain.sql` before voiding.
- **Large companies**: The in-app scan pages through `journal_entries` in batches (800 rows per request). Very large tenants may take tens of seconds; SQL aggregates in the script are often faster for a quick audit.

---

## 5. Verification after repair

1. Re-run **Preview duplicates** — all three counts should be **0** (or only expected legacy noise you accept).
2. Re-run SQL script sections **A–C**.
3. Open **Account Statements** / **Truth Lab** for affected suppliers/customers and confirm balances match expectations.
4. Search **JE-0039** / **JE-0040** (or your problem refs) in the Integrity Lab **Trace** tab — should resolve to a **single** active journal.

---

## 6. Optional hardening (DB)

Consider a **partial unique index** on `(company_id, lower(trim(entry_no)))` for **non-void** rows only, after data is clean — prevents recurrence. This is **not** applied automatically in this repo; discuss with your DBA/migration process.
