# Phase F — Production Smoke Test Checklist

**Purpose:** Manual verification on staging or production before relying on controlled repair apply.  
**Audience:** Super-admin or developer role only.

---

## Pre-flight (required before any apply)

- [ ] **Database backup** taken (full Postgres snapshot or provider backup)
- [ ] Migrations confirmed applied:
  - [ ] `migrations/20260606120000_developer_repair_audit.sql`
  - [ ] `migrations/20260606130000_developer_repair_relink_payment_je.sql`
- [ ] Logged in as **super-admin** or **developer**
- [ ] Open **Accounting Developer Center** → **Repair Queue** tab
- [ ] **Repair System Status** panel shows:
  - [ ] `developer_repair_audit` table — OK
  - [ ] `developer_repair_relink_payment_je` RPC — OK
  - [ ] Company scope — OK
  - [ ] Apply role — OK (overall: **Ready for apply**)

---

## Standard flow (every scenario)

1. Detect issue in trace / health tab
2. **Send to Repair Queue**
3. **Dry-run** — review before snapshot and after preview
4. Enter **exact confirm phrase**
5. **Apply repair**
6. Verify **Audit Log** → `developer_repair` source row

---

## Scenario checklist

### 1. Numbering sequence sync — **low risk**

- [ ] Repair Queue → Numbering dry-run → out-of-sync row → Send to queue
- [ ] Dry-run shows sequence bump preview (never decreases)
- [ ] Confirm phrase: `SYNC-SEQUENCE-TO-EFFECTIVE-MAX`
- [ ] Apply succeeds; audit row `numbering.sync_sequence_to_effective_max`

### 2. COA description update — **low risk**

- [ ] COA Health → account usage → queue description update
- [ ] Dry-run shows before/after on `accounts.description` only
- [ ] Apply with action-specific confirm phrase
- [ ] Audit row `coa.update_description`

### 3. Payment Trace repair candidate — **medium risk**

- [ ] Payment Trace tab → run diagnostic on known orphan/mismatch ref
- [ ] Review candidate card: action id, risk, target table/id, will change / never changes
- [ ] Send to queue → dry-run → apply (if eligible)
- [ ] Verify **no** change to payment amount or JE line debit/credit

### 4. Transaction Trace repair candidate — **medium risk**

- [ ] Transaction Trace tab → same candidate review as Payment Trace
- [ ] Send to queue → dry-run → apply (if eligible)
- [ ] Verify metadata-only change (e.g. `journal_entries.payment_id` or `branch_id`)

### 5. Roznamcha missing payment account — **medium risk**

- [ ] Roznamcha Trace → candidate for `payment.fill_payment_account_from_je`
- [ ] Dry-run shows `payment_account_id` fill from JE liquidity line
- [ ] Apply; confirm **no fake Roznamcha cash rows** added

### 6. Opening Balance missing JE — **medium / high risk**

- [ ] Opening Balance tab → contact with `missing_je` status
- [ ] **Dry-run only first** — review proposed opening JE lines
- [ ] Apply `opening.create_missing_je` only if business approves
- [ ] For `opening.create_adjustment_je` — treat as **high risk**; dry-run twice; verify new JE only (no edits to existing JE amounts)

---

## Post-apply verification

- [ ] **Audit Log** tab shows `developer_repair` rows with matching `action_id`, `before_json`, `after_json`
- [ ] Spot-check affected **journal_entry_lines**: debit/credit amounts on **existing** lines unchanged
- [ ] Roznamcha: no synthetic cash movement rows from Developer Center
- [ ] Repair System Status still **Ready for apply** after checks

---

## Risk summary (all Phase F actions)

| Action ID | Risk | Notes |
|-----------|------|-------|
| `numbering.sync_sequence_to_effective_max` | **low** | Counter never decreases |
| `coa.rename_account` | **low** | Display name only |
| `coa.update_description` | **low** | Metadata only |
| `coa.toggle_active_if_safe` | **low** | Blocked if journal usage |
| `payment.relink_payment_to_journal` | **medium** | Sets `journal_entries.payment_id` only |
| `payment.fill_payment_account_from_je` | **medium** | Metadata on payment/rental payment |
| `payment.sync_branch_from_document` | **medium** | Branch metadata only |
| `rental.relink_rental_payment_to_journal` | **medium** | Rental payment metadata |
| `opening.create_missing_je` | **medium** | Creates **new** opening JE |
| `opening.create_adjustment_je` | **high** | Creates **new** adjustment JE |
| `opening.orphan_je_review` | **low** | Audit note only |
| `roznamcha.report_duplicate_source` | **low** | Report / audit only |

---

## Rollback notes

- Metadata repairs: revert using `before_json` in `developer_repair_audit` (manual, per [11_REPAIR_AUDIT_LOG.md](11_REPAIR_AUDIT_LOG.md))
- New JEs from opening actions: do **not** delete via Developer Center — use standard accounting void process if required

---

## Related docs

- [09_CONTROLLED_REPAIR_ACTIONS.md](09_CONTROLLED_REPAIR_ACTIONS.md) — action catalog
- [12_PHASE_F_COMPLETION.md](12_PHASE_F_COMPLETION.md) — Phase F completion summary
