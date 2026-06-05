# COA & Accounting Developer Center

Documentation hub for the unified **Accounting Developer Center** — diagnose Chart of Accounts, trace transactions, and safely repair GL issues from inside the ERP.

**Phase B (shipped):** Read-only UI — COA Health + Transaction Trace at `/admin/accounting-developer-center`. No repairs.

**Phase C (planned):** Report trace tabs — see [05_PHASE_C_IMPLEMENTATION_PLAN.md](05_PHASE_C_IMPLEMENTATION_PLAN.md).

## Documents

| File | Contents |
|------|----------|
| [00_EXISTING_TOOLS_AUDIT.md](00_EXISTING_TOOLS_AUDIT.md) | Inventory of all developer/accounting tools, services, SQL scripts — keep / improve / archive verdicts |
| [01_CHART_OF_ACCOUNTS_AUDIT.md](01_CHART_OF_ACCOUNTS_AUDIT.md) | COA schema, hierarchy, module mappings, safety rules, health checks |
| [02_ACCOUNTING_FLOW_MAP.md](02_ACCOUNTING_FLOW_MAP.md) | 20 accounting flows UI → DB → Roznamcha / Statement / Day Book / Dashboard |
| [03_DEVELOPER_CENTER_SPEC.md](03_DEVELOPER_CENTER_SPEC.md) | 10-tab Developer Center spec, permissions, RPCs, implementation phases |
| [04_PHASE_B_IMPLEMENTATION_PLAN.md](04_PHASE_B_IMPLEMENTATION_PLAN.md) | Phase B plan: files, routes, access, services, rollback (read-only shell) |
| [05_PHASE_C_IMPLEMENTATION_PLAN.md](05_PHASE_C_IMPLEMENTATION_PLAN.md) | Phase C plan: Roznamcha/Statement/Day Book trace tabs (read-only only) |

## Quick recommendation

**Shipped (Phase B):** COA Health + Transaction Trace (read-only).

**Build next (Phase C):** Roznamcha Trace → Statement Trace → Day Book diagnostics.

**Keep separate:** AR/AP Reconciliation Center, Numbering Maintenance, System Health.

**Do not touch:** GL posting RPCs, void/reversal logic, numbering generation, company reset scripts.
