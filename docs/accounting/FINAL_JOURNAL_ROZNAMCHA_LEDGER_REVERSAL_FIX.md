# Final fix: Journal by-document, Roznamcha, ledger/reversal alignment

**Date:** 2026-04-06  
**Scope:** Evidence-driven fixes for stale or misleading **Journal Entries (grouped / by-document)**, **Roznamcha**, and consistency with payment lifecycle (edit deltas, voided receipts, `correction_reversal`).  
**Constraint respected:** No changes to `get_contact_balances_summary` (no SQL evidence of regression).

## Executive summary

| Area | Root cause | Fix |
|------|------------|-----|
| Journal — by document | `manual_receipt` was not mapped to `Payment` in `convertFromJournalEntry`, so grouped rows used **Accounting** module logic (primary amount only). `manual_receipt` (JE-0045) and `payment_adjustment` (JE-0046) grouped under **different** keys (`manual_receipt:<contactId>` vs `payment_adjustment:<paymentId>`), so the UI showed **5,000** + **45,000** instead of one **50,000** payment story. | Map `manual_receipt` and `on_account` to `Payment`; group all rows that share a **`payment_id`** or a **`payment_adjustment.reference_id`** under `payment:<uuid>`; prefer `manual_receipt` as primary when present. |
| Journal — reversal pairs | Original JE and `correction_reversal` were separate grouped rows; by-document amounts did not **net** to zero for a full reversal. | Build `jePair:<reversed_journal_id>` for targets of `correction_reversal` and for the reversal row itself; `groupedDocumentDisplayAmount` nets **original + reversal** (subtract `correction_reversal` line amount). |
| Roznamcha | `payments` query did not filter **`voided_at`**. Live case: **PAY-0016** (Rs 40,000) remains in DB with `voided_at` set after reversal — Roznamcha still showed it as cash-in. | **Option 1 (chosen):** Default Roznamcha excludes `voided_at IS NOT NULL`. Toggle **“Include voided payments (audit)”** shows them with **`(voided)`** in Details; opening balance uses the same rule. |

**Customer / supplier “Canonical” simple ledger:** Not added in this pass — the failures traced here were read-model grouping and Roznamcha source filters, not missing a fourth ledger UI.

**ABC / GL “pollution”:** Rejected as a data bug for JE-0048/49. GL is **journal truth**: manual `FROM CONTACT` posting plus `correction_reversal` is correct. Operational views that rely on **live** payments already exclude voided receipts; GL includes reversed **journal** history by design. Reconciliation should treat manual AR journals as first-class, not as sync errors.

---

## Live company and IDs traced (VPS)

**Company:** `595c08c2-1e47-4581-89c9-1f78de51c613`

### CASE 1 — SALAR (receipt 5,000 → 50,000)

| Object | Id / ref | Notes |
|--------|-----------|--------|
| Payment | `4eb2a723-e056-4497-9920-2f3ff6e44638` | **PAY-0015**, amount **50,000**, not voided |
| JE-0045 | `manual_receipt`, `payment_id` = above | Lines still **5,000** (original posting; delta is separate JE) |
| JE-0046 | `payment_adjustment`, `reference_id` = payment uuid | **45,000** delta |

**Expected by-document amount:** 50,000 (5,000 + 45,000).  
**Before fix:** Two groups or wrong module → misleading **5,000** on the receipt row.  
**After fix:** Single `payment:4eb2a723-…` group, **Payments** module sum = **50,000**.

### CASE 2 — ABC (manual FROM CONTACT + reversal)

| Object | Id / ref | Notes |
|--------|-----------|--------|
| JE-0048 | id `b4620824-0eb8-47a6-a8c3-1e5faae36d01` | `manual_receipt`, payment **PAY-0016** (later voided) |
| JE-0049 | `correction_reversal`, `reference_id` = **JE-0048 id** | Reversal of FROM CONTACT |
| PAY-0016 | voided | `voided_at` set (seen in prior trace) |

**Journal by-document:** One `jePair:b4620824-…` row, net amount **0** when both JEs are in range.  
**Audit mode:** Still lists each raw JE (unchanged).

### CASE 3 — Roznamcha after void

**PAY-0016** with `voided_at` must **not** appear in default Roznamcha; toggle restores it for audit.

---

## SQL used (run on VPS)

