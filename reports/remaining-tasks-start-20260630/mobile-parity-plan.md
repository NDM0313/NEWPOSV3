# Mobile parity plan

**Status:** PLAN ONLY — no mobile release  
**Generated:** 2026-06-30

## Backlog

1. Rental AR sub-ledger on mobile booking flow
2. Unified ledger RPC/service parity with web loaders
3. Create Business OTP wizard on `erp-mobile-app`
4. APK rebuild after Supabase contract alignment

## APIs / screens to align

| Web unified surface | Mobile target |
|---------------------|---------------|
| Party Ledger V2 unified main | `erp-mobile-app` ledger screens |
| Account Statement unified | reporting module |
| Trial Balance unified | reporting module |
| Cash Flow unified (live on web) | after finance parity sign-off |

## Golden contact checks

- DIN CHINA: MR JALIL closing vs web monitoring golden
- DIN BRIDAL / COUTURE: roznamcha + party ledger samples from operational monitoring

## APK / build QA

1. `npm run sync:mobile-env` — production URL/anon key only
2. Capacitor sync → Android per workspace rules
3. Read-only login smoke (no GL mutations)
4. Compare one party closing to web

## Approval

No APK publish without explicit operator approval.
