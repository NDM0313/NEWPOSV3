# Single Core Ledger — Phase 1.6 Remediation Plan

**Branch:** `feature/single-core-ledger-phase-1-6-remediation`  
**Status:** Clone apply complete — **Gate A partial** (payment contact cleared; 6 branch JEs manual_review)

**Phase 1.6.1 update (2026-06-23):** Manual branch assignments applied on clone — **Gate A FULL PASS** (3/3 strict, branch_attribution_risk 0). See [`SINGLE_CORE_LEDGER_PHASE_1_6_1_BRANCH_MANUAL_REVIEW.md`](SINGLE_CORE_LEDGER_PHASE_1_6_1_BRANCH_MANUAL_REVIEW.md).

---

## Clone run results (2026-06-23, `ledger_stage_20260623`)

| Phase | Before | After apply | Notes |
|-------|-------:|------------:|-------|
| Payment contact gaps | 74 | **0** | 74 `safe_apply` backfilled |
| Branch attribution risk | 8 | **6** | 2 `safe_apply` JEs fixed; 6 manual_review |
| Dry-run safe_apply | 74 + 2 | 0 + 0 | Re-run on already-remediated clone |
| Diagnostics strict_pass | 1/3 | **1/3** | DIN COUTURE only; branch blocker remains |
| Pilot tie-out | PASS | **PASS** | 6/6 DIN CHINA |

**Dry-run SHA256 (pre-apply):** see `reports/single-core-ledger/remediation-dry-run-2026-06-23T*.json` on VPS validation repo.

### Remaining manual_review branch JEs (Gate A exception list)

| Company | entry_no | reference_type | Reason |
|---------|----------|----------------|--------|
| DIN CHINA | FT-000287, FT-000309 | transfer | No deterministic linked-document branch |
| DIN CHINA | JE-0287, JE-0309 | manual_receipt | Linked payment branch ambiguous |
| DIN BRIDAL | (4 rows) | mixed | Same classes — see inventory JSON |

---

## Executive summary

Phase 1.6 remediates **strict Gate A blockers** identified in Phase 1.5 clone validation:

| Issue | DIN CHINA | DIN BRIDAL | DIN COUTURE | Fix class |
|-------|-----------|------------|-------------|-----------|
| `payments_missing_contact_sale_linked` | 70 | 4 | 0 | `payment_contact_backfill` (safe_apply) |
| `branch_attribution_risk` | 4 | 4 | 0 | `branch_attribution_review` (mixed safe/manual) |
| `opening_balance_null_branch_je_count` | 11 | 173 | 72 | info only — no auto-fix |

**Strict gate rule:** `branch_attribution_risk = 0` AND `payments_missing_contact_sale_linked = 0` AND `payments_wrong_party_attribution = 0`.

---

## Inventory totals (pre-apply)

| Metric | Count |
|--------|------:|
| Payment contact gaps (row-level) | ~74 |
| Branch attribution risk JEs | 8 |
| Wrong-party payments | 0 |
| safe_apply (payment contact) | ~74 |
| safe_apply (branch) | 0–4 (transfers FT-* → manual_review) |

Row samples and per-company breakdown are in `reports/single-core-ledger/remediation-inventory-*.json` and `remediation-dry-run-*.json`.

### Known manual_review samples (DIN CHINA)

- **Transfer JEs:** `FT-000287`, `FT-000309` — branch cannot be auto-resolved from linked document
- **manual_receipt JEs:** `JE-0309`, `JE-0287` — require linked payment branch or finance sign-off

---

## Dry-run artifacts

| Artifact | Pattern |
|----------|---------|
| Inventory JSON | `reports/single-core-ledger/remediation-inventory-<timestamp>.json` |
| Dry-run JSON + SHA256 manifest | `reports/single-core-ledger/remediation-dry-run-<timestamp>.json` |
| Dry-run CSV | `reports/single-core-ledger/remediation-dry-run-<timestamp>.csv` |

Run locally or on VPS clone:

```bash
export UNIFIED_LEDGER_STAGING=1 UNIFIED_LEDGER_VPS_CLONE=1 UNIFIED_LEDGER_PG_ONLY=1
export DATABASE_URL="postgresql://postgres:***@172.19.0.15:5432/ledger_stage_20260623"
npm run remediation:inventory
npm run remediation:dry-run
```

---

## Clone apply (guarded)

**Predicates (idempotent):**

```sql
-- Payment contact
UPDATE payments SET contact_id = :proposed_contact_id
WHERE id = :payment_id AND contact_id IS NULL AND voided_at IS NULL;

-- Branch metadata
UPDATE journal_entries SET branch_id = :proposed_branch_id
WHERE id = :journal_entry_id AND branch_id IS NULL AND COALESCE(is_void, FALSE) = FALSE;
```

**Guards:** `REMEDIATION_APPLY_CONFIRM=1`, `--dry-run-file`, `--expected-safe-count`, clone DB name `ledger_stage_*`.

```bash
REMEDIATION_APPLY_CONFIRM=1 node scripts/ledger-remediation/apply-payment-contact-backfill-clone.mjs \
  --dry-run-file reports/single-core-ledger/remediation-dry-run-<ts>.json \
  --expected-safe-count 74
REMEDIATION_APPLY_CONFIRM=1 node scripts/ledger-remediation/apply-branch-attribution-clone.mjs \
  --dry-run-file reports/single-core-ledger/remediation-dry-run-<ts>.json \
  --expected-safe-count 0
```

Audit: `party_repair_audit` + `remediation-apply-audit-*.json`.

---

## Post-apply / Gate A

After clone apply, re-run:

```bash
UNIFIED_LEDGER_STAGING=1 node scripts/run-single-core-ledger-diagnostics.mjs --write-report
UNIFIED_LEDGER_TIEOUT_STAGING=1 node scripts/run-unified-ledger-tieout.mjs --pilot-only --write-report
UNIFIED_LEDGER_TIEOUT_STAGING=1 node scripts/run-unified-ledger-tieout.mjs --write-report
```

**Gate A target:** 3/3 strict pass OR documented manual_review exceptions (transfer JEs).

**Phase 1.6.1 result:** **ACHIEVED** — diagnostics PASS 3/3 @ `2026-06-23T15:50:06Z`; pilot tie-out PASS 9/9.

---

## Safety

| Rule | Status |
|------|--------|
| Production `postgres` mutated | **No** |
| `unified_ledger_engine` enabled | **No** |
| GL amounts changed | **No** (metadata only) |
| Migrations on production | **No** |

See `SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md` for production proposal (no execution).
