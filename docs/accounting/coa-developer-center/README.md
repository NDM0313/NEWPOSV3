# COA & Accounting Developer Center

Documentation hub for the unified **Accounting Developer Center** — diagnose Chart of Accounts, trace transactions, and safely repair GL issues from inside the ERP.

**Phase B (shipped):** Read-only UI — COA Health + Transaction Trace at `/admin/accounting-developer-center`. No repairs.

**Phase C (complete):** Report trace tabs C2–C6 shipped. See [06_PHASE_C_COMPLETION.md](06_PHASE_C_COMPLETION.md).

**Phase D (complete):** Repair Queue dry-run + confirm-gated sequence sync. See [07_PHASE_D_COMPLETION.md](07_PHASE_D_COMPLETION.md).

**Phase E (complete):** Opening Balance preview + Audit Log read-only. See [08_PHASE_DE_COMPLETION.md](08_PHASE_DE_COMPLETION.md).

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

**Build next (Phase C, after Phase B merge):** C1 tab shells → Roznamcha Trace → Statement Trace → Day Book Diagnostics → Payment Trace → Journal Integrity (browse-only). One PR per step.

**Keep separate:** AR/AP Reconciliation Center, Numbering Maintenance, System Health.

**Do not touch:** GL posting RPCs, void/reversal logic, numbering generation, company reset scripts.
