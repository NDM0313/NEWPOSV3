# COA & Accounting Developer Center

Documentation hub for the unified **Accounting Developer Center** — diagnose Chart of Accounts, trace transactions, and safely repair GL issues from inside the ERP.

**Phase B (shipped):** Read-only UI — COA Health + Transaction Trace at `/admin/accounting-developer-center`. No repairs.

**Phase C (complete):** Report trace tabs C2–C6 shipped. See [06_PHASE_C_COMPLETION.md](06_PHASE_C_COMPLETION.md).

**Phase D (complete):** Repair Queue dry-run + confirm-gated sequence sync. See [07_PHASE_D_COMPLETION.md](07_PHASE_D_COMPLETION.md).

**Phase E (complete):** Opening Balance preview + Audit Log read-only. See [08_PHASE_DE_COMPLETION.md](08_PHASE_DE_COMPLETION.md).

**Phase F (complete):** Controlled repair registry, confirm-gated apply, audit log. See [09_CONTROLLED_REPAIR_ACTIONS.md](09_CONTROLLED_REPAIR_ACTIONS.md).

## Documents

| File | Contents |
|------|----------|
| [00_EXISTING_TOOLS_AUDIT.md](00_EXISTING_TOOLS_AUDIT.md) | Inventory of all developer/accounting tools, services, SQL scripts — keep / improve / archive verdicts |
| [01_CHART_OF_ACCOUNTS_AUDIT.md](01_CHART_OF_ACCOUNTS_AUDIT.md) | COA schema, hierarchy, module mappings, safety rules, health checks |
| [02_ACCOUNTING_FLOW_MAP.md](02_ACCOUNTING_FLOW_MAP.md) | 20 accounting flows UI → DB → Roznamcha / Statement / Day Book / Dashboard |
| [03_DEVELOPER_CENTER_SPEC.md](03_DEVELOPER_CENTER_SPEC.md) | 10-tab Developer Center spec, permissions, RPCs, implementation phases |
| [04_PHASE_B_IMPLEMENTATION_PLAN.md](04_PHASE_B_IMPLEMENTATION_PLAN.md) | Phase B plan: files, routes, access, services, rollback (read-only shell) |
| [05_PHASE_C_IMPLEMENTATION_PLAN.md](05_PHASE_C_IMPLEMENTATION_PLAN.md) | Phase C plan: Roznamcha/Statement/Day Book trace tabs (read-only only) |
| [09_CONTROLLED_REPAIR_ACTIONS.md](09_CONTROLLED_REPAIR_ACTIONS.md) | Phase F action catalog and hard rules |
| [10_REPAIR_ACTION_REGISTRY.md](10_REPAIR_ACTION_REGISTRY.md) | Registry type contract and dry-run hash flow |
| [11_REPAIR_AUDIT_LOG.md](11_REPAIR_AUDIT_LOG.md) | `developer_repair_audit` schema and rollback notes |
| [12_PHASE_F_COMPLETION.md](12_PHASE_F_COMPLETION.md) | Phase F completion summary and manual checklist |
| [13_PHASE_F_PRODUCTION_SMOKE_TEST.md](13_PHASE_F_PRODUCTION_SMOKE_TEST.md) | Production/staging smoke test checklist with risk table |

## Quick recommendation

**Shipped (Phase F):** Controlled repair registry + Repair Queue apply from COA, trace tabs, Opening Balance.

**Before production apply:** Run migrations `20260606120000_*` and `20260606130000_*` on Supabase. Follow [13_PHASE_F_PRODUCTION_SMOKE_TEST.md](13_PHASE_F_PRODUCTION_SMOKE_TEST.md).

**Keep separate:** AR/AP Reconciliation Center, Numbering Maintenance, System Health.

**Do not touch:** GL posting RPCs, void/reversal logic, numbering generation, company reset scripts.
