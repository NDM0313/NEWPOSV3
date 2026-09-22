# Party Ledger Discount integration review

**Commit:** `ae6c69d0`  
**Generated:** 2026-06-29

---

## Files inspected

| File | Role |
|------|------|
| `src/app/services/partyLedgerDiscountService.ts` | JE posting logic |
| `src/app/features/ledger-statement-center-v2/PartyLedgerDiscountModal.tsx` | UI + validation |
| `src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx` | Modal wiring, reload |
| `src/app/features/ledger-statement-center-v2/LedgerFilterBar.tsx` | Discount button + filter |
| `src/app/services/ledgerStatementCenterV2Service.ts` | Row mapping + filter |
| `src/app/config/coaMapping.ts` | COA codes 5200 / 5210 |

---

## Journal entry directions

### Customer discount

| Line | Account | Dr | Cr |
|------|---------|----|----|
| 1 | Discount Allowed (`5200`) | amount | 0 |
| 2 | Party AR (`resolveReceivablePostingAccountId`) | 0 | amount |

**Effect:** Reduces customer receivable; records discount expense. **PASS**

### Supplier discount

| Line | Account | Dr | Cr |
|------|---------|----|----|
| 1 | Party AP (`resolvePayablePostingAccountId`) | amount | 0 |
| 2 | Discount Received (`5210`) | 0 | amount |

**Effect:** Reduces supplier payable; records discount income. **PASS**

---

## Metadata & mapping

| Field | Value | Status |
|-------|-------|--------|
| `reference_type` | `party_discount` | PASS |
| `reference_id` | `contactId` (party) | PASS |
| `action_fingerprint` | `party_discount:{company}:{type}:{contact}:{date}:{amount}` | PASS — idempotent duplicate skip |
| `entry_date` | ISO date slice (YYYY-MM-DD) | PASS |
| `company_id` | Required param | PASS |
| `branch_id` | Set when branchId valid and not `'all'` | PASS |
| `created_by` | Auth user id from wizard/page | PASS |

---

## Validation & safety

| Check | Result |
|-------|--------|
| Rejects missing company/contact/amount ≤ 0 | PASS |
| Rejects missing AR/5200 or AP/5210 with user-facing error | PASS |
| Duplicate fingerprint returns `skipped: true` (no double post) | PASS |
| Void filter on duplicate check (`is_void` null/false) | PASS |
| **No `service_role` in frontend** | PASS — uses anon `supabase` + `accountingService.createEntry` |
| GL mutation only on explicit user submit | PASS — modal submit only |
| Auto-create 5200 if missing | Side effect on first customer discount only; user-initiated |

---

## Ledger statement display

| Check | Result |
|-------|--------|
| Row label | `transactionType: 'Discount'` when ref includes `party_discount` |
| Filter | Transaction type **Discount** matches via `includes('discount')` |
| Reload | `ledgerUpdated` custom event → `loadStatement()` when entity matches |

---

## Gaps / follow-up (non-blocking for push)

- **Browser QA not run** in this audit — post discount on test customer/supplier and verify statement row + TB impact
- **Unified loader path:** reload uses same `loadStatement()` as legacy; no separate unified discount RPC
- **No unit test** for `party_discount` mapping (optional per plan)

---

## Verdict

**CODE_REVIEW_PASS** — JE directions, reference typing, idempotency, and UI wiring are correct. Deploy requires separate operator approval + browser QA.
