# Worker payable stabilization report

## Surfaces (different bases)

| Surface | Meaning | Typical source |
|--------|---------|----------------|
| **Workers Management — Pending Payments** | Sum of **unpaid** `worker_ledger_entries` per worker (studio operational) | `studioService.getWorkersWithStats` |
| **Studio Production Costs** | Stage **cost** fields on productions — operational / job costing, not a single GL line | `studio_production_stages`, etc. |
| **GL Worker Payable 2010** | Net posted liability from journals in period | Trial Balance / control account |
| **GL Worker Advance 1180** | Net posted asset (advances) | Same |
| **Contacts worker payables** | `get_contact_balances_summary` for `type = worker` | Worker ledger unpaid or `workers.current_balance` fallback |

## Why numbers disagree

- **Pending Payments (ledger)** is a **subset** of studio workflow — not full company-wide payroll or every GL posting to **2010**.  
- **2010** includes journals that may not mirror a single row in `worker_ledger_entries`.  
- Do **not** show a fake “AR/AP-style residual” implying one number should equal another without a defined reconciliation bridge.

## What we changed (additive)

- **Workers Management:** Footnote that pending total is **unpaid worker ledger** (studio operational), not GL **2010**.  
- **Contacts:** Worker payables note vs AP **2000** (already in reconciliation messaging).  
- **Code:** `getSingleWorkerPartyReconciliation` remains available for per-worker operational vs party GL.

## Optional next step (not required for stabilization)

- A **drawer** combining **2010**, **1180**, party GL, and unpaid ledger for one worker — additive UI only.

## Verdict

- **Worker operational vs GL parity:** **PARTIAL** — labels explicit; full parity would require a dedicated reconciliation workflow, not a single total.
