# Email delivery check

| Check | Finding |
|-------|---------|
| Verification email to operator inbox | **Not received** (expected with current SMTP) |
| `GOTRUE_MAILER_AUTOCONFIRM` | **true** — email marked confirmed without inbox verification |
| SMTP | `supabase-mail` / `fake_sender` — not production Gmail delivery |
| Plus-address `k***+1@gmail.com` | **Accepted** — auth + company created |
| Resend OTP | **Not tested** (autoconfirm bypassed OTP phase) |

Operator should check Spam/Promotions only after real SMTP is configured.
