# Repo safety

**Branch:** `main` @ `a2a64496` (synced with origin/main)  
**Prior evidence:** `a2a64496` present  
**Staged:** none | **Credentials staged:** no

## Environment preflight

| Variable | Status |
|----------|--------|
| `QA_CREATE_BUSINESS_OTP_EMAIL` | Set — **rejected** (matches DIN CHINA production monitoring account `d***@yahoo.com`) |
| `QA_CREATE_BUSINESS_OTP_PASSWORD` | Set (not logged) |
| `QA_CREATE_BUSINESS_OTP_CODE` | **Not set** |

**Signup not attempted** — hard constraint forbids real production company emails (`din@yahoo.com`, `ndm313@yahoo.com`, `zhd@dincouture.pk`) and `admin@test.com`.

Use a **disposable dedicated test inbox** not tied to DIN CHINA / BRIDAL / COUTURE.
