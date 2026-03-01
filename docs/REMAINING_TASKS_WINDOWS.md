# Remaining Tasks – Windows par complete karne ke steps

**Last updated:** Feb 2026  
**Purpose:** GitHub se clone ke baad Windows par remaining tasks complete karne ka guide.

**MacBook / VPS:** Agar aap Mac ya Linux par migrations/apply kar rahe ho to **`docs/REMAINING_TASKS_APPLY_ON_MACBOOK.md`** use karein (migration order + immutable runner).

---

## 1. Clone & setup (Windows)

```powershell
# Git Bash ya PowerShell
cd C:\Users\<YourName>\Documents
git clone https://github.com/NDM0313/NEWPOSV3.git
cd NEWPOSV3
```

### Environment

- `.env.local` banao (root folder mein). Copy from `.env.example` if exists, ya add:
  - `VITE_SUPABASE_URL` = your Supabase URL (e.g. https://erp.dincouture.pk)
  - `VITE_SUPABASE_ANON_KEY` = your anon key
- Dependencies: `npm install`

### Run app

```powershell
npm run dev
```

Browser: http://localhost:5173

---

## 2. Remaining tasks checklist (priority order)

### High priority

| # | Task | File/Location | Steps (Windows) |
|---|------|----------------|-----------------|
| 1 | **DNS (Hostinger)** | Hostinger panel | A records add karein: `erp`, `supabase`, `studio` → VPS IP (72.62.254.176). 5–30 min propagation. |
| 2 | **Domain deploy (DNS ke baad)** | VPS | `ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy-erp-domain.sh"` (WSL ya Git Bash se) |
| 3 | **User / Branch access FK fix verify** | App + DB | Settings → User Management → Edit User → Branch Access → Save. Agar error aaye to `migrations/rpc_assign_user_branches_fk_fix.sql` Supabase SQL Editor mein run karein. |

### Medium priority

| # | Task | Steps |
|---|------|--------|
| 4 | **Realtime WebSocket 403** | Supabase .env mein JWT_SECRET / ANON_KEY match karein; ya `./utils/generate-keys.sh` (WSL/Git Bash) |
| 5 | **n8n hardening** | n8n ko 127.0.0.1:5678 par bind karein (internal only) |
| 6 | **Cutover / Go-live** | `CUTOVER_PLANNING.md` aur `GO_LIVE_CHECKLIST.md` follow karein |

### Low / optional

| # | Task | Steps |
|---|------|--------|
| 7 | **Database advisors** | Supabase Dashboard → Advisors – search_path warnings fix (optional) |
| 8 | **Daily backup cron** | VPS par backup script + cron set karein |
| 9 | **RLS isolation test** | User A vs User B – different companies/branches test |

---

## 3. Windows-specific notes

- **SSH:** Use Git Bash, WSL, ya PuTTY. `ssh dincouture-vps` ke liye `~/.ssh/config` (Git Bash: `C:\Users\<You>\.ssh\config`) mein host add karein.
- **Node:** LTS version install karein (e.g. 18 or 20). `node -v` se check.
- **Migrations (local DB):** Agar local Supabase use kar rahe ho to `npx supabase db push` ya SQL files manually SQL Editor mein run karein.
- **VPS migrations:** `deploy/run-migrations-vps.sh` VPS par run hota hai (Linux). Windows se: `ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/run-migrations-vps.sh"`.

---

## 4. Important files (reference)

| File | Purpose |
|------|---------|
| `migrations/rpc_assign_user_branches_fk_fix.sql` | User branch access FK fix – run on Supabase/VPS DB |
| `docs/USER_ACCESS_SETTINGS_FULL_REPORT.md` | User/branch access flow + troubleshooting |
| `docs/USER_ACCESS_SETTINGS_VERIFY.sql` | RPC verify queries |
| `.cursor/rules/vps-ssh.mdc` | VPS SSH host: `dincouture-vps` |
| `REMAINING_TASKS_ANALYSIS.md` | Full remaining tasks analysis |
| `docs/MACBOOK_SETUP_AND_REMAINING_TASKS.md` | MacBook + mobile tasks (same list, different OS) |

---

## 5. Quick commands (Git Bash / WSL)

```bash
# Pull latest
git pull origin main

# Install and run
npm install
npm run dev

# VPS deploy (SSH config must be set)
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy-erp-domain.sh"
```

---

**Note:** Agar koi task complete ho jaye to isi file mein us task ko ✅ mark karke commit/push kar den.
