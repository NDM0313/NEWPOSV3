# Operator inbox instructions — Phase B prep

**Generated:** 2026-06-30

## Gmail account

Log into **`khan5955@gmail.com`** (base inbox). The signup address **`khan5955+1@gmail.com`** is a plus-alias — mail delivers to this same inbox.

## Search queries

Use Gmail search:

```
to:khan5955+1@gmail.com
```

```
from:noreply@dincouture.pk
```

```
"NDM ERP SYSTEM"
```

```
newer_than:1d
```

Combined example:

```
to:khan5955+1@gmail.com from:noreply@dincouture.pk newer_than:1d
```

## Also check

- **Spam**
- **Promotions**
- **Updates**

## Expected email

- **From display name:** NDM ERP SYSTEM
- **From address:** noreply@dincouture.pk
- **Content:** 6-digit verification code (or verification link)

## After you find the code

1. Copy the **6-digit OTP** (or use the verification link in Phase B if supported).
2. In `erp-mobile-app/.env` (local only — **do not commit**):

   ```powershell
   $env:QA_CREATE_BUSINESS_OTP_CODE = "<6-digit-from-inbox>"
   ```

3. Run **Phase B** — verify OTP, complete business creation, bootstrap cleanup.

## Security

- Do **not** paste OTP or password into git, commits, or chat logs.
- Auth user `23cf3957-6d21-411e-8595-3084cf665c9e` is retained until Phase B completes or operator cancels.
