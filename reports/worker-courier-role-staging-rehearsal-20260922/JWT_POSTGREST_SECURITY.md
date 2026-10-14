# JWT / PostgREST security — staging

**Marker:** `STAGING_JWT_COMPANY_ISOLATION_PASS`

## Stack

| Item | Value |
|------|--------|
| Auth | `http://127.0.0.1:18083` (GoTrue) |
| REST | `http://127.0.0.1:18082` (PostgREST) |
| DB | `ledger_stage_20260922_prodcheck` only |
| Identities | Company A + Company B GoTrue users linked via `public.users` |

Tokens/passwords not recorded.

## Matrix

| Call | Company A JWT | HTTP |
|------|---------------|------|
| WA / WP / courier ensure (Co A) | PASS | 200 |
| party GL (Co A) | PASS | 200 |
| WA/WP/courier/resolver/GL (Co B) | DENY | 403 |
| Co B account count before/after | unchanged (121) | — |
| Anon WA ensure | DENY | 401 |

Cross-company bodies include privilege / forbidden mapping (PostgREST 403 ↔ SQLSTATE 42501 class).

## Production

No JWT tests against `supabase.dincouture.pk` / live Kong for this gate.
