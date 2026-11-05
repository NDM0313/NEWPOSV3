# 00 — Master Context: DIN Collection ERP Flutter Migration

## What this is

This documentation set prepares a **Flutter migration** for the **DIN Collection / DIN Couture old/live ERP** mobile client. The live mobile app today is [`erp-mobile-app/`](../../erp-mobile-app/) — a **Capacitor + WebView** shell wrapping a Vite/React app. The Flutter app will be a **new native client** against the **same Supabase backend** as the web ERP ([`src/`](../../src/)).

## Business domain

| Area | Description |
|------|-------------|
| **Industry** | Clothing, bridal, formal wear, wholesale |
| **Core ops** | Sales invoices, POS, purchases, inventory, contacts (customers/suppliers/workers) |
| **Specialized** | **Rentals** (dress booking, returns, devaluation), **Studio production** (worker stages, job cards, post-bill GL), **Bespoke** work orders |
| **Logistics** | Packing lists, shipment/cargo tracking |
| **Finance** | Double-entry GL, AR/AP party sub-ledgers, payments, expenses, reports |

Operations are **branch-based**: most documents carry `company_id` + `branch_id`. Salesmen typically work one branch; admins may see all branches.

## Roles (behavioral summary)

Mapped in [`erp-mobile-app/src/config/functionalRoles.ts`](../../erp-mobile-app/src/config/functionalRoles.ts):

| App role | Engine role | Typical behavior |
|----------|-------------|------------------|
| `owner` | `owner` | Full bypass (RLS + permissions) |
| `admin` | `admin` | Full company access; all branches |
| `manager` | `manager` | Branch/company visibility per `role_permissions` |
| `salesman`, `staff`, `cashier`, etc. | `user` | Often `view_own` — own sales/contacts only |

**Counter / shared POS mode** ([`sharedCounterMode.ts`](../../erp-mobile-app/src/lib/sharedCounterMode.ts)): device PIN + worker switch; effective `created_by` / salesman for scoping.

## Backend is source of truth

Flutter must **not** implement a parallel business logic layer:

- **Numbers** (SL-, PUR-, PAY-, RCV-, EXP-) → server RPC `generate_document_number` or document-create RPCs
- **Stock** → `ensure_sale_stock_movements`, purchase finalize paths, inventory RPCs
- **GL / journals** → `record_sale_with_accounting`, `record_payment_with_accounting`, `record_expense_with_accounting`, `record_purchase_with_accounting`
- **Visibility** → Postgres RLS + `role_permissions` (client filters are UX only)

Canonical migrations: [`migrations/`](../../migrations/). Web service patterns: [`src/app/services/`](../../src/app/services/).

## Infrastructure (production)

| Endpoint | Use |
|----------|-----|
| `https://erp.dincouture.pk` | **Native mobile API base** (nginx → Kong; CORS for `capacitor://localhost`) |
| `https://supabase.dincouture.pk` | Direct Supabase (web PWA / browser) |
| Anon key | Same as root `.env.production` / Kong `ANON_KEY` |

Locked pattern: [`docs/infra/MOBILE_APK_LOCKED_PATTERN.md`](../../docs/infra/MOBILE_APK_LOCKED_PATTERN.md).

Flutter Android must use **`https://erp.dincouture.pk`** as Supabase URL (not `window.location`, not raw `supabase.dincouture.pk` on native without verifying CORS).

## Repository boundaries

| In scope | Out of scope |
|----------|--------------|
| This repo (`NEWPOSV3`) | Multi-currency **exchange app** (only mentioned in settings docs; no separate client here) |
| Same `public.users`, RPCs, RLS | New GL rules, schema drops, production VPS changes |
| New folder `erp-flutter-app/` (assumed) | Rewriting Capacitor app in place |

## Planned Flutter location

**Assumption:** sibling app at repo root:

```
NEWPOSV3/
  erp-mobile-app/     ← current Capacitor (keep until Flutter parity)
  erp-flutter-app/    ← new Flutter project (Phase 1+)
  src/                ← web ERP
  migrations/         ← canonical DB
```

## Documentation index

| Doc | Purpose |
|-----|---------|
| [01_EXISTING_APP_AUDIT.md](01_EXISTING_APP_AUDIT.md) | Capacitor app audit |
| [02_MODULES_AND_SCREEN_MAP.md](02_MODULES_AND_SCREEN_MAP.md) | Module → screen mapping |
| [03_DATABASE_SCHEMA_AND_RPCS.md](03_DATABASE_SCHEMA_AND_RPCS.md) | Tables & RPC catalog |
| [04_PERMISSIONS_RLS_RULES.md](04_PERMISSIONS_RLS_RULES.md) | RBAC & RLS |
| [05_OFFLINE_SYNC_RULES.md](05_OFFLINE_SYNC_RULES.md) | Offline queue design |
| [06_PRINTING_BARCODE_DEVICE_RULES.md](06_PRINTING_BARCODE_DEVICE_RULES.md) | Print, barcode, devices |
| [07_UI_UX_DESIGN_RULES.md](07_UI_UX_DESIGN_RULES.md) | Mobile UI patterns |
| [08_TESTING_QA_CHECKLIST.md](08_TESTING_QA_CHECKLIST.md) | QA checklist |
| [09_MIGRATION_PHASE_PLAN.md](09_MIGRATION_PHASE_PLAN.md) | Phased rollout |
| [10_PRODUCTION_RELEASE_CHECKLIST.md](10_PRODUCTION_RELEASE_CHECKLIST.md) | Release gates |
| [11_AGENT_NEXT_STEPS.md](11_AGENT_NEXT_STEPS.md) | Phase 1 agent prompt |

## Open questions

1. **Flutter repo location:** `erp-flutter-app/` in this monorepo vs separate Git repo?
2. **iOS:** Capacitor ships iOS; is Flutter v1 **Android-only** (Sunmi focus)?
3. **Counter/PIN mode:** Phase 1 vs Phase 6 parity?
4. **Live RPC versions:** Confirm VPS applied migrations match latest `202606*` bodies before Phase 3 money modules.
5. **Bespoke / packing:** v1 Flutter or post-MVP?

## Agent rule

When implementing Flutter, trust **`erp-mobile-app/src/App.tsx`** and **`erp-mobile-app/src/api/*`** over outdated README module lists. README still lists several modules as "Coming soon" but they are implemented.
