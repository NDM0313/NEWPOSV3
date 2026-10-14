# Reporting validation (staging)

| Surface | Result |
|---------|--------|
| Rehearsal JE TB (STAGING_REHEARSAL*) | Balanced (diff 0) |
| Account ledger WA/WP/203x | Entries present for KIRAN/SHAHMIM/DHL rehearsal |
| Historical AP lines | Unchanged (202 lines; fp `e2d8dbaf79042b661d354a95d1980d3e`) |
| Customers & Suppliers filter | After type flip, contacts are worker/courier — merchandise supplier list should exclude (client filter already shipped; full UI not smoked) |
| Worker party GL | JWT `get_contact_party_gl_balances` same-company OK |
| Unified courier ledger | Remains **PARTIAL** (usability); accounting posts discoverable via Account Ledger 203x — **not** classified production blocker for Strategy A |

Browser screenshots: unavailable (`BROWSER_UI_ROLE_SMOKE_UNAVAILABLE`).
