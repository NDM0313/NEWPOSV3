# Supplier Party Discount PKR 1 QA — Readiness Runbook

**Date:** 2026-07-11  
**Scope:** OLD ERP / DIN Collection ERP only  
**Status:** Readiness plan only — **no QA transaction executed**

## Approval blocker

`APPROVE_SUPPLIER_PARTY_DISCOUNT_PKR1_QA`

Customer-side party discount (JE-0003, MR JALIL, PKR 1) was **completed** in June 2026. This runbook covers the **supplier-side** PKR 1 QA that remains **not approved**.

## Safety attestation

| Item | Status |
|------|--------|
| QA transaction executed | **no** |
| GL mutation performed | **no** |
| `party_discount` JE posted | **no** |
| Production data changed | **no** |

## Service reference

- UI: Ledger Statement Center V2 → **Party Ledger Discount** modal (`PartyLedgerDiscountModal.tsx`)
- Service: `src/app/services/partyLedgerDiscountService.ts`
- `reference_type`: `party_discount`
- Duplicate guard: `action_fingerprint` = `party_discount:{companyId}:supplier:{contactId}:{date}:{amount}`

## Operator-selected values (placeholders)

| Field | Placeholder / guidance |
|-------|------------------------|
| **Company** | `{OPERATOR_SELECTED_COMPANY}` — e.g. DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`) |
| **Branch** | `{OPERATOR_SELECTED_BRANCH}` — use active branch or `all` per policy |
| **Supplier** | `{OPERATOR_SELECTED_SUPPLIER}` — prior handoff example: **MR DIN MOHAMMAD** (confirm contact ID at QA time) |
| **Screen / module** | Ledger Statement Center V2 → Supplier statement → **Apply Party Discount** |
| **Amount** | **PKR 1.00** (minimal controlled test) |
| **Date** | `{QA_LOCAL_DATE}` — operator-selected posting date |
| **Notes** | `Controlled supplier party discount QA — PKR 1` |

## Exact PKR 1 discount action

1. Log in as authorized accounting user for selected company.
2. Open **Ledger Statement Center V2**.
3. Select **Supplier** statement type.
4. Select `{OPERATOR_SELECTED_SUPPLIER}`.
5. Open **Party Discount** modal.
6. Enter amount **1.00** PKR, date `{QA_LOCAL_DATE}`, optional description.
7. **Stop** unless `APPROVE_SUPPLIER_PARTY_DISCOUNT_PKR1_QA` is active.
8. On approval: click Apply once; verify duplicate submit is skipped.

## Expected journal entry (supplier discount received)

| Line | Account | Debit | Credit |
|------|---------|-------|--------|
| 1 | **AP** (supplier payable posting account) | PKR 1 | — |
| 2 | **5210** Discount Received (or resolved purchase-discount account) | — | PKR 1 |

- `reference_type`: `party_discount`
- `reference_id`: supplier contact ID
- Balanced double-entry; no sale/purchase document required

## Expected downstream results

| Surface | Expected effect |
|---------|-----------------|
| **Document level** | New balanced JE with `entry_no` assigned; no purchase invoice created |
| **Party balance** | Supplier payable balance **reduced by PKR 1** (AP debit reduces liability) |
| **Supplier Statement** | Discount row visible; closing balance reflects −PKR 1 payable |
| **Trial Balance** | AP credit balance ↓ PKR 1; Discount Received (5210) credit ↑ PKR 1 |
| **Roznamcha / Day Book** | No cash movement expected (non-cash GL discount) |
| **Party Ledger / Ledger V2** | Discount transaction filter shows row after `ledgerUpdated` event |

## Rollback / cleanup

| Step | Action |
|------|--------|
| Record | `entry_no`, `journal_entries.id`, `action_fingerprint`, line account IDs |
| Reversal | Operator void/reverse per accounting policy — **no automatic cleanup** |
| Monitoring | If golden fixtures drift, Option A refresh only with operator approval |
| Do not | Bulk SQL update, repair RPC, or script-driven GL mutation |

## Dedicated test document

- **Not required** — party discount posts a standalone JE.
- Prefer a **dedicated supplier** with low activity to isolate PKR 1 effect.
- Do not reuse customer JE-0003 party or amount fingerprint.

## Evidence to capture (non-sensitive)

- Screenshot of discount modal (mask balances if policy requires)
- JE number and date (no passwords)
- Supplier statement row showing discount
- Read-only TB snippet for AP and 5210 (or monitoring PASS after refresh)
- `party_discount` fingerprint recorded in QA log

## Must never be mutated by script

- `journal_entries` / `journal_entry_lines` via bulk SQL
- `accounts` deactivation or code rename
- Golden monitoring fixtures without Option A approval
- Any unrelated supplier AP balances

## Prior related evidence

- Customer discount JE-0003: `reports/party-discount-je-posting-qa-20260630/`
- Customer approval pack: `reports/office-resume-20260630/party-discount-je-posting-approval-pack.md`
- Office handoff Priority 2: `docs/accounting/OFFICE_HANDOFF_2026-06-29_PARTY_DISCOUNT_SIGNUP_OTP_AND_REMAINING_TASKS.md`

## Blocker

`APPROVE_SUPPLIER_PARTY_DISCOUNT_PKR1_QA`
