# Party Discount JE posting — approval pack

**Generated:** 2026-06-30  
**Status:** AWAITING_OPERATOR_APPROVAL  
**posting_approved:** `false`

---

## Proposed test posting

| Field | Value |
|-------|--------|
| Company | **DIN CHINA** |
| Login (monitoring default) | `din@yahoo.com` |
| Party type | Customer |
| Party | **MR JALIL** (or operator-selected party) |
| Amount | **PKR 1** |
| Date | **2026-06-30** (today) |
| Notes | Controlled office QA — minimal test amount |

---

## Expected journal entry (customer discount)

| Line | Account | Debit | Credit |
|------|---------|-------|--------|
| 1 | **5200** Discount Allowed | PKR 1 | — |
| 2 | Party AR (receivable posting account) | — | PKR 1 |

- **reference_type:** `party_discount`
- **reference_id:** contact ID of MR JALIL
- **action_fingerprint:** `party_discount:{companyId}:customer:{contactId}:2026-06-30:1`

(Service: `src/app/services/partyLedgerDiscountService.ts`)

---

## Checks after posting (if approved)

1. Ledger statement reloads (`ledgerUpdated`)
2. **Discount** transaction filter shows the row
3. Ledger V2 / Account Statement impact verified (closing balance −PKR 1 receivable effect)
4. Journal lines verified in GL UI or SQL read-only query
5. Duplicate submit returns skipped (same fingerprint)

---

## Rollback / reversal plan

- **Do not reverse automatically** after posting
- Document exact JE reference: `entry_no`, `journal_entries.id`, `action_fingerprint`, line account IDs
- **Operator decides** whether to keep as permanent test JE or void/reverse per accounting policy
- No automatic cleanup in this QA phase

---

## Decision

| Field | Value |
|-------|--------|
| **posting_approved** | **false** |

**Next step:** Operator must explicitly approve company, party, amount, date, and rollback plan before any Apply click on production.
