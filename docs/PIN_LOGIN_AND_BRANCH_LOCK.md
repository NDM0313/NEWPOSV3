# PIN Login & Branch Lock

## Flow

1. **First login** — email + password
2. **Create PIN** — optional 4–6 digits (can skip, set later in Settings)
3. **Next opens** — PIN only (no email/password)
4. **Forgot PIN** — "Use password instead" → full login

## Storage

| Target | Storage |
|--------|---------|
| PWA | IndexedDB + AES (crypto-js fallback when `crypto.subtle` unavailable) |
| APK/iOS | Same (IndexedDB in WebView) — Capacitor Secure Storage optional future |

Stored: encrypted `refresh_token`, `userId`, `companyId`, `branchId`, `email`.

## Branch Lock

- If user has `branchLocked` (from profile / user_branch):
  - Branch selector **disabled**
  - Branch forced from `user.branchId`
- Admin users: can select "All Branches" or specific branch

## UI Screens

- **LoginScreen** — email/password or PIN unlock
- **Set PIN** — after first login (or from Settings)
- **Change PIN** — Settings → Change PIN
- **Remove PIN** — Settings → Remove PIN
- **Forgot PIN** — "Use password instead" link on PIN screen

## Files

- `erp-mobile-app/src/lib/secureStorage.ts` — PIN hash, encrypt/decrypt
- `erp-mobile-app/src/api/auth.ts` — `setPinWithPayload`, `verifyPinAndUnlock`, `changePin`
- `erp-mobile-app/src/components/LoginScreen.tsx` — login + PIN UI
- `erp-mobile-app/src/components/settings/ChangePinModal.tsx`
- `erp-mobile-app/src/components/settings/SetPinModal.tsx`
- `erp-mobile-app/src/components/BranchSelection.tsx` — branch lock logic
