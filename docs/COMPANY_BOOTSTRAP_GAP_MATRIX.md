# Company bootstrap — module gap matrix

Auto-generated from `src/app/config/companyBootstrapRegistry.ts`.

| Module | modules_config | Wizard | Settings toggles | Sidebar gated | Category | Notes |
|--------|----------------|--------|------------------|---------------|----------|-------|
| sales | modules_config | yes | yes | yes | both |  |
| purchases | modules_config | yes | yes | yes | both |  |
| rentals | modules_config | yes | yes | yes | both |  |
| pos | modules_config | yes | yes | yes | both |  |
| studio | modules_config | yes | yes | yes | both |  |
| production | modules_config | yes | yes | yes | both | Manufacturing nav group; often enabled with studio |
| accounting | modules_config | yes | yes | yes | both |  |
| expenses | modules_config | yes | yes | yes | both |  |
| payroll | placeholder | yes | yes | — | both | Stored in modules_config; no dedicated sidebar route yet |
| reports | modules_config | yes | yes | yes | both | Gates Reports nav; still requires reports.view permission |
| combos | modules_config | — | yes | — | settings_only | Settings-only; inventory feature flag companion |

## Company fields (non-module)

| Field | Wizard step | Settings tab | RPC param | Surfaces |

|-------|-------------|--------------|-----------|----------|

| businessName | 1 | company | — | wizard, settings, rpc |
| businessType | 1 | company | p_business_type | wizard, settings, rpc |
| phone | 1 | company | p_phone | wizard, settings, rpc |
| address | 1 | company | p_address | wizard, settings, rpc |
| country | 1 | company | p_country | wizard, settings, rpc |
| timezone | 1 | company | p_timezone | wizard, settings, rpc |
| currency | 2 | accounting | p_currency | wizard, settings, rpc |
| fiscalYearStart | 2 | accounting | p_fiscal_year_start | wizard, settings, rpc |
| accountingMethod | 2 | accounting | p_accounting_method | wizard, settings, rpc |
| taxMode | 2 | accounting | p_tax_mode | wizard, settings, rpc |
| defaultTaxRate | 2 | accounting | p_default_tax_rate | wizard, settings, rpc |
| costingMethod | 3 | inventory | p_costing_method | wizard, settings, rpc |
| allowNegativeStock | 3 | inventory | p_allow_negative_stock | wizard, settings, rpc |
| defaultUnit | 3 | inventory | p_default_unit | wizard, settings, rpc |
| branchName | 5 | branches | p_branch_name | wizard, settings, rpc |
| branchCode | 5 | branches | p_branch_code | wizard, settings, rpc |

## Product rules

- **modules_config**: absent row or `is_enabled = false` → module off in Settings and sidebar (when sidebarGated).
- **Wizard** writes only selected modules as `is_enabled = true` via `create_business_transaction` (`p_modules`).
- **Permissions** (`*.view`) still apply for nav items marked permissions_only or in addition to module toggles.