```sql
-- Salar: receipt + adjustment + payment
SELECT je.entry_no, je.reference_type, je.payment_id, je.reference_id, je.description,
  (SELECT SUM(jel.debit)::numeric FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id) AS sum_dr
FROM journal_entries je
WHERE je.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
  AND je.entry_no IN ('JE-0045','JE-0046')
ORDER BY je.entry_no;

SELECT id, reference_number, amount, voided_at FROM payments
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
  AND reference_number = 'PAY-0015';

-- ABC: pair + UUID alignment
SELECT je.entry_no, je.reference_type, je.payment_id, je.reference_id
FROM journal_entries je
WHERE je.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
  AND je.entry_no IN ('JE-0048','JE-0049');

SELECT id, entry_no FROM journal_entries
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
AND entry_no IN ('JE-0048','JE-0049');
```

```bash
ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres"
```

---

## Suspected bug classes — prove / reject

| ID | Hypothesis | Verdict |
|----|------------|---------|
| A | `groupedDocumentDisplayAmount` groups wrong JE types | **Partially true:** logic was fine for **Payments**; **manual_receipt** was not classified as Payments, and keys did not align. Fixed by source map + `payment:` / `jePair:` keys. |
| B | Audit correct, by-document wrong | **True** before fix (grouping + module). Audit **unchanged**. |
| C | Roznamcha query ignores reversal rows | **Reject** for journal reversals — Roznamcha is **payments-only**. |
| D | Roznamcha includes voided originals without netting | **True** — voided payments were included. Fixed with `voided_at` filter + audit toggle. |
| E | Customer GL includes manual AR lines | **True by design** — GL is full journal. Not a defect; classify in UI copy/recon rules if needed later. |
| F | FROM CONTACT / reversal tagging inconsistent | **Reject** for ABC pair — `reference_id` on JE-0049 correctly points at JE-0048’s **id**. |
| G | Payment edit delta JEs correct in lines, wrong in row summary | **True** — summary came from **grouped primary** / wrong group. Fixed. |
| H | Invalidation does not refresh Roznamcha | **Reject** as primary cause — data was already voided in DB; the bug was **no void filter**. |
| I | Manual journals mixed into customer GL without labels | **Operational** — existing services already mark `correction_reversal`; manual lines use descriptions. Further labeling is product polish, not blocking. |

---

## Screen-by-screen source map (read path)

| Screen | Primary source | Notes |
|--------|----------------|--------|
| A. Journal — by document | `AccountingContext.loadEntries` → `convertFromJournalEntry` → `AccountingDashboard` `groupedJournalRows` + `groupedDocumentDisplayAmount` | Grouping keys: `payment:*`, `jePair:*`, else root ref / `single:*`. |
| B. Journal — audit | Same `filteredTransactions`, flat sort | No grouping. |
| C. Roznamcha | `roznamchaService.getRoznamcha` → `payments` | Default: `voided_at IS NULL`. |
| D–F. Customer ledger / GL / recon | `accountingService.getCustomerLedger`, RPC `get_customer_ar_gl_ledger_for_contact`, recon services | Unchanged this pass; align expectations per table above. |
| G–H. Statements / AR-AP center | Existing ledger + contact RPCs | No change. |

---

## Roznamcha product decision

**Option 1 implemented:** Default view **hides voided payments** (reversed receipts void the payment row). **“Include voided payments (audit)”** shows them and tags Details with **`(voided)`**. Opening balance follows the same toggle.

---

## Files changed

- `src/app/context/AccountingContext.tsx` — `sourceMap`: `manual_receipt`, `on_account` → `Payment`.
- `src/app/components/accounting/AccountingDashboard.tsx` — `journalDocumentGroupKey`, `groupedDocumentDisplayAmount` (`jePair` net), grouped primary order, `journalRowPresentation` for `manual_receipt` / `payment_adjustment`.
- `src/app/services/roznamchaService.ts` — `voided_at` in select; filter + optional include; `getOpeningBalance` parity.
- `src/app/components/reports/RoznamchaReport.tsx` — audit toggle UI + pass-through to `getRoznamcha`.

---

## Build

`npm run build` — **passed** (Vite: ✓ built in ~44s, PWA generated).

---

## Before / after (behavioral)

| Case | Before | After |
|------|--------|--------|
| SALAR PAY-0015 grouped amount | Often **5,000** on receipt row or split narrative | **50,000** one row (`manual_receipt` + `payment_adjustment`) |
| ABC reversal in grouped journal | Two rows, non-obvious net | One **jePair** row, **net 0** (full reversal) |
| Roznamcha after void | Voided **PAY-0016** still counted | Excluded unless audit toggle on |
