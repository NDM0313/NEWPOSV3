# Password rotation closure — QA browser monitoring users

**Run:** OPERATIONAL MONITORING SCHEDULE + INCIDENT RUNBOOK + PASSWORD ROTATION CLOSURE  
**Generated:** 2026-06-14T00:00:00Z  
**Status:** `PASSWORD_ROTATION_REQUIRED`

---

## Background

Browser QA passwords for production monitoring were used in manual chat and screenshot workflows during rollout. Even though passwords were **not committed to git**, rotation is required for hygiene before long-term scheduled monitoring.

---

## Affected QA users

| Company | Default monitoring email | Auth action |
|---------|------------------------|-------------|
| DIN CHINA | `din@yahoo.com` | Rotate password in ERP/Supabase Auth |
| DIN BRIDAL | `ndm313@yahoo.com` | Rotate password in ERP/Supabase Auth |
| DIN COUTURE | `zhd@dincouture.pk` | Rotate password in ERP/Supabase Auth |

If per-company overrides are used (`QA_BROWSER_EMAIL_*`), rotate the **actual** user bound to each company.

---

## Required actions

1. **Rotate** each monitoring user password in production auth (operator + admin).  
2. **Update local env vars only** — `QA_BROWSER_PASSWORD_CHINA`, `QA_BROWSER_PASSWORD_BRIDAL`, `QA_BROWSER_PASSWORD_COUTURE` (or secret store used by Task Scheduler wrapper).  
3. **Never commit** new passwords to git, docs, reports, or logs.  
4. **Rerun** `npm run monitor:three-company-unified-ledger` — expect PASS.  
5. **Record** completion in this file's manifest (`rotation_completed: true`) when done — separate ops commit optional.

---

## Status (this run)

| Field | Value |
|-------|-------|
| `rotation_required` | **true** |
| `rotation_completed` | **false** (not performed in this automated run) |
| `post_rotation_monitoring_status` | **pending** |

Monitoring docs and scheduling guides are **not blocked** — rotation is operator action.

---

## After rotation checklist

- [ ] DIN CHINA password rotated  
- [ ] DIN BRIDAL password rotated  
- [ ] DIN COUTURE password rotated  
- [ ] Local env / Credential Manager updated  
- [ ] `npm run monitor:three-company-unified-ledger` PASS  
- [ ] Old passwords invalidated  

---

## Constraints

- No passwords in git  
- No passwords printed in monitoring output (runner redacts secrets)  
- Rotation does not require migrations, flag changes, or GL mutations
