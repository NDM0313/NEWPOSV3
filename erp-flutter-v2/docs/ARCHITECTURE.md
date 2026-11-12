# erp-flutter-v2 architecture

Greenfield Flutter ERP — see repo [`README.md`](../README.md) and master blueprint in Cursor plans.

## Layers

| Layer | Path | Role |
|-------|------|------|
| App | `lib/app/` | MD3 theme, go_router, locked Supabase config |
| Core | `lib/core/` | Auth roles, permissions, sync, shared widgets |
| Data | `lib/data/` | Models, repositories (RPC orchestration), offline queue |
| Features | `lib/features/` | Screens + Riverpod providers per module |
| Device | `lib/device/` | Barcode, print |

## Backend contract

All money/stock/GL logic stays on Postgres RPCs. Repositories call the same functions as [`erp-mobile-app/src/api/`](../../erp-mobile-app/src/api/).

**Sale finalize:** `ensure_sale_stock_movements` → `record_sale_with_accounting` → optional `record_payment_with_accounting`.

## State management

- **Riverpod** — session, lists (`FutureProvider`), cart (`StateNotifier` / local state on POS)
- **go_router** — auth redirect + module routes
- **SharedPreferences** — offline pending queue

## New in v2 vs pilot `erp-flutter-app`

- Package `com.dincouture.erp.flutter_v2`
- Dedicated **inventory** module (`/inventory`)
- **Reports hub** (`/reports`, sales/expense sub-reports)
- MD3 **AppDataTable**, **MoneyText**, bottom **NavigationBar** shell
- `docs/QA_ERP_FLUTTER_V2.md` + release scripts
