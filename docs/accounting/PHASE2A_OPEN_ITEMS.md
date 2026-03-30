# PHASE 2A Open Items (post-gate)

**Phase gate:** **READY FOR PHASE 2B LEGACY FREEZE = YES** (as of 2026-03-30)

Resolved by verified DB/runtime evidence (see `docs/accounting/PHASE2A_QA_EVIDENCE.md`):

- Migration `migrations/20260370_phase2a2_ledger_sales_branch_dashboard_contact_ar_ap.sql` — **applied**
- Worker payment canonical chain + duplicate counts — **PASS** (`PAY-0038`)
- Branch-aware `get_customer_ledger_sales` — **PASS** (runtime)
- Executive dashboard AR/AP basis — **PASS** (`get_financial_dashboard_metrics` ↔ `get_contact_balances_summary`)

---

## Non-blocking follow-ups (do not block Phase 2B)

1. **Optional screenshots** — Worker payment success, executive dashboard, branch ledger UI (training / audit).
2. **Optional QA smoke log** — Full `docs/accounting/PHASE2A_TEST_CHECKLIST.md` capture when convenient.
3. **Offline legacy queue runbook** — Payloads missing `paymentAccountId` after older app builds; document manual retry / re-post for ops (`erp-mobile-app/src/lib/registerSyncHandlers.ts`).
4. **Dead mock accounting module** — `erp-mobile-app/src/components/accounting/AccountingModule.tsx` remains unused; archive/remove in a **dedicated** cleanup PR after product sign-off (not part of this doc pass).
5. **Product UX** — Ongoing clarity that GL cards, document-due tabs, and contact-summary roll-up are **different by design**; labels already added in Phase 2A / 2A.2.

---

## Risk summary (residual, low)

- Low: Users may still confuse GL vs operational vs contact-summary numbers without reading labels — mitigate with training.
- Low: Old offline queued payments may fail sync until re-posted — runbook item above.

---

## Safe next action

- **Begin Phase 2B legacy-freeze / cleanup planning** per product roadmap — **no destructive scripts or table drops** until Phase 2B work is explicitly scoped and approved in that phase.
