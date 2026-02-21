# Remaining Tasks – Analysis (Feb 2026)

GitHub pull ke baad .md files ka analysis. Kya complete hai, kya remaining hai.

---

## ✅ COMPLETE (Jo ho chuka hai)

### Phase 3 (PHASE3_STATUS.md)
| Part | Status |
|------|--------|
| 1. Role & Permission | ✅ 100% |
| 2. Printer Config | ✅ 100% |
| 3. Error Handling | ✅ 100% |
| 4. Data Backup | ✅ 100% |
| 5. Performance (Lazy load) | ✅ 100% |
| 6. Build Safety | ✅ 100% |

### RLS & Security
- RLS on purchases, rentals, expenses ✅ (RLS_BLOCKER_RESOLUTION.md)
- Day 4 Certification ✅
- ERP Integration Test Block ✅

### VPS & Deploy (partially)
- ERP live on 72.62.254.176 ✅
- Docker + Traefik configured ✅
- Mobile design (Figma-style) ✅

---

## ⏳ REMAINING TASKS

### 1. DNS (Hostinger) – User action
- [ ] Add A records: `erp`, `supabase`, `studio` → `72.62.254.176`
- [ ] Wait 5–30 min propagation
- [ ] Run `ssh dincouture-vps "bash /root/NEWPOSV3/deploy-erp-domain.sh"`

**File:** `DNS_SETUP_INSTRUCTIONS.md`

---

### 2. Realtime WebSocket 403 (optional)
- [ ] Fix JWT_SECRET / ANON_KEY mismatch
- Option A: Set `JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long` in Supabase .env
- Option B: Generate new keys with `./utils/generate-keys.sh`

**Impact:** App works without Realtime; live updates won’t work until fixed.

---

### 3. n8n Hardening (TASKS_STATUS.md)
- [ ] Run n8n on `127.0.0.1:5678` only (internal)
- [ ] Verify: `ss -lntp | grep 5678` shows 127.0.0.1

---

### 4. Cutover Window (CUTOVER_PLANNING.md)
Agar formal go-live karna ho:

| Phase | Task | Status |
|-------|------|--------|
| 1 | Announce freeze, no new transactions | [ ] |
| 2 | Run migration scripts, verify users/company_id | [ ] |
| 3 | Login each admin, RLS validation, Day 4 flows | [ ] |
| 4 | Enable access, monitor logs | [ ] |
| Post | Daily log review, security advisors | [ ] |

---

### 5. Database Security (Supabase Advisor)
- [ ] RLS enable on remaining tables (products, contacts, sales, etc.)
- [ ] Fix ~50 functions: `search_path` mutable warning

**File:** Supabase Dashboard → Advisors

---

### 6. Post-Go-Live (TASKS_STATUS.md)
- [ ] Run GO_LIVE_CHECKLIST.md
- [ ] RLS isolation test (User A vs User B)
- [ ] E2E: Login → Purchases → Rentals → Expenses
- [ ] Daily backup cron on VPS

---

## Priority Order

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | DNS (erp.dincouture.pk) | 5 min | High – domain live |
| 2 | Deploy domain script after DNS | 2 min | High |
| 3 | Realtime fix | 15 min | Medium – live updates |
| 4 | n8n hardening | 5 min | Low – security |
| 5 | Post-go-live checklist | 30 min | Medium |
| 6 | RLS on remaining tables | 1–2 hr | Medium |

---

## Quick Commands

```bash
# DNS ke baad – domain deploy
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy-erp-domain.sh"

# Mobile design deploy (IP URL)
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy-erp-domain.sh"
# (deploy-erp-domain.sh uses supabase.dincouture.pk – for IP use manual build)
```
