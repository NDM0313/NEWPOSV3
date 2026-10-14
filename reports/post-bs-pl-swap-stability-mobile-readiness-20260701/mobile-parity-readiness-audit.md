# Mobile parity readiness audit

**Generated:** 2026-07-01  
**Mode:** Readiness / planning only — no APK release

## Mobile app folders

| App | Path | Role |
|-----|------|------|
| **Capacitor ERP** | `erp-mobile-app/` | Primary production mobile (PWA + APK) |
| **Flutter ERP** | `erp-flutter-app/` | Parallel native client |
| **Expo POS** | `POS/` | Out of scope for GL report parity |

## Production web unified state (post BS/P&L swap)

Web `src/` serves all pilot reports via unified main loaders when flags ON:

- Ledger V2, Account Statement, Trial Balance, Party Ledger / Roznamcha — **live**
- Cash Flow — **live** (unchanged this run)
- Balance Sheet, P&L — **live unified** @ `db499995`

## Capacitor (`erp-mobile-app`) — current report screens

**Hub:** `src/components/accounts/reports/ReportsHub.tsx` — operational reports (party ledgers, daybook, cash/bank/wallet summaries, sales/purchase/expense, etc.)

**Partial GL parity:**

- `PartyLedgerReport.tsx` — customer/supplier/worker party ledgers
- `AccountLedgerReport.tsx` — account-level ledger (not full Account Statement unified)
- `AccountsModule.tsx` — routes `LegacyReportKey` reports only

**Missing vs web unified:**

- Ledger V2 unified screen
- Trial Balance
- Cash Flow statement
- Balance Sheet
- Profit & Loss
- Unified loader flag resolution (`unified_ledger_loader_*`) — **not consumed on mobile**

**Data source:** Direct Supabase (`api/reports.ts`, `api/accounts.ts`) — same backend as web; mobile does not mirror web BS/P&L unified mappers yet.

## Flutter (`erp-flutter-app`)

- `ErpScreen.reports` → **placeholder** (`module_navigation.dart` pushes `/dashboard`)
- `ErpScreen.ledger` → `journal_list_screen.dart`, `contact_ledger_screen.dart`
- No TB / Cash Flow / BS / P&L screens
- Rental AR sub-ledger: `rental_booking_accounting.dart` — documented parity target with Capacitor booking flow

## Print / share

- Capacitor: branded PDF helpers (`getCompanyBrand`), attachment actions, WhatsApp share patterns in accounting modules
- `docs/PWA_VS_NATIVE_LIMITS.md` — print limits on PWA vs native APK

## APK / release docs

- `docs/MOBILE_RELEASE_PLAN.md`
- `docs/infra/MOBILE_APK_LOCKED_PATTERN.md`
- `docs/ANDROID_APK_BUILD.md` (referenced from release plan)

## Gap summary

Mobile is **behind web** on unified financial statements. BS/P&L swap on web does not automatically flow to mobile — implementation required with operator approval.
