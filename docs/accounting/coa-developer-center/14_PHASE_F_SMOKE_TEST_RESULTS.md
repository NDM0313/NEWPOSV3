# Phase F — Smoke Test Results (2026-06-06)

**Target commit:** `51a827d` — `feat(accounting): add repair production readiness checks`  
**Environment:** Local build + VPS production (`dincouture-vps`, `erp.dincouture.pk`)  
**Scope:** Full checklist except high-risk `opening.create_adjustment_je` apply (excluded per plan)

---

## Executive summary

| Layer | Result |
|-------|--------|
| Code deploy | **PASS** — VPS at `51a827d7` after `git push` + `deploy/deploy.sh` |
| DB migrations | **PASS** — both Phase F migrations in `schema_migrations` |
| RPC / audit table | **PASS** — table exists; relink RPC callable |
| Repair System Status (UI) | **PENDING MANUAL** — panel shipped; requires super-admin login in browser |
| Low/medium apply scenarios | **PENDING MANUAL** — `developer_repair_audit` has **0 rows** (no applies run in this session) |
| Opening adjustment apply | **SKIPPED** (by design — high risk) |

### Final recommendation

**Not safe yet for unrestricted production apply** until a super-admin/developer completes the manual UI steps in [13_PHASE_F_PRODUCTION_SMOKE_TEST.md](13_PHASE_F_PRODUCTION_SMOKE_TEST.md) and at least one low-risk apply produces a verified `developer_repair_audit` row.

**Infra and deploy are ready** — Repair System Status should show **Ready for apply** once logged in as super-admin/developer with company selected.

---

## Phase A — Local/staging

| Step | Result | Evidence |
|------|--------|----------|
| Commit `51a827d` | PASS | `git log -1` |
| `npm run test:unit` | PASS | 84/84 |
| `npm run build` | PASS | exit 0 |
| UI login + Repair Queue | **Manual required** | No browser automation in agent session |

---

## Phase A — SQL verification (VPS Supabase DB)

Run via `deploy/phase-f-smoke-verify.sql`:

| Check | Result |
|-------|--------|
| `20260606120000_developer_repair_audit.sql` | Present in `schema_migrations` |
| `20260606130000_developer_repair_relink_payment_je.sql` | Present in `schema_migrations` |
| `developer_repair_relink_payment_je` function | Exists |
| `developer_repair_audit` row count | **0** (no prior applies) |

**RPC probe (matches Repair System Status service):**

```
ERROR: Payment not found: 00000000-0000-0000-0000-000000000000
```

Business error on zero UUIDs ⇒ RPC exists and is callable (**PASS**).

---

## Phase B — Deploy

| Step | Result |
|------|--------|
| `git push origin main` | PASS — `ea402af..51a827d` |
| VPS `git pull` | PASS — after removing stale `.git/index.lock` |
| VPS HEAD | `51a827d7 feat(accounting): add repair production readiness checks` |
| `deploy/deploy.sh` | PASS — ERP running |
| Migrations during deploy | `[SKIP] 20260606120000_developer_repair_audit.sql (already applied)` |
| | `[SKIP] 20260606130000_developer_repair_relink_payment_je.sql (already applied)` |

---

## Repair System Status (expected UI — verify manually)

Open: **Accounting Developer Center** → **Repair Queue**  
URL pattern: `/admin/accounting-developer-center?tab=repair`

| Checklist row | Expected (super-admin/developer) |
|---------------|----------------------------------|
| `developer_repair_audit` table | OK |
| `developer_repair_relink_payment_je` RPC | OK |
| Company scope | OK |
| Apply role | OK |
| Overall badge | **Ready for apply** |

If **Blocked: role is view/dry-run only** → login as developer or super-admin.

---

## Scenario results

| # | Scenario | Risk | Dry-run | Apply | Audit row | Notes |
|---|----------|------|---------|-------|-----------|-------|
| 1 | Numbering sequence sync | low | **Manual** | **Manual** | — | Use Repair Queue numbering table → out_of_sync row |
| 2 | COA description update | low | **Manual** | **Manual** | — | COA Health → safe account |
| 3 | Payment Trace → queue | medium | **Manual** | Optional | — | `?tab=payment&q=<ref>` |
| 4 | Transaction Trace → queue | medium | **Manual** | Optional | — | `?tab=trace&q=<ref>` |
| 5 | Roznamcha missing payment_account_id | medium | **Manual** | Optional | — | `?tab=roznamcha&q=<ref>` |
| 6 | Opening Balance missing JE | medium | **Manual dry-run only** | **Not run** | — | High-risk adjustment excluded |
| 7 | Opening adjustment JE | high | — | **SKIPPED** | — | Requires separate business approval |

### Apply panel block reasons (reference)

When Apply is disabled, [`RepairActionPanel`](../../../src/app/components/admin/developer-center/RepairActionPanel.tsx) shows:

- Run dry-run first
- Confirm phrase required / mismatch
- Apply requires super-admin or developer role
- Payment relink RPC missing (migration)
- Action not eligible anymore (dry-run blocked)

---

## Post-apply verification (run after manual applies)

```sql
-- Latest repair audit rows
SELECT id, action_id, status, target_table, target_id, created_at
FROM developer_repair_audit
ORDER BY created_at DESC LIMIT 10;

-- JE line spot-check (replace journal_entry_id from dry-run before snapshot)
SELECT account_id, debit, credit, line_order
FROM journal_entry_lines
WHERE journal_entry_id = '<je_id>'
ORDER BY line_order;
```

**Audit Log UI:** Developer Center → Audit Log → `developer_repair` source rows.

**Roznamcha:** No fake cash rows — compare Roznamcha Trace before/after any metadata repair.

---

## Manual completion checklist

After you run UI steps, update this table:

- [ ] Repair System Status = Ready for apply
- [ ] Low-risk apply #1 (numbering) + audit row verified
- [ ] Low-risk apply #2 (COA description) + audit row verified
- [ ] Medium dry-runs (Payment / Transaction / Roznamcha) OK
- [ ] Opening Balance dry-run only (no adjustment apply)
- [ ] JE line amounts unchanged on existing lines
- [ ] No fake Roznamcha cash rows

When all checked → change final recommendation to **Safe for controlled production use**.

---

## Related

- [13_PHASE_F_PRODUCTION_SMOKE_TEST.md](13_PHASE_F_PRODUCTION_SMOKE_TEST.md) — full procedure
- [12_PHASE_F_COMPLETION.md](12_PHASE_F_COMPLETION.md) — Phase F completion
