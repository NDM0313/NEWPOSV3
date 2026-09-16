# NEW POSV3 — Full Project Analysis and Graphify Status

**Analysis date:** 2026-08-24  
**Project:** Din Collection ERP / NEW POSV3  
**Working directory:** `C:\Users\ndm31\dev\Corusr\NEW POSV3`  
**Git branch:** `main`  
**Git HEAD at analysis time:** `d9f51627310f87f90978ac9a040d831db7fe979f`

## 1. Executive Summary

NEW POSV3 is a large, production-oriented, multi-tenant and branch-scoped ERP/POS system. It contains a React/Vite web application, a React/Vite/Capacitor mobile application, and a shared Supabase backend.

The system covers sales, purchases, POS, inventory, products, accounting, payments, expenses, contacts, rentals, studio production, manufacturing, bespoke work orders, packing, shipping/courier, reporting, permissions, and multi-currency import/FX workflows.

Supabase is the central backend and source of truth. The frontend TypeScript services communicate directly with Supabase tables, SQL RPCs, authentication, storage, and realtime services. No separate conventional Node/Express API server was identified.

Accounting is a central dependency of the ERP. Its canonical model is based on double-entry journals using `accounts`, `journal_entries`, and `journal_entry_lines`. Operational modules such as sales, purchases, payments, expenses, rentals, studio, returns, and shipping feed accounting records into this model.

## 2. Technology Stack

### Web application

- React 18.3
- TypeScript
- Vite
- React Context API
- Tailwind CSS
- Radix UI
- MUI
- shadcn-style reusable UI components
- Lucide React
- React Hook Form
- Zod
- Recharts
- jsPDF and jspdf-autotable
- XLSX
- html2canvas
- Tesseract.js

### Mobile application

- React
- TypeScript
- Vite
- Capacitor
- Shared Supabase backend
- Native/mobile barcode workflows
- Offline state and synchronization support
- PIN and counter-based workflows

### Backend and database

- Supabase PostgreSQL
- Supabase Authentication
- Supabase Storage
- Supabase Realtime
- Row Level Security policies
- SQL RPC functions
- Database triggers
- A large SQL migration history

## 3. High-Level Architecture

```text
Web React/Vite Application
          |
          |-- TypeScript services
          |-- Supabase JavaScript client
          |
Mobile React/Vite/Capacitor Application
          |
          |-- Mobile API/service layer
          |-- Supabase JavaScript client
          |
          v
Supabase
  |-- PostgreSQL tables
  |-- SQL RPC functions
  |-- Triggers
  |-- Authentication
  |-- Storage
  |-- Realtime
  `-- Row Level Security
```

The web and mobile applications use the same backend and broadly share the same company, branch, permission, accounting, and operational data model.

## 4. Web Application Composition

The main web composition root is `src/app/App.tsx`.

### Provider hierarchy

The application composes its global behavior through a deep provider hierarchy:

```text
ThemeProvider
  `-- FeatureFlagProvider
      `-- PermissionV2ThemeSync
          `-- SupabaseProvider
              `-- ProtectedRoute
                  |-- WebRealtimeBridge
                  `-- GlobalFilterProvider
                      `-- ModuleProvider
                          `-- AccountingProvider
                              `-- ErrorBoundary
                                  `-- SettingsProvider
                                      `-- SalesProvider
                                          `-- PurchaseProvider
                                              `-- RentalProvider
                                                  `-- ExpenseProvider
                                                      `-- ProductionProvider
                                                          `-- LoadingProvider
                                                              `-- NavigationProvider
                                                                  `-- Suspense
                                                                      `-- AppContent
