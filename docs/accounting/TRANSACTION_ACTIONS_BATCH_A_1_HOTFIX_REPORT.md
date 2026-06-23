# Transaction Actions — Batch A.1 Hotfix Report

**Branch:** `feature/accounting-transaction-actions-batch-a`  
**Commit before fix:** `c4ea5ec3`  
**Hotfix commit:** _(filled after commit)_  
**Date:** 2026-06-23

---

## Issue 1 — Transaction Detail Edit closes parent modal

### Root cause

1. **Radix Dialog dismiss on nested UI:** Parent `TransactionDetailModal` used `onOpenChange={onClose}` without guarding nested editors. When `UnifiedPaymentDialog` (z-130) or journal quick-edit opened, Radix treated outside interaction / focus loss as a close request and unmounted the parent.
2. **Async race:** `runUnifiedEdit()` fetches payment data before `setGenericPaymentEditor(...)`. During the async gap, `nestedEditorOpen` was false so the parent could close before the child mounted.
3. **Nested Dialog anti-pattern:** Manual journal quick-edit `Dialog` was rendered **inside** parent `DialogContent`, amplifying Radix nested-dialog close behavior.

### Fix summary

| Change | File |
|--------|------|
| `transactionDetailNestedEditor.ts` — `shouldAllowTransactionDetailClose`, `isTransactionDetailNestedEditorOpen` | new |
| `nestedEditorPending` state during async `runUnifiedEdit` | `TransactionDetailModal.tsx` |
| `handleTransactionDetailOpenChange` — block close while nested editor open/pending | `TransactionDetailModal.tsx` |
| `onInteractOutside` / `onPointerDownOutside` preventDefault while nested open | `TransactionDetailModal.tsx` |
| Move journal quick-edit `Dialog` **outside** parent `Dialog` (sibling, z-120) | `TransactionDetailModal.tsx` |
| Clear pending flag on blocked/noop/error paths | `TransactionDetailModal.tsx` |

**Unchanged:** `UnifiedPaymentDialog` mutation paths, PF-14 payment edit mechanics, `unifiedTransactionEdit.ts` routing.

### Expected behavior after fix

| Action | Behavior |
|--------|----------|
| Edit Payment | Parent detail stays open; `UnifiedPaymentDialog` overlays; cancel returns to detail |
| Edit Entry | Journal quick-edit opens as sibling dialog; parent stays mounted |
| Edit Transfer | Still navigates to Accounting + `openAddEntryV2` (parent closes by design) |
| Source-controlled | Edit hidden/disabled per registry (unchanged) |

### Manual QA checklist (post-hotfix)

- [ ] Open Transaction Detail → Edit Payment → nested dialog stays open; parent visible behind or stable
- [ ] Cancel nested payment editor → back to Transaction Detail
- [ ] Save payment → existing PF-14 path; detail refreshes
- [ ] Edit Entry on manual journal → quick-edit dialog; cancel returns to detail
- [ ] Edit Transfer → navigates to Accounting (intentional close)
- [ ] Source-controlled sale row → no Edit / Open Source only

---

## Issue 2 — Localhost login / Supabase 401

### Finding: **environment configuration**, not Batch A code regression

| Check | Result |
|-------|--------|
| Worktree `.env.local` | **Missing** (`NEWPOSV3-actions-batch-a`) |
| Main workspace `.env.local` | Present (not read — no secrets logged) |
| Vite dev proxy | `/supabase` → `https://supabase.dincouture.pk` (`vite.config.ts`) |
| Dev Supabase URL rewrite | `supabase.ts` sets `supabaseUrl = window.location.origin + '/supabase'` in DEV |

**Likely causes of 401 / proxy errors on localhost:**

1. **Missing or stale `.env.local`** in the dev worktree — `VITE_SUPABASE_ANON_KEY` must be the production anon JWT from VPS `.env.production` / Supabase dashboard (see `.env.example` line 2–4). Placeholder/demo anon key triggers 401 after sign-in.
2. **Invalid credentials** — 401 on `/auth/v1/token` can be wrong email/password unrelated to code.
3. **Proxy path** — app uses `http://localhost:5173/supabase`, not `5174`. Mobile app may use 5174 separately.
4. **Browser extension noise** — unrelated console errors (e.g. adblock) should be ignored if auth works.

### Safe operator action

```bash
# From repo root with valid production anon key (do NOT commit):
cp /path/to/.env.local .env.local
# Or copy from VPS .env.production VITE_* lines only into .env.local
npm run dev:no-migrate
```

Use same anon key as production ERP build; never put service role in frontend.

---

## Issue 3 — JALIL Customer Statement vs Ledger V2 mismatch (document only)

### Known separate issue: Customer Statement vs Ledger V2 mismatch

**User observation:**

- Party: **JALIL**
- Account Statement vs Ledger Statement Center V2 show different remaining balances
- One surface ~**216,000** remaining; other ~**12–14 lakh**

**Assessment:**

- **Not in Batch A / A.1 scope** — action label unification does not change statement engines
- Likely **ledger engine / hybrid vs GL tie-out** or effective vs audit presentation drift
- Must be handled under **Single Core Ledger Phase 1.5 validation** (currently parked) or a **separate read-only reconciliation** task

**This hotfix:** no statement engine changes, no data fixes, no Ledger V2 logic changes.

---

## Tests and build

```bash
npx tsx --test src/app/lib/transactionActionsRegistry.test.ts \
  src/app/lib/transactionActionRules.test.ts \
  src/app/lib/transactionDetailNestedEditor.test.ts
npm run build
```

| Result | Status |
|--------|--------|
| Unit tests | **18/18 pass** |
| `npm run build` | **Pass** |

---

## Files changed

```
src/app/lib/transactionDetailNestedEditor.ts          (new)
src/app/lib/transactionDetailNestedEditor.test.ts     (new)
src/app/components/accounting/TransactionDetailModal.tsx
docs/accounting/TRANSACTION_ACTIONS_BATCH_A_1_HOTFIX_REPORT.md
```

---

## Safety confirmations (pre-deploy)

| Item | Status |
|------|--------|
| DB migration | **No** |
| DB touch | **No** |
| Single Core Ledger Phase 1.5 | **No** |
| `unified_ledger_engine` | **Unchanged** |
| VPS deploy | **Pending** (section below updated after deploy) |

---

## Deploy (post-commit)

_(Updated after VPS deploy)_
