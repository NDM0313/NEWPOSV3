# PERMISSION_MATRIX — Mobile (documented intent)

| Role | Reports / GL | Sales | Purchases | Expenses | Transfers | Notes |
|------|--------------|-------|-----------|----------|-----------|-------|
| Admin / full accounting | Hub reports when `requiresFullAccounting` | Yes | Yes | Yes | Yes | Company+branch from permissions RPC |
| Easy / limited | Customer ledger subset | Limited | No | Limited | No | `ReportHubMode` easy tier |
| Salesman | No unrestricted GL | Own / walk-in per policy | Typically no | Typically no | No | Must be RLS-backed |

## Enforcement

- UI gates in `AccountsModule` / `reportsHubCatalog` / PermissionContext
- Authoritative: Supabase RLS + RPC `SECURITY DEFINER` checks
- Negative tests for cross-company/branch/salesman: **not run this session** (Phase 5 remaining)

## Required negative tests (remaining)

1. Other company_id rejected  
2. Other branch_id rejected when scoped  
3. Salesman cannot open Trial Balance / full Account Ledger  
4. Forbidden finalize / post account rejected server-side  
