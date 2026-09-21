# Staging reconciliation — status

## This phase

**NOT EXECUTED** on `ledger_stage_*` clone.

Reasons:

1. Owner asked for forensic + design + package **previews** and explicit **STOP before production mutation**.
2. Production clone `ledger_stage_20260919_prodcheck` predates Hafiz `210126` repair and later JE voids; a **fresh clone** is required before package dry-runs.
3. Worker/courier packages need owner review of `HISTORICAL_LINE_CLASSIFICATION.csv` heuristics before staging apply.

## Planned staging protocol (next gated phase)

1. `CLONE_DB=ledger_stage_YYYYMMDD_party_roles bash scripts/single-core-ledger/create-vps-ledger-clone.sh`
2. Apply packages **one at a time** on clone only (IBRAHIM schemas untouched).
3. Per party prove: TB balanced; JE headers unchanged; no new PAY; balances match preview BEFORE/AFTER; DHL ≠ DHL PK.
4. UI smoke on staging HTTP if available, else SQL-only acceptance.
5. Evidence → update this file → then owner phrase for production.

## Placeholder results

| Party | Staging status |
|-------|----------------|
| ID LACE | PENDING — expected no-op line moves |
| KIRAN | PENDING |
| SHAHMIM | PENDING |
| DHL | PENDING |
| DHL PK | PENDING |

**Does not block** design approval / CSV review. **Blocks** production package apply.
