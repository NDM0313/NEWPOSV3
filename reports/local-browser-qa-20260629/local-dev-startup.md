# Local dev startup — Local Browser QA

**Generated:** 2026-06-29

---

## Dev server

| Item | Value |
|------|--------|
| Command | `npm run dev` |
| URL | `http://localhost:5173` |
| Status | Running (pre-existing terminal session) |

---

## App load

| Check | Result |
|-------|--------|
| App loads | **Yes** |
| Title | Modern ERP POS System |
| Material console errors | **No** (observed during QA navigation) |
| Auth session (initial) | **Authenticated** (DIN CHINA company context) |

---

## Routes exercised

- `/reports/ledger-statement-center-v2` — Account Statements / Ledger V2
- `/` — Login page (after logout)
- `/` — Create Business wizard (unauthenticated flow)

---

## Notes

- Logout from user menu (`D` → Logout) returned to login page successfully.
- After Create Business submit test, session entered **no-business** onboarding state (see create-business-otp report).
