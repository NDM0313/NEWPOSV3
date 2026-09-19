# Party advances / JE attribution — Single Core (2026-09-19)

Companion to [`reports/supplier-coa-dual-audit-20260919/AUDIT_REPORT.md`](../../reports/supplier-coa-dual-audit-20260919/AUDIT_REPORT.md).

## Intent

Owner could not conveniently post General Journal to a supplier; workarounds used separate named CoA leaves. Advances (worker), courier deposits, and supplier adjustments are **valid**. A unified party view does **not** require every posting to share one GL account — it requires **reliable party attribution** per line.

## Posting paths (reuse; do not fork)

| Role | Control / leaves | Advance / deposit | Charge | Cash settlement |
|---|---|---|---|---|
| Supplier | **2000** → `AP-SUP*` (legacy **2090/`210xxx`** still exists) | GE / opening Dr party leaf | Purchase Cr AP | Payment screen Dr AP via `resolvePayablePostingAccountId` |
| Worker | **2010** payable + **1180** advance | Worker payment / GE → 1180 | Stage bill Cr 2010; `worker_advance_settlement` Dr 2010 Cr 1180 | Worker payment screen |
| Courier | **203x** courier leaf and/or AP under 2000 | Deposit on courier/AP leaf | Parcel / shipment | Courier payment screen |
| Customer | **1100** → `AR-*` | Receipt / GE | Sale | Customer receipt |

## Attribution (no name inference)

1. Prefer `accounts.linked_contact_id` on the journal line’s account.
2. Verified remap table `journal_account_verified_remaps` for **unlinked retired** leaves (e.g. IBRAHIM `210026`) — seeded from Sept16 `merge_pairs`, not from names.
3. Two-leg General JE with **two** party-linked accounts = **two parties** — each line attributed separately. **Do not** apply JE-level `_gl_resolve_party_id_for_journal_entry` to all lines of a multi-party JE in the attributed view.
4. Do **not** infer party from description text.

## Server-side posting protection

Migration `20260919140000_journal_posting_account_guard_and_verified_remaps.sql`:

- BEFORE INSERT / UPDATE OF `account_id`, `journal_entry_id` on `journal_entry_lines`
- Early-return only when **both** `account_id` and `journal_entry_id` unchanged
- Missing / wrong-company / retired → actionable exception, or verified remap
- Public `resolve_journal_posting_account_id` / `repair_restore_*` are **SECURITY INVOKER** (real `current_user` / SET ROLE); private DEFINER helpers hold table work
- Inactive restore only via exact-line `_journal_account_repair_tickets` inserted by privileged repair — **custom GUCs never grant privilege**
- Remap events store `journal_entry_line_id` on INSERT when id is available
- Account / JE `company_id` reassignment blocked when lines exist
- Seed: backup identity via `contact_id`; AP-* role check; conflicting maps **FAIL**
- **AUTOMATIC scope:** `journal_account_verified_remaps`. **HISTORICAL:** IBRAHIM repair package only. **ID LACE: NOT IMPLEMENTED**

**Production install status:** NOT installed (read-only check). Isolated Docker verification: `reports/supplier-coa-dual-audit-20260919/verification/EVIDENCE.md`.

Client guards in `journalPartyPosting.ts` + `createPureJournalEntry` mirror remaps when the table is readable.

## General Entry UX

- Party assist lists **all** linked active leaves with role/control labels (AP / AR / worker advance / worker payable / courier / legacy).
- When more than one account is valid, **explicit selection is required** (no silent AP-only pick for workers/couriers).
- Account pickers keep `preferCanonicalPartySubledgers={false}` so intentional duals remain choosable.
- Do **not** auto-change contact types or move balances to worker/courier controls.

## Party ledger vs GL components

- Official supplier AP statement / RPC: **2000 subtree only** (unchanged control totals).
- Account Statements (supplier/worker): **Party-attributed GL components** panel via `loadPartyAttributedGlLedger` — shows AP, legacy 210xxx, worker 2010/1180, courier 203x separately; optional table append of non-official components without changing Closing.
- **GL balance ≠ open documents:** advance/deposit debit can coexist with unpaid purchases/work/shipments.

## Limited repair (not applied this phase)

See [`reports/supplier-coa-dual-audit-20260919/repair-package/`](../../reports/supplier-coa-dual-audit-20260919/repair-package/) — **IBRAHIM 2 lines IMPLEMENTED**; **ID LACE NOT IMPLEMENTED**. DHL / KIRAN / SHAHMIM hold; DHL PK separate.

## Out of scope this phase

- Production remap apply / deploy  
- Auto contact-type change to worker/courier  
- Merging DHL with DHL PK  
- Phase-3 FX / new money engines
