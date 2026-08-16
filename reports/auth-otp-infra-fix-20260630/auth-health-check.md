# Auth service health check

**Config change applied:** No (blocked)  
**Generated:** 2026-06-30

## Baseline (unchanged production)

| Check | Result |
|-------|--------|
| `supabase-auth` container | **healthy** |
| `GET https://supabase.dincouture.pk/auth/v1/health` | **401** (endpoint reachable; key required) |
| `GET https://erp.dincouture.pk/` | **200** |
| Auth restart performed | **No** |
| Existing sessions invalidated | **No** (no restart) |

## Deferred checks (after SMTP fix)

- Existing production company login (DIN CHINA / BRIDAL / COUTURE)
- Post-restart auth 5xx scan
- Signup OTP dry-run without business creation

These require successful Task 4 before meaningful validation.
