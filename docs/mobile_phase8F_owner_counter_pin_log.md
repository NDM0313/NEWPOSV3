# Mobile Phase 8F — Owner/Admin Login PIN → Counter Tile Fix (Deployment Log)

**Date:** 2026-05-25  
**Scope:** `erp-mobile-app` only — koi DB migration nahi.

## Masla

Owner/admin jab pehli dafa login karke **Set PIN** karta tha:
- 4-digit PIN device unlock ke sath counter PIN bhi honi chahiye thi
- Lekin owner ke paas aksar **All Branches** / no profile branch hoti hai → counter enroll **skip** ho jata tha
- Counter save hone ke baad bhi **shared counter mode** auto-on nahi hota tha
- POS lock / counter sign-in par **owner ka tile show nahi** hota tha

## Kya fix hua

| Fix | Badlav |
|-----|--------|
| Shared helper | `counterPinFromDevicePin.ts` — `shouldOfferCounterPinSync`, `finalizeCounterWorkerEnrollment` |
| Owner/admin branch | Counter offer bina concrete branch ke (branch optional in registry) |
| Shared mode | Pehli enroll par `setSharedCounterModeEnabled(true)` + `setLastCounterCompanyId` |
| UI refresh | `counter-registry-updated` event — CounterLoginPanel, POSLockScreen, LoginScreen refresh |
| SetPinModal | Wahi rules Settings → Set Quick PIN par bhi |

## Offer rules

| Role | 4-digit PIN | Counter offer |
|------|-------------|---------------|
| owner/admin | yes + companyId | hamesha (branch optional) |
| manager/worker | yes + companyId | sirf jab assigned branch ho (not `all`) |

## Tablet par verify

1. Owner login → Set PIN (4 digits) → "Yes, save counter PIN"
2. Settings → Counter & lock screen → 1 enrolled (owner naam)
3. Shared counter mode auto **On**
4. POS lock / login counter panel → owner tile + "Owner (system)"
5. Owner tile se unlock → Settings mein **Company** section dikhe
6. Worker (assigned branch) → pehle jaisa branch required

## Build

```bash
npm run typecheck:mobile
```

## Files

- `counterPinFromDevicePin.ts` (new)
- `LoginScreen.tsx`, `SetPinModal.tsx`
- `CounterLoginPanel.tsx`, `POSLockScreen.tsx`
