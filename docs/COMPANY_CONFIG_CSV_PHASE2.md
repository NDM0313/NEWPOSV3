# Phase 2: Company config CSV import / export

Design note for migrating data from other software and comparing with this ERP. **Not implemented in Phase 1.**

## Scope

| Dataset | Table / store | Export | Import |
|---------|---------------|--------|--------|
| Company profile | `companies` | yes | merge by `company_id` |
| Module toggles | `modules_config` | yes | replace rows for company |
| Key-value settings | `settings` (`accounting_settings`, `inventory_settings`, …) | yes (JSON in CSV cell) | patch by key |
| Branches | `branches` | optional separate file | optional |

## Export format

- One row per `company_id`, or one file per company in a ZIP.
- Columns: `company_id`, `business_name`, `business_type`, `currency`, `timezone`, …, `modules_json`, `settings_json`.
- `modules_json`: array of `{ "module_name": "rentals", "is_enabled": true }` aligned with [companyBootstrapRegistry.ts](../src/app/config/companyBootstrapRegistry.ts).

## Import rules

1. Validate against registry module names and known `settings` keys.
2. **Merge policy** (configurable): `replace_all` vs `patch_only` for `modules_config`.
3. Admin-only RPC or Settings UI action; audit log row per import.
4. Never import auth users/passwords via CSV in v1.

## Comparison workflow (user goal)

1. Export from external system to their CSV layout.
2. Export from this ERP (`export company bootstrap`).
3. Diff tool (spreadsheet or future in-app) on module list + fiscal/tax fields.
4. Import adjusted CSV into ERP.

## Registry reference

Module and field parity is defined in `src/app/config/companyBootstrapRegistry.ts`. Regenerate gap matrix:

```bash
node scripts/generate-bootstrap-gap-report.mjs
```
