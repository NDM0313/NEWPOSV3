# Party Ledger Discount — posting QA

**Generated:** 2026-06-29

---

## Environment gate

| Item | Value |
|------|--------|
| Classification | **PRODUCTION_LIVE** |
| Target | `https://supabase.dincouture.pk` (via `localhost:5173/supabase` proxy) |

---

## Decision

**BLOCKED_PRODUCTION_MUTATION_NOT_APPROVED**

Per operator constraints, no discount journal entries were posted to production during this QA run.

---

## Posting checks (not executed)

| Check | Status |
|-------|--------|
| Customer discount JE (Dr 5200, Cr AR) | **Not run** |
| Supplier discount JE (Dr AP, Cr 5210) | **Not run** |
| `reference_type = party_discount` | **Not verified** |
| Statement reload via `ledgerUpdated` | **Not verified** |
| Discount filter shows posted row | **Not verified** |

---

## Rollback references

None — no test postings created.

---

## Posting result

**BLOCKED** — requires staging/local target or explicit operator approval for production test JE.
