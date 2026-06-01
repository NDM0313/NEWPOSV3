# Mobile Phase 8C — Counter Settings Unfreeze (Deployment Log)

**Date:** 2026-05-25  
**Scope:** `erp-mobile-app` only — koi DB migration ya Supabase auth change nahi.

## Masla kya tha?

Owner jab **All Branches** view par hota tha, Settings → Counter & lock screen mein **Counter tablet PIN** row bilkul nazar nahi aati thi. Sirf Shared Counter Mode toggle dikhta tha jo **0 enrolled** par disabled rehta — is liye screen "frozen" lagti thi.

## Kya fix hua?

1. **`branchOk` gate hata diya** — ab `companyId` hone par Counter section hamesha clickable hai, chahe branch **All** ho ya koi specific branch.
2. **Naya `CounterPinEnrollModal`** — Admin koi bhi **active employee** list se choose karke usko 4-digit Counter PIN assign kar sakta hai. Branch worker ki Employee Management assignment se aati hai (All Branches par bhi).
3. **Pehla enroll = Shared Counter Mode auto ON** — jab tablet par pehli dafa koi worker enroll hota hai, Shared Counter Mode khud enable ho jata hai.
4. **Zero-state hint** — 0 enrolled par message batata hai ke Counter tablet PIN tap karke enroll karein.

## Files

| File | Badlav |
|------|--------|
| `SettingsCounterSection.tsx` | `branchOk` remove; zero-state CTA |
| `SettingsModule.tsx` | Inline modal hata kar `CounterPinEnrollModal` wire |
| `CounterPinEnrollModal.tsx` | Naya — employee + branch + PIN |
| `employees.ts` | `resolveAuthUserIdForEmployee` export |

## Verify (tablet par)

1. Owner login → branch **All Branches** select karein.
2. Settings → Counter & lock screen → **Counter tablet PIN** tap karein.
3. Employee choose karein, branch confirm karein, 4-digit PIN save karein.
4. Enrolled count barh jana chahiye; Shared Counter Mode **On** ho jana chahiye.
5. Temporary lock / logout ke baad lock screen par enrolled workers dikhne chahiye.

## Build check

```bash
npm run typecheck:mobile
```

## Deploy note

APK rebuild + tablet install tab jab user push/deploy confirm kare. Is phase mein sirf client-side UI/registry change hai — VPS par alag migration ki zaroorat nahi.
