# ERP Project – Tasks Status

**Last updated:** Feb 2025

---

## ✅ COMPLETED

### RLS & Validation
- [x] RLS Validation Page (JWT, users mapping, company isolation)
- [x] Day 4 Full Flow Certification (Purchases, Rentals, Expenses)
- [x] ERP Integration Test Block (12-module checklist)
- [x] Cutover Prep Page (pre-cutover checklist, phases, rollback)
- [x] INSERT/UPDATE/DELETE policy tests (optional in RLS Validation)

### Bug Fixes
- [x] Expense edit 400 error – removed `vendor_name` mapping in ExpenseContext

### Production Deploy
- [x] Dockerfile (multi-stage build + nginx)
- [x] docker-compose.prod.yml
- [x] nginx.conf, Caddyfile, nginx-ssl.conf
- [x] supabase-backup.sh
- [x] PRODUCTION_DEPLOY.md, PRODUCTION_SERVICE.md
- [x] DOMAIN_ROUTING_FIX.md, CRITICAL_DNS_FIX.md
- [x] SUPABASE_BACKUP_RESTORE.md
- [x] GO_LIVE_CHECKLIST.md

### Migration
- [x] MIGRATION_PLAN_LARAVEL_TO_SUPABASE.md
- [x] migration_mapping.csv, export_mysql.sh, import_staging.sql
- [x] validate_totals.sql

### Mobile Responsive
- [x] Responsive Test Page (`/test/responsive`)
- [x] Tables: `overflow-x-auto` (PurchasesPage, RentalOrdersList)
- [x] Sheets: `w-full max-w-full` on mobile (AddExpenseDrawer, ExpensesDashboard)
- [x] Sheet base component: mobile-friendly defaults
- [x] docs/RESPONSIVE_CHECKLIST.md
- [x] Viewport meta tag (already present)

### DNS & Hostinger
- [x] Hostinger MCP added to Cursor
- [x] DNS A record fix – removed duplicate erp (kept 154.192.0.160)
- [x] deploy/add-erp-dns-hostinger.sh (API script)
- [x] deploy/DNS_FIX_INSTRUCTIONS.md

### VPS Hardening
- [x] deploy/vps-harden-and-verify.sh
- [x] deploy/VPS_HARDENING_GUIDE.md
- [x] deploy/diagnose-erp.sh, deploy/fix-erp-routing.sh

### Swarm & SSL
- [x] deploy/deploy-erp-swarm.sh
- [x] deploy/docker-compose.swarm.yml
- [x] deploy/one-shot-deploy.sh
- [x] deploy/production-ssl-erp-fix.sh
- [x] deploy/DEPLOY_ERP_ON_VPS.md

---

## ⏳ REMAINING

### VPS Deployment (manual – SSH required)
- [ ] Copy project to VPS: `scp -r NEWPOSV3 root@VPS_IP:/root/`
- [ ] Or clone: `git clone https://github.com/NDM0313/NEWPOSV3.git`
- [ ] Build ERP image with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- [ ] Deploy erp-frontend Swarm service with Traefik labels
- [ ] Run `deploy/production-ssl-erp-fix.sh` on VPS
- [ ] Verify: `curl -I https://erp.dincouture.pk` → HTTP/2 200

### DNS (if using different VPS IP)
- [ ] Confirm erp.dincouture.pk → correct VPS IP (154.192.0.160 or 72.62.254.176)
- [ ] Update Hostinger DNS if needed

### n8n Hardening
- [ ] Run n8n with `-p 127.0.0.1:5678:5678` (internal only)
- [ ] Verify: `ss -lntp | grep 5678` shows 127.0.0.1

### Post-Go-Live
- [ ] Run GO_LIVE_CHECKLIST.md
- [ ] RLS isolation test (User A vs User B)
- [ ] End-to-end: Login → Purchases → Rentals → Expenses
- [ ] Daily backup cron

---

## Quick Commands

```bash
# On VPS – deploy ERP
cd /root/NEWPOSV3
export VITE_SUPABASE_ANON_KEY="..."
./deploy/one-shot-deploy.sh

# On VPS – SSL & routing fix
./deploy/production-ssl-erp-fix.sh

# Verify
curl -I https://erp.dincouture.pk
```
