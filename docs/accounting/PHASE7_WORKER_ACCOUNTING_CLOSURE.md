# Phase 7 — Worker accounting closure

## Scope

Close remaining **worker** gaps: bill vs payment ordering, **2010** vs **1180**, studio stage posting, operational `worker_ledger_entries` vs GL vs party tie-out.

## Reference implementation

| Concern | Where |
|---------|--------|
| Worker payable GL buckets (bills, settlement, payments, other) | `controlAccountBreakdownService.ts` (`worker_payable`) |
| Worker advance GL buckets (pre-bill, settlement, other) | `controlAccountBreakdownService.ts` (`worker_advance`) |
| Party list net (WP−WA) | `get_contact_party_gl_balances.gl_worker_payable` + worker contact filter |
| Worker ledger unpaid operational total | `worker_ledger_entries` status ≠ paid |
| Tie-out diagnostics | `partyBalanceTieOutService.ts` (`WORKER_LIFECYCLE_PATTERN`, etc.) |
| Journal worker party ledger | `accountingService.getWorkerPartyGlJournalLedger` |

## Test protocol (one real worker)

1. Pick **one** worker contact with: at least one **bill** (studio stage JE pattern), **partial payment**, and **remaining balance**.
2. Record **branch** and **company** scope used in UI.

### Compare surfaces

| Surface | Engine | What “good” looks like |
|---------|--------|-------------------------|
| Contacts / Workers row | Operational | Payables from `get_contact_balances_summary` / worker path; not GL. |
| Worker operational statement | Operational | Aligns with open studio/worker ledger intent. |
| Worker GL statement | GL | 2010 / 1180 lines match posted JEs (`worker_payment`, `worker_advance_settlement`, `studio_production_stage`, …). |
| Worker reconciliation tab | Reconciliation | Variance explained (timing, unmapped lines, RPC gap). |
| Accounting COA worker accounts | GL | 2010 and 1180 TB balances consistent with statements. |
| Party tie-out panel | Mixed (labeled) | No silent blend; `WORKER_LIFECYCLE_PATTERN` only where rule actually fails. |
| Control drawer (2010 / 1180) | GL + operational + pending | “Other reference types” should be near zero or **Pending mapping** with note. |

### Ordering scenarios

| Scenario | Expected posting pattern (high level) |
|----------|----------------------------------------|
| **Payment before bill** | Often **1180** (`worker_payment` on advance); bill later moves **2010**; settlement links `worker_advance_settlement`. |
| **Bill then payment** | **2010** stage credits; `worker_payment` Dr 2010 typical. |
| **Partial payment** | Running balance on operational ledger + GL lines sum to partial amount; no duplicate full settlement. |

## Known lifecycle rule failures (code-level)

1. **Party list on 1180 drawer** — explicitly **unavailable** for per-party advance-only; rows shown are **worker net WP−WA**, not 1180-only (`controlAccountBreakdownService` note).
2. **2010 vs party net** — drawer marks residual reconciliation as **pending_mapping**; do not force equality without journal review.
3. **Studio `assigned_worker`** — if stages post without consistent worker attribution, party resolver and extended GL can diverge; fix at **posting metadata / stage** level, not by relabeling balances.

## If mismatch remains — proposed fixes (exact)

| Symptom | Likely cause | Fix direction |
|---------|--------------|----------------|
| Operational worker due ≠ GL net | Unposted bill or payment only in ledger table | Post missing JE or sync `worker_ledger_entries` |
| Tie-out `WORKER_LIFECYCLE_PATTERN` | JE reference_type / account pattern off-policy | Correct `reference_type` or line accounts; void/repost if wrong |
| RPC party net ≠ extended GL | `get_contact_party_gl_balances` migration parity | Apply / verify `20260334_get_contact_party_gl_balances_party_parity.sql` |
| Pre-bill payment on wrong account | Business flow | Train flow or adjust `AccountingContext` worker payment path to hit 1180 vs 2010 per policy |

## Phase 7 signoff

| Item | Pass |
|------|------|
| One worker end-to-end test completed | ☐ |
| All seven surfaces compared with labels | ☐ |
| Remaining gaps documented as `pending_mapping` or ticket | ☐ |

**Tester / date:**  

---

*Execution is on your tenant; this file is the closure checklist.*
