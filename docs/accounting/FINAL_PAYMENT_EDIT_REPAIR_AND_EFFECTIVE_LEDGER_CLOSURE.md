# FINAL: Payment edit repair, effective ledger, and closure

This document closes the **payment edit / PF-14 duplicate / presentation** initiative from a **product and code** perspective. **Live tenant evidence** (exact JE UUIDs, before/after account nets for Ali/Salar) must be pasted here after you run SQL on your database — those values are not generated inside the git repo.

## What was fixed or added in code (root cause + UX)

| Area | Change | Why |
| --- | --- | --- |
| `unifiedTransactionEdit.ts` | Explicit `payment_adjustment` → `payment_editor` with `sourceId` = payment UUID | PF-14 adjustment vouchers must not route to document editors. |
| `TransactionDetailModal.tsx` | Resolve payment id from `payment_adjustment.reference_id`; derive dialog **context** from loaded `payments.reference_type` (sale/purchase/manual/…); **entityId** from payment `contact_id` only (not sale id) | Prevents opening the wrong editor and wrong party context. |
| `SalesContext.tsx` | **Normalized UUID** compare for `payment_account_id` vs resolved default account | Avoids a spurious second `updatePayment` when IDs differ only by formatting. |
| `truthLabTraceWorkbenchService.ts` | `buildPaymentRepairAssessment` — classification + repair bullets | Single “what to do next” signal (repair GL vs effective UI). |
| `ArApTruthLabPage.tsx` | Repair panel, net-by-account table, `journal_entries` + `journal_entry_lines` tables, `payment_allocations`, confirmed-bad JE list (`localStorage`) | Full trace + runbook without hiding GL rows. |
| `ContactsPage.tsx` | Balance notes: operational vs party GL are **not duplicates**; Truth Lab + repair, not hiding | Reduces misleading mixed readings. |
| `scripts/repair_confirmed_bad_payment_edit_chains.sql` | Dry-run + commented void template | Controlled repair only for confirmed UUIDs. |

**Effective vs audit (no fake hiding):** Account statement, Day Book, and related UIs already support **audit** (all vouchers) vs **effective** (PF-14 transfer/delta **dimmed**, not removed). Roznamcha remains **payments-row** based; Day Book shows PF-14 lines with a **Presentation** column — see `docs/accounting/HOTFIX_PAYMENT_EDIT_ORDERING_AND_ACCOUNT_STATEMENT_PRESENTATION.md`.

## Classification buckets (for each suspicious line)

Use this when reviewing Cash / CASH G140 / NDM / Mobile Wallet / AR / AP / party subs:

| Bucket | Meaning | Action |
| --- | --- | --- |
| A | Valid PF-14 transfer or amount-delta | Keep; show as PF-14 in effective mode. |
| B | Presentation noise | Keep in GL; use effective/dimmed view — do not delete. |
| C | Historical bad JE | Void/reverse/corrective JE per `repair_confirmed_bad_payment_edit_chains.sql`. |
| D | Current duplicate-fire | Stop source (trace `[PAYMENT_EDIT_TRACE]`); void duplicate if already posted. |
| E | Orphan / unmapped | Truth Lab **Exception queue** / dismiss flag for diagnostics only — **do not** silently unlink from COA. |

## Live cases — evidence to paste from your DB

### Salar

| Field | Value (fill from SQL / Truth Lab) |
| --- | --- |
| `payments.id` | |
| Primary receipt JE | |
| Amount-delta JEs | |
| Account-transfer JEs | |
| Expected final nets (old liq / new liq / AR) | |
| Actual nets | |
| Extra wrong JE id(s) | |
| Bucket (C vs D vs B) | |

### Ali

| Field | Value |
| --- | --- |
| `payments.id` (35k→40k receipt, etc.) | |
| Primary + adjustment JEs | |
| Expected vs actual nets | |
| Extra wrong JE id(s) | |

### Cash / G140 / NDM / Mobile Wallet residues

| Account code | JE ids involved | Classification | Repair action |

## Confirmed bad JE ids (production)

### 2026-04-10 — VPS `supabase-db` (company `595c08c2-1e47-4581-89c9-1f78de51c613`)

