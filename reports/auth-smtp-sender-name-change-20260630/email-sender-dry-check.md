# Email sender dry check

**Status:** PASS (infra) — inbox display not verified by automation

| Check | Result |
|-------|--------|
| Test email | `k***+sender-name-20260630@gmail.com` |
| Signup HTTP | **200** |
| Auth action | `user_confirmation_requested` |
| Company created | **No** |
| Test user cleanup | **Deleted** |

Container confirms `GOTRUE_SMTP_SENDER_NAME=NDM ERP SYSTEM`. Operator may verify inbox **From** / display name shows **NDM ERP SYSTEM** for the ~12:10 UTC message.
