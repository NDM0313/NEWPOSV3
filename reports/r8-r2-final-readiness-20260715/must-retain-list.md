# Must-Retain List (post–R8-R2 approved deletion)

These remain after successful A1+A2 deletion. Not failures.

| Item | Why retained |
|------|----------------|
| Shadow compare services (×5) | Admin Compare / monitoring diagnostics |
| `getCustomerLedger` hybrid | Contacts / Ledger hybrid; Phase 8 not started |
| Contacts `get_contact_party_gl_balances` | Outside R8-R2; official_gl parity reference |
| Mobile legacy fallthrough | Separate mobile program |
| Resolvers (8+) | Kill/flag → source routing; L0 rollback contract |
| Engine state + feature flags | Production flag/kill control plane |
| Kill-switch (DB + env) | L0 rollback without code revert |
| L1 rollback SQL (~36) | Flag restore without GL mutation |
| Loader guard + monitor scripts | Production integrity checks |
| Dashboard-consumed report APIs | Shared TB/BS/P&L cash helpers |
| AR/AP Phase 2b services | Extension; official_gl parity already complete |
| BS/P&L error fallback (if deferred) | Safety until second wave |
| Pre-R8 tags + r8-r2-pre tag (created on exec day) | L2 rollback |

Intentionally retained ≠ incomplete R8-R2 for main-loader thin wrappers / page branches.
