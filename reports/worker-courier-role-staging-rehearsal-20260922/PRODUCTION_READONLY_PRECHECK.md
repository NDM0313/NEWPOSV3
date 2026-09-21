# Production read-only precheck

Executed against live DB name `postgres` with **SELECT only**.

| Check | Result |
|------|--------|
| DHL/KIRAN/SHAHMIM types | still `supplier` |
| Target WA/WP/203x for those three | **0** |
| Role-model assert function present | **false** (migration not applied) |
| Dual-account cleanup | remains closed (not reopened this phase) |

**production mutations: NONE**  
**production migration: NOT EXECUTED**  
**production deploy: NO**
