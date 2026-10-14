# SMTP input validation

**Status:** `BLOCKED_MISSING_SMTP_CONFIG`  
**Generated:** 2026-06-30

## Required operator SMTP inputs

| Field | Required | Found |
|-------|----------|-------|
| SMTP host | Yes | **MISSING** |
| SMTP port | Yes | **MISSING** |
| SMTP username | Yes | **MISSING** |
| SMTP password / app password | Yes | **MISSING** |
| SMTP sender / admin email | Yes | **MISSING** |
| SMTP sender name | Optional | **MISSING** |

## Sources checked (no secrets printed)

1. **`erp-mobile-app/.env`** — contains monitoring QA credentials only; no `SMTP_*` or `GOTRUE_SMTP_*` variables.
2. **VPS non-interactive SSH shell** — no `SMTP_*` or `GOTRUE_SMTP_*` environment variables present.

## Action

Per run constraints: **STOP**. Did **not** change `ENABLE_EMAIL_AUTOCONFIRM` / `GOTRUE_MAILER_AUTOCONFIRM`. Production auth remains on fake internal SMTP with autoconfirm enabled.

## Operator next step

Export real SMTP settings in a secure VPS or local shell session only, for example:

```powershell
$env:SMTP_HOST = "smtp.example.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "..."
$env:SMTP_PASS = "..."   # app password — never commit
$env:SMTP_ADMIN_EMAIL = "noreply@dincouture.pk"
$env:SMTP_SENDER_NAME = "DIN Collection ERP"
```

Then re-run **PRODUCTION AUTH OTP INFRA FIX** with operator approval.