```

This hierarchy provides authentication, permissions, feature flags, module access, realtime behavior, global filters, accounting state, module-specific state, navigation, loading state, and error boundaries.

### Navigation model

Most internal navigation is view-state based rather than conventional URL routing. `NavigationContext` exposes a `currentView`, and `App.tsx` conditionally renders the selected module.

Examples of view targets include:

- Dashboard
- Products
- Sales
- Purchases
- POS
- Accounting
- Reports
- Contacts
- Rentals
- Studio
- Inventory
- Settings
- Users

Some specialized pages are handled using pathname checks, including Import FX demos, contact registration, accounting administration/developer pages, and test routes.

### Performance behavior

Large module screens are lazy-loaded with React `lazy()` and rendered under `Suspense`. This reduces the initial bundle cost and separates major feature areas.

## 5. Main Business Modules

### Dashboard

Provides executive and operational metrics, summaries, business health data, and navigation into detailed reports.

### Sales and POS

Handles direct sales, POS transactions, invoices, drafts, customer assignment, payments, returns, cancellation, stock effects, commissions, and accounting posting.

### Purchases

Handles supplier purchasing, purchase items, payable balances, payments, stock receipt, edit/repost workflows, and purchase accounting.

### Products and inventory

Covers product setup, SKU and barcode data, images, inventory movement, branch stock visibility, valuation, stock adjustment, and import workflows.

### Accounting

Provides the chart of accounts, journal entries, journal lines, account ledgers, trial balance, balance sheet, profit and loss, day book/Roznamcha, financial tracing, reconciliation, and integrity tooling.

### Payments and expenses

Handles receipts, supplier payments, expenses, account transfers, posting/reversal, and synchronization with journals and party balances.

### Contacts

Maintains customers, suppliers, workers, and related party balances and ledger views.

### Rentals

Supports rental orders, pickup/return flows, rental payments, related inventory behavior, and rental accounting.

### Studio production

Contains production workflows, worker assignment, receive/complete stages, production costs, studio sales, and accounting integration. Multiple versions are selected through feature flags.

### Reports

Includes operational and financial reporting, charts, date and branch filtering, PDF export, spreadsheet export, and printable views.

### Other active domains

- Manufacturing
- Bespoke work orders
- Packing
- Shipping and courier workflows
- Sales commission workflows
- Unified Ledger
- AR/AP reconciliation
- Import FX and multi-currency supplier settlement
- Backup and restore
- User and permission administration

## 6. Accounting Model

The canonical accounting chain is:

```text
accounts
  `-- journal_entry_lines
          `-- journal_entries
