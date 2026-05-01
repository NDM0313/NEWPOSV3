---
name: Fix duplicate payment journals (revised)
overview: |
  Remove duplicate GL postings by making `record_customer_payment` match the web path: a single
  `INSERT INTO payments` so the existing AFTER INSERT trigger owns journal creation and description
  behavior. No trigger bypass. Remove manual `INSERT INTO journal_entries` from the RPC. Preserve
  customer AR sub-ledger by applying the same post-posting adjustment the web uses (sub-ledger
  patch on the trigger-created JE), implemented in SQL inside the RPC or in the trigger so mobile
  does not depend on the React `patchPaymentJeToSubLedger` call.
todos:
  - id: align-rpc-with-web-insert
    content: "Refactor record_customer_payment to only insert payments row (same fields/constraints as web saleService.recordPayment) and update sale totals; remove all manual journal INSERTs"
    status: completed
  - id: ar-subledger-post-trigger
    content: "After payment insert, apply AR sub-ledger (equivalent to _ensure_ar_subaccount_for_contact + web patchPaymentJeToSubLedger) on the trigger-created JE—prefer SQL mirroring saleAccountingService.patchPaymentJeToSubLedger or extend create_payment_journal_entry if one shared behavior is cleaner"
    status: completed
  - id: verify-single-je
    content: "Verify one journal_entries row per payment_id; mobile receive + web receive both single JE; regression on allocate/reference collision paths"
    status: completed
isProject: false
---

# Fix duplicate payment journals (revised — shared trigger path)

## Goal

- **Web** already works: `payments` INSERT → **AFTER INSERT** trigger → auto journal + numbering/description behavior.
- **Mobile** must use the **exact same** mechanism: **no** skipping the trigger; **no** duplicate manual JE inside [`record_customer_payment`](migrations/20260457_record_customer_payment_last_resort_reference.sql).

## Correct root cause

[`record_customer_payment`](migrations/20260457_record_customer_payment_last_resort_reference.sql) currently:

1. Inserts into `payments` (fires trigger → **first** JE).
2. Inserts journal lines again (**second** JE) → duplicate economic posting.

The wrong fix was **suppressing the trigger**. The right fix is **removing the redundant manual journal posting from the RPC** so only the trigger-created JE exists.

## Required behavior after change

### Single posting path

1. **`record_customer_payment`** should:
   - Perform validation (sale, company, amount, account active, customer match, etc.).
   - **`INSERT INTO payments`** with the same semantic shape the web uses (`payment_type`, `reference_type`, `reference_id`, `payment_account_id`, `payment_method`, dates, `reference_number` resolution / retries as needed).
   - **`UPDATE sales`** paid/due/payment_status (keep parity with current RPC or with [`saleService.recordPayment`](src/app/services/saleService.ts)).
   - **Do not** `INSERT INTO journal_entries` / `journal_entry_lines`.

2. **Trigger** (same as web): [`auto_create_payment_journal_entry`](FIX_ACCOUNTING_SYSTEM_COMPLETE.sql) / [`create_payment_journal_entry`](migrations/fix_payment_journal_ar_account_code.sql) — unchanged responsibility for voucher text and lines unless you consolidate intentionally.

### AR sub-ledger parity (`_ensure_ar_subaccount_for_contact`)

Today the RPC credits the customer AR child directly; the trigger historically credits parent **1100**, then the **web** runs [`patchPaymentJeToSubLedger`](src/app/services/saleAccountingService.ts) after insert.

For mobile there is no React client, so after removing manual JE from the RPC you **must** keep sub-ledger correct by one of:

- **Option A (recommended for “same path”)**: After `payments` insert completes inside `record_customer_payment`, run a **small SQL block** that mirrors `patchPaymentJeToSubLedger`: find `journal_entries.id` by `payment_id = NEW.id`, resolve customer sub-account via existing **`_ensure_ar_subaccount_for_contact`**, replace **parent AR line** credit account with sub-ledger account id (same logic as TS).

- **Option B**: Enhance **`create_payment_journal_entry`** (used only by the trigger) to credit **`_ensure_ar_subaccount_for_contact(...)`** instead of generic 1100 when `reference_type = 'sale'`. Then web’s client-side patch may become redundant or must stay **idempotent** (patch no-op if already sub-ledger).

Pick **one** place to avoid double-patching.

### Optional hardening (not the primary fix)

- Broaden [`ensureSalePaymentJournalIfMissing`](src/app/services/saleAccountingService.ts) detection so client-side “missing JE” logic cannot fire when `payment_id` linkage differs — defensive once RPC stops inserting second JE.

## Explicit non-goals

- **Do not** use `set_config` / session flags to skip the trigger.
- **Do not** fork description/reference logic in the RPC for journal text — let the trigger **own** posting wording unless product asks to change **`create_payment_journal_entry`** for everyone.

## Verification

- One payment → exactly **one** active `journal_entries` row with **`payment_id`** set (trigger path in [`create_payment_journal_entry`](migrations/fix_payment_journal_ar_account_code.sql) already sets `payment_id`).
- GL / Accounting Dashboard / mobile ledger: **no** paired duplicates for the same payment.
- Sale payment history unchanged (still one `payments` row).

## Migration / files

| Deliverable | Notes |
|-------------|--------|
| New migration replacing `record_customer_payment` | Strip manual JE; keep payment retry loop if needed for `reference_number`; add post-trigger AR patch block **or** coordinated change to `create_payment_journal_entry` |
| Optional TS tweak | Idempotent `patchPaymentJeToSubLedger` / `ensureSalePaymentJournalIfMissing` if Option B changes trigger |
