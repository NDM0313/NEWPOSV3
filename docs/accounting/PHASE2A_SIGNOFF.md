# PHASE 2A Sign-off (final phase-gate)

**Date:** 2026-03-30  
**Evidence:** `docs/accounting/PHASE2A_QA_EVIDENCE.md` (verified DB/runtime outputs recorded there)

## Status summary

| Area | Status |
|------|--------|
| **Worker payment chain** | **PASS** — `PAY-0038` / worker `d208e44f-bf49-4288-8c01-d486ecb6da5c`: `payments_ct=1`, `je_ct=1`, `jel_ct=2`, `worker_ledger_ct=1` |
| **Branch parity (ledger RPC)** | **PASS** — `get_customer_ledger_sales(uuid, uuid, date, date, uuid)` at runtime; customer `45e60a2e-9b1a-478c-8f75-cf09d29a0eba`: company_scope `row_ct=2`, branch_scope `row_ct=2` (branch-aware; data in branch) |
| **Dashboard parity (executive AR/AP)** | **PASS** — `get_financial_dashboard_metrics(uuid, uuid)` returns `ar_ap_basis=get_contact_balances_summary`, `ar_ap_scope=branch`, `receivables=18000.03`, `payables=464302.00`, matching branch-scoped contact-summary sums |
| **AR/AP semantics** | **PASS** — GL vs document due vs `get_contact_balances_summary` roll-up documented in UI (`AccountingDashboard.tsx`, `Dashboard.tsx`, mobile reports) |

## Phase-gate rationale

The earlier **READY FOR PHASE 2B = NO** decision was based on **pre-migration / pre-runtime-proof** state (templates, missing applied migration, missing count proofs).

That state is **superseded** by verified evidence:

- Migration **`migrations/20260370_phase2a2_ledger_sales_branch_dashboard_contact_ar_ap.sql`** is **applied** on the target DB.
- Runtime signatures and RPC outputs are **confirmed** (see QA evidence doc).

## Remaining risks (non-blocking for Phase 2B entry)

1. Legacy offline worker-payment queue items without `paymentAccountId` may still need a **runbook** (ops), not a code gate.
2. Executive **payables** include worker/studio slice from `get_contact_balances_summary`; supplier-only lists can differ — **labeled** in product UI.
3. Optional **screenshots** and **smoke logs** for audit binders — not required to start Phase 2B legacy-freeze work.

---

## READY FOR PHASE 2B LEGACY FREEZE

**READY FOR PHASE 2B LEGACY FREEZE = YES**

## Non-blocking follow-ups

- Optional screenshot pack for training / audit.
- Optional full regression smoke capture.
- Offline legacy queue runbook (`PHASE2A_OPEN_ITEMS.md`).
- Stakeholder decision on archiving unused `erp-mobile-app/src/components/accounting/AccountingModule.tsx` (separate cleanup PR; **not** part of Phase 2B freeze start in this pass).