```

Operational modules post balanced debit and credit lines into journal entries. This journal-based model is consumed by account ledgers, trial balance, profit and loss, balance sheet, day book, party reconciliation, and financial trace tools.

Primary accounting consumers include:

- Sales
- Purchases
- Payments
- Expenses
- Refunds and sale returns
- Studio production
- Rentals
- Shipment/courier workflows

The repository also contains legacy, unified, effective-state, shadow, preview, repair, and reconciliation paths. Any future accounting change must first identify the canonical write path and canonical read model to avoid duplicate posting or parity issues.

## 7. Multi-Tenancy, Branches, and Permissions

### Company isolation

Business records are scoped by `company_id`. Company context must be preserved in frontend queries, RPC calls, and database policies.

### Branch isolation

Branch-specific operations use `branch_id`. User access to branches is represented through structures such as `user_branches`, together with global branch filters and permission checks.

### Permissions

Permissions are loaded from role-based structures such as `role_permissions`. The frontend uses permission checks to control visibility and interaction, while database Row Level Security is the required enforcement boundary.

### Module controls

The application supports company-wide module enable/disable controls and feature flags. Disabled modules render dedicated disabled states. Feature flags also select newer module implementations, especially in Studio Production.

## 8. Service Layer

`src/app/services` is the main web business/service layer. It includes services for:

- Journal and accounting operations
- Unified ledger reads and transformations
- AR/AP reconciliation and repair
- Sales and purchase accounting
- Product and inventory operations
- Payments and expenses
- Rentals
- Studio Production V1/V2/V3
- Dashboard and reports
- Permissions
- Import FX
- Backup and restore

These services generally call Supabase directly or invoke PostgreSQL RPC functions. Consequently, changes often span UI components, TypeScript services, SQL functions/triggers, RLS policies, and migrations.

## 9. Mobile Application

The mobile application is located under `erp-mobile-app` and uses React, Vite, and Capacitor.

Its source structure contains:

- `api/`
- `components/`
- `config/`
- `context/` and `contexts/`
- `features/barcode/`
- `hooks/`
- `lib/`
- `App.tsx`

Major mobile capabilities include:

- POS
- Sales
- Purchases
- Products
- Inventory
- Contacts
- Accounts and reports
- Rentals
- Studio workflows
- Settings
- Barcode scanning
- Offline state/synchronization
- PIN login and counter workflows

The mobile application shares the Supabase backend and must remain aligned with web permission, branch, and accounting behavior.

## 10. Database and Migrations

The repository has a large SQL migration history, primarily under `migrations`, with additional Supabase-specific migrations under `supabase/migrations`.

Migration domains include:

- Unified Ledger
- AR/AP parity and reconciliation
- Contact balances
- Payment and journal synchronization
- Numbering
- Studio Production
- Rentals
- Bespoke workflows
- Inventory
- Storage and RLS
- Backup and restore
- Import FX and multi-currency accounting

More than 200 migration files were visible during inspection; the search output reached its result limit. Migration order and existing production state must be checked before adding or applying database changes.

## 11. Build, Development, and Tests

Important root scripts include:

```text
npm run build
npm run dev
npm run dev:no-migrate
npm run migrate
npm run health
npm run health-report
npm run inventory-health
npm run test:unit
npm run test:unified-ledger
npm run test:permissions
npm run mobile:dev
```

`npm run dev` attempts to run migrations in allow-fail mode before starting Vite. Mobile scripts synchronize environment configuration and provide development and Android APK build flows.

Dedicated tests and health checks exist for unit behavior, permissions, Unified Ledger, Import FX, inventory, and database/application health.

## 12. Graphify Analysis

### Graph locations

Graphify outputs were found at:

- `graphify-out`
- `erp-mobile-app/graphify-out`
- `src/app/features/import-fx-case/graphify-out`
- `src/graphify-out`

### Root graph statistics

The root `graphify-out/GRAPH_REPORT.md` reports:

- Generated: 2026-08-15
- Base commit: `e0c0b7e4`
- Files: 6,705
- Approximate words: 6,334,808
- Nodes: 166,100
- Edges: 564,308
- Communities: 4,725
- Extracted edges: 94%
- Inferred edges: 6%

### Freshness status

The root graph was generated from commit `e0c0b7e4`, while the repository HEAD at analysis time was `d9f51627310f87f90978ac9a040d831db7fe979f`.

**Result: the root Graphify graph is stale relative to the current repository.**

The update command documented by the project is:

```bash
graphify update .
```

This command was not executed during the read-only analysis.

### Graph quality observations

The largest reported graph nodes include minified-style names:

- `t()` — 5,391 edges
- `D` — 4,165 edges
- `K` — 3,034 edges
- `A()` — 2,386 edges
- `TC()` — 1,682 edges

These symbols, together with very low community cohesion, indicate that generated, bundled, cached, or minified content is adding substantial noise to the root graph.

Useful named communities are still present, including:

- `LedgerHub()`
- `journalEntryAccountPair()`
- `AddEntryV2Host()`
- `mapUnifiedTrialBalanceToBalanceSheetMain()`
- `MoneyFlowSummaryBar()`
- `openJournalQuickEdit()`

### Current ignore configuration

The root `.graphifyignore` currently excludes:

```text
**/node_modules/**
**/build/**
**/.dart_tool/**
**/.vscode/**
**/ios/Pods/**
**/android/.gradle/**
```

Future Graphify maintenance should first identify generated/minified directories that are safe to exclude, update `.graphifyignore`, and then regenerate the graph. No ignore rules were changed during this analysis.

### Project Graphify rules

The repository rules require agents to:

1. Read the root graph report before answering architecture/codebase questions.
2. Prefer the Graphify wiki when `graphify-out/wiki/index.md` exists.
3. Run `graphify update .` after code changes.

No root Graphify wiki was found during this analysis.

## 13. Git Workflow and Repository State

The official workflow defines:

- `main` as the working branch and single source of truth
- Push before switching machines
- Pull before starting work on another machine
- No force push
- No manual merge workflow
- No routine branch switching
- VPS deployment only from `main`
- Do not merge, delete, or deploy `archive-vps-mobile-2026`
- Preserve the emergency tag `pre-integration-safe-point`

At analysis time:

- Current branch: `main`
- Local branch was aligned with its origin
- HEAD: `d9f51627310f87f90978ac9a040d831db7fe979f`
- Two unrelated untracked MCP configuration files existed under `.continue/mcpServers`
- Those untracked files were not modified, staged, deleted, or committed

## 14. Important Paths

```text
src/app/App.tsx                         Main web composition root
src/app/components/                    Module-based web UI
src/app/services/                      Web business and Supabase service layer
src/app/features/                      Isolated/newer feature areas
erp-mobile-app/src/                    Mobile application source
migrations/                            Main SQL migration history
supabase/migrations/                   Additional Supabase migrations
graphify-out/                          Root knowledge graph output
docs/                                  Architecture, module, audit, and handoff documents
GIT_WORKFLOW_RULES.txt                  Official Git workflow rules
.graphifyignore                        Graphify exclusion rules
.cursor/rules/graphify.mdc              Graphify usage rules
```

## 15. Key Risks and Change Guidelines

1. **Accounting duplication risk:** Confirm the canonical journal write path before changing sales, purchases, payments, returns, expenses, rentals, or studio posting.
2. **Legacy/unified overlap:** Several legacy, unified, shadow, effective-state, and repair paths coexist. Do not modify a similarly named service without tracing its callers and database objects.
3. **Web/mobile parity:** Permission, branch, transaction, and accounting changes may require equivalent mobile updates.
4. **RLS enforcement:** Frontend permission checks are not sufficient; database policies and RPC behavior must remain company and branch safe.
5. **Migration safety:** Review existing migration order and live object definitions before introducing a replacement function, trigger, or policy.
6. **Graph freshness:** Refresh Graphify before relying on it for current-code impact analysis.
7. **Graph noise:** Improve exclusions only after verifying that ignored paths are generated outputs and not source-of-truth code.
8. **Navigation behavior:** Most web screens are selected through `currentView`; adding a module may require navigation context, layout/menu, permission, and module-gate updates rather than only a URL route.
9. **Provider dependencies:** Components may depend on several nested contexts. Provider order must be preserved unless the dependency chain is fully traced.
10. **Repository workflow:** Work on `main`, avoid force push, and do not touch unrelated untracked files.

## 16. Recommended Context for the Next Task

Before implementing the next task:

1. Identify the exact module and entry screen.
2. Trace its component, context, service, Supabase query/RPC, and database objects.
3. Check company, branch, permission, and feature/module gates.
4. For financial effects, verify balanced journal posting and reversal/edit behavior.
5. Check whether the mobile application implements the same workflow.
6. Review relevant migrations and existing module documentation.
7. Refresh or narrowly validate Graphify if impact analysis depends on current graph data.
8. Make only the requested focused change and run the relevant existing checks.

## 17. Analysis Conclusion

The project is a broad ERP platform rather than a small POS-only application. Its most important architectural anchors are Supabase, company/branch scoping, permission/RLS enforcement, the journal-based accounting core, service-to-RPC integration, and web/mobile parity.

The repository is ready for the next focused development task. The root Graphify report is useful for high-level discovery but must be treated as stale and noisy until it is updated against the current HEAD and its generated/minified inputs are reviewed.