**Payment `eab66f1f-2899-4803-b3da-988fa3d64576` (last edited manual receipt, RCV-0004 / Ali chain, final amount Rs 45,000 on NDM)**

| Action | JE id | entry_no | Note |
| --- | --- | --- | --- |
| **Voided** | `1a3f4bee-4805-4624-a527-18b169e27584` | JE-0063 | Duplicate `payment_adjustment_account`: Cr **Mobile Wallet** / Dr **NDM** Rs 45,000 **after** JE-0062 already moved Rs 45,000 **Cash → NDM**. |
| **Posted** | `98e5b353-219c-446b-bf66-796d6cca47b4` | JE-0064 | Corrective **journal**: Dr **1020** Mobile Wallet Rs 5,000 / Cr **1000** Cash Rs 5,000 — clears residue from first amount-delta (35k→40k) posting on **Cash** instead of wallet (fingerprint without liquidity). |

After void + corrective: combined net on **1000 / 1020 / 1011** for this payment + repair JE = **Cash 0, Wallet 0, NDM +45,000**.

**Payment `447f4205-8578-4d0b-b04b-ab379d17146e` (Salar manual receipt Rs 27,000 on NDM)**

| Action | JE id | entry_no | Note |
| --- | --- | --- | --- |
| **Voided** | `9d88fff4-4184-46b6-a7ed-049fb86fff7f` | JE-0054 | Amount delta 2,700→27,000 posted on **NDM** instead of **CASH G140 (1002)** (wrong liquidity). |
| **Voided** | `e5831d96-668b-4799-bd75-feea7700d3d8` | JE-0055 | Transfer used **Cash** as source instead of **G140** after account change. |
| **Posted** | `557fb4e3-043a-4f18-9e9a-22cfeb63c768` | JE-0065 | Corrective **journal**: Dr **1002** 24,300 / Cr party AR 24,300; Dr **1011** 27,000 / Cr **1002** 27,000. |

After void + corrective: combined net **1000 = 0, 1002 = 0, 1011 = +27,000**, party AR + 1100 = **−27,000** total AR effect.

## Presentation-only rows (no GL change)

*(List JE/line ids that are valid PF-14 but confusing in audit view.)*

## Repaired UUIDs / SQL evidence

| Step | Script / action | Result |
| --- | --- | --- |
| Detect | `scripts/detect_duplicate_payment_posting.sql` | *(paste row counts)* |
| Verify payment | `scripts/verify-payment-mutation-chain.sql` | |
| Apply | `scripts/repair_confirmed_bad_payment_edit_chains.sql` (SECTION 3+) | *(paste transaction ids / voided JE ids)* |

## Contacts — ABC / Ali / Salar (before / after)

| Contact | Operational `get_contact_balances_summary` | Party GL `get_contact_party_gl_balances` | Delta | Notes |

Run (example pattern from prior docs):

```sql
SELECT name, receivables, payables FROM contacts c
JOIN LATERAL get_contact_balances_summary('YOUR_COMPANY_ID'::uuid, NULL::uuid) b ON b.contact_id = c.id
WHERE c.company_id = 'YOUR_COMPANY_ID'::uuid AND c.name IN ('ABC','Ali','Salar');
```

## Build result

Run:

```bash
npm run build
```

Record: **exit code 0** (local `npm run build`, Vite production build completed successfully).

## Success checklist

1. Ali/Salar chains classified with UUIDs above.  
2. Bad historical JEs repaired (void/reversal/corrective), not hidden from COA.  
3. Liquidity residues explained or cleared.  
4. Contacts: operational vs party GL understood; amber only when bases truly differ.  
5. Edit on payment-linked / PF-14 rows opens **payment** editor.  
6. Effective mode clarifies one economic payment; audit keeps all rows.  
7. Truth Lab shows full chain + repair assessment.  

---

**Related:** `docs/accounting/FINAL_EDIT_FLOW_AUDIT_AND_DUPLICATE_POSTING_REPORT.md`, `docs/accounting/FINAL_CONTACTS_RECEIPT_EDIT_STALE_OVERWRITE_FIX.md`.
