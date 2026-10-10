# SMTP input validation — Hostinger noreply

**Status:** PASS  
**Generated:** 2026-06-30

## Required fields

| Field | Expected | Found |
|-------|----------|-------|
| `SMTP_HOST` | `smtp.hostinger.com` | **OK** |
| `SMTP_PORT` | `587` | **OK** |
| `SMTP_USER` | `noreply@dincouture.pk` | **OK** |
| `SMTP_PASS` | set (not printed) | **OK** (len=12) |
| `SMTP_ADMIN_EMAIL` | `noreply@dincouture.pk` | **OK** |
| `SMTP_SENDER_NAME` | `DIN Collection ERP` | **OK** |

Source: secure operator shell session. Password not logged or committed.

## Action

Proceed with VPS `/root/supabase/docker/.env` update and `supabase-auth` restart.
