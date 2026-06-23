# Single Core Ledger — Phase 1.6 Remediation Plan

**Branch:** `feature/single-core-ledger-phase-1-6-remediation`  
**Base:** `feature/single-core-ledger-phase-1-5-systemwide` @ `70fe1708`  
**Clone target:** `ledger_stage_20260623` (VPS isolated — **not** production `postgres`)  
**Status:** Implementation in progress

---

## Executive summary

Phase 1.6 remediates **strict Gate A blockers** identified in Phase 1.5 clone validation:

| Company | company_id | Strict failures (pre-remediation) |
|---------|------------|-----------------------------------|
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` | `payments_missing_contact_sale_linked` (70), `branch_attribution_risk` (4) |
| DIN BRIDAL | `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` | same pattern (4 + 4) |
| DIN COUTURE | `2ab65903-62a3-4bcf-bced-076b681e9b74` | strict pass |

**Scope:** metadata-only repairs on clone — `payments.contact_id` backfill from sale customer; `journal_entries.branch_id` where deterministically linked to operational documents. **No GL amount changes**, no production mutation, no `unified_ledger_engine` enablement.

---

## Strict gate rule

```
strict_pass = branch_attribution_risk = 0
           AND payments_missing_contact_sale_linked = 0
           AND payments_wrong_party_attribution = 0
```

Info-only (non-blocking): `opening_balance_null_branch_je_count` — reported in opening-balance dry-run, not auto-fixed.

---

## Scripts (`scripts/ledger-remediation/`)

| Script | Purpose |
|--------|---------|
| `inventory-diagnostic-failures.mjs` | Bundle 1 — row-level inventory |
| `dry-run-payment-contact-backfill.mjs` | Bundle 2A |
| `dry-run-branch-attribution.mjs` | Bundle 2B |
| `dry-run-opening-balance-ar-ap-risk.mjs` | Bundle 2C (report only) |
| `dry-run-single-core-remediation-summary.mjs` | Bundle 2 — merged JSON/CSV |
| `apply-payment-contact-backfill-clone.mjs` | Bundle 3 — clone apply |
| `apply-branch-attribution-clone.mjs` | Bundle 3 — clone apply |
| `run-vps-clone-remediation.sh` | Full VPS cycle |

### NPM scripts

```bash
npm run remediation:inventory
npm run remediation:dry-run
npm run remediation:apply-clone   # requires REMEDIATION_APPLY_CONFIRM=1 + dry-run file args
```

### Environment (VPS clone)

```bash
export UNIFIED_LEDGER_STAGING=1
export UNIFIED_LEDGER_VPS_CLONE=1
export UNIFIED_LEDGER_PG_ONLY=1
export DATABASE_URL="postgresql://postgres:***@127.0.0.1:5432/ledger_stage_20260623"
```

---

## Safe apply vs manual review

| Fix class | safe_apply | manual_review |
|-----------|------------|---------------|
| Payment contact from sale `customer_id` | High confidence, sale not void/cancelled, no allocation conflict | Wrong party, missing sale, split allocations |
| Branch from linked document branch | sale/purchase/rental/payment branch match | **transfer** (FT-*), ambiguous manual_receipt, company-default inference only |
| Opening balance NULL branch | Never | Always report-only |

Known manual-review samples: DIN CHINA transfer JEs `FT-000287`, `FT-000309`.

---

## Inventory snapshot (auto-updated)

_Pending first clone run._

---

## Clone apply results (auto-updated)

_Pending clone apply._

---

## Gate A re-validation (auto-updated)

_Pending Gate A run._

---

## Safety

| Guard | Implementation |
|-------|----------------|
| Clone DB only | `^ledger_stage_[0-9]{8}$` in `remediation-env-guard.mjs` |
| Production blocked | Rejects `postgres` DB name |
| Apply confirm | `REMEDIATION_APPLY_CONFIRM=1` |
| Dry-run hash | SHA256 manifest in dry-run JSON |
| Audit trail | `party_repair_audit` per row |
| Idempotent | `WHERE contact_id IS NULL` / `WHERE branch_id IS NULL` |

---

## Out of scope

- Production DB mutation
- Phase 1.5 migration apply to `postgres`
- `unified_ledger_engine` ON
- Phase 2 UI / Batch A / JALIL parity
- AR/AP reclass, opening balance edits, void/reverse

See [`SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md`](./SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md) for production proposal (no execution).
