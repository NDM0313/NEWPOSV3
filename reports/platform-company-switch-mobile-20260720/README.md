# Platform company switch (Mobile) — 2026-07-20

## Scope

- Mobile Developer / Super Admin picks any active company after login
- One company at a time via `platform_company_session` (home `users.company_id` unchanged)
- Approval: `APPROVE_PLATFORM_COMPANY_SWITCH_RPC`

## Delivered

| Layer | Change |
|-------|--------|
| Migration | [`migrations/20260720190000_platform_company_session_switch.sql`](../../migrations/20260720190000_platform_company_session_switch.sql) |
| Mobile roles | `developer` / `super_admin` kept; engine maps to admin |
| API | [`erp-mobile-app/src/api/platformCompany.ts`](../../erp-mobile-app/src/api/platformCompany.ts) |
| UI | `CompanySelection` → branch → Home with company name + Switch company |
| Local vault | IndexedDB permission deny soft-fails (PIN vault / offline queue) so blocked browsers do not spam uncaught errors |

## Production apply

| Item | Result |
|------|--------|
| Enum `developer` / `super_admin` | added |
| Table `platform_company_session` | created + own-row RLS |
| `get_user_company_id` COALESCE override | applied |
| `is_owner_or_admin` / `is_admin_or_owner` | include platform operator |
| RPCs list/set/clear/get/effective | applied |
| Note | `is_admin_or_owner` owned by `supabase_admin` — recreate used that role |
| GitHub | `e7b9743c` feature + `1d3ef17b` vault soft-fail |
| VPS frontend deploy | `deploy/vps-build-erp-only.sh` — `/m/` 200 |
| Operator role | `ndm313@yahoo.com` → `developer` (home DIN BRIDAL) |

## Smoke (VPS SQL, restored)

| Check | Result |
|-------|--------|
| Platform elevate → list companies | **4** active |
| Switch DIN BRIDAL / DIN COUTURE | `get_user_company_id` matches |
| Clear → home company | restored |
| Normal admin `list_platform_companies` | **ACCESS_DENIED** |
| Test user role after smoke | restored to **admin** |
| Session rows left | **0** |

## How to use (one account only)

1. Open https://erp.dincouture.pk/m/ (or local http://localhost:5174/)
2. Hard refresh (Ctrl+Shift+R)
3. Login as the platform `developer` user
4. **Select company** → branch → work / post entries
5. Home → **Switch company** to change tenant

Do **not** create a Developer user in every company — one platform role is enough.

```sql
UPDATE public.users
SET role = 'developer'
WHERE lower(email) = 'ndm313@yahoo.com';
```

## Non-goals (unchanged)

- Web company switcher UI
- Global RLS bypass
- Play Store / IPA commit
- Permanent rewrite of `users.company_id` on switch
