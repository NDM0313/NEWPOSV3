# Task Status — Complete vs Remaining

**Project:** ERP POS v1.0.0  
**Last updated:** Production release + VPS hardening + Supabase self-host plan

---

## ✅ COMPLETED TASKS

### Release & Build
| Task | Status | Notes |
|------|--------|--------|
| Version bump to 1.0.0 | ✅ Done | package.json |
| Production build success | ✅ Done | dist/ generated, no blocking errors |
| Migrations present (43, 44, 41, 45) | ✅ Done | supabase-extract/migrations/ |
| Migration 45 fix (DROP before CREATE) | ✅ Done | No return-type conflict |
| Final QA doc | ✅ Done | FINAL_QA_PRODUCTION_RELEASE.md |
| Release discipline doc | ✅ Done | RELEASE_DISCIPLINE.md |
| Staging checklist | ✅ Done | STAGING_CHECKLIST.md |

### UI & Formatting
| Task | Status | Notes |
|------|--------|--------|
| Currency engine centralized | ✅ Done | useFormatCurrency |
| Date engine centralized | ✅ Done | useFormatDate |
| SAFE UI modernization (Layout, Dashboard, Products, Sales) | ✅ Done | No business logic changed |
| Sales currency alignment | ✅ Done | SalesPage, ViewSaleDetailsDrawer, etc. |
| Products/EnhancedProductForm currency | ✅ Done | formatCurrency |
| ExpensesDashboard currency + date | ✅ Done | formatCurrency, formatDate |
| StockDashboard currency | ✅ Done | formatCurrency |

### VPS & Security
| Task | Status | Notes |
|------|--------|--------|
| Phase 1 – VPS hardening | ✅ Done | UFW: only 22, 80, 443 open |
| System update (apt upgrade) | ✅ Done | 26 packages upgraded |
| Firewall (UFW) active | ✅ Done | 5432, 3000, 5678, 8000 blocked |
| Security confirmation report | ✅ Done | docs/VPS_HARDENING_REPORT.md |
| vps-hardening-apply.sh script | ✅ Done | scripts/ |

### Documentation
| Task | Status | Notes |
|------|--------|--------|
| Production VPS deploy (Supabase Cloud) | ✅ Done | PRODUCTION_VPS_DEPLOY.md |
| Supabase self-host VPS guide | ✅ Done | SUPABASE_SELFHOST_VPS.md |
| Dry Run + Cutover plan | ✅ Done | In SUPABASE_SELFHOST_VPS.md |
| Day 1 Phase 1 execution steps | ✅ Done | Stack verify, extensions, auth/storage |
| VPS hardening runbook | ✅ Done | Phases 1–5, one-shot apply block |
| CTO-level pitfalls table | ✅ Done | Extensions, roles, policy, JWT |
| Phase 2 immediate step (clone + decision) | ✅ Done | Option A/B, Dry Run recommended |

---

## 🔄 REMAINING TASKS

### Staging & Go-Live
| Task | Status | Notes |
|------|--------|--------|
| Deploy dist/ to staging server | ⏳ Pending | HTTPS + staging DB |
| Full real workflow test (Sales, Purchase, Rental, Studio, Reports, Settings) | ⏳ Pending | Per STAGING_CHECKLIST.md |
| Console check (RPC, permissions, currency, NaN, status) | ⏳ Pending | During staging |
| Production DB backup before live | ⏳ Pending | When staging clean |
| Live deploy + 48h monitoring | ⏳ Pending | After staging sign-off |

### Supabase Self-Host (Phase 2+)
| Task | Status | Notes |
|------|--------|--------|
| Clone Supabase repo on VPS | ⏳ Pending | cd /root, git clone supabase, cd supabase/docker |
| .env configure (secrets, JWT) | ⏳ Pending | openssl rand -base64 32, etc. |
| Docker stack start (Supabase) | ⏳ Pending | docker compose up -d |
| Extensions + auth/storage schema verify | ⏳ Pending | Before any restore |
| Schema-only + data-only backup (Cloud) | ⏳ Pending | Phase 2 backup strategy |
| Restore (schema → functions → data) | ⏳ Pending | After verify |
| RLS + pg_policies + pg_proc verify | ⏳ Pending | Phase 3 |
| Frontend switch (new URL + anon key) | ⏳ Pending | Phase 4 |
| Dry Run full test | ⏳ Pending | Recommended before cutover |
| Final cutover (maintenance window) | ⏳ Pending | Backup → restore → DNS → monitor |

### Optional / Later
| Task | Status | Notes |
|------|--------|--------|
| Replace remaining hardcoded currency | ⏳ Optional | SettingsPageNew, Studio, ReturnModal, etc. |
| Replace toLocaleString with useFormatDate | ⏳ Optional | Where applicable |
| Table virtualization (heavy tables) | ⏳ Optional | Performance |
| Bundle size reduction | ⏳ Optional | Chunk splitting |
| Activity logging | ⏳ Optional | Audit trail |
| Android packaging (Capacitor) | ⏳ When ready | Per RELEASE_DISCIPLINE.md |
| Docker compose clean (3000/5678 internal only) | ⏳ Later | After Nginx reverse proxy |
| Reboot VPS (kernel 6.8.0-100) | ⏳ Optional | When convenient |

---

## 📌 Quick Reference

| Doc | Purpose |
|-----|--------|
| RELEASE_DISCIPLINE.md | Release rules, staged rollout, 72h rule |
| STAGING_CHECKLIST.md | Staging deploy + workflow test + console checks |
| SUPABASE_SELFHOST_VPS.md | Self-host setup, phases, Dry Run, Day 1 steps |
| FINAL_QA_PRODUCTION_RELEASE.md | QA checklist, migrations, build |
| PRODUCTION_VPS_DEPLOY.md | Frontend-only deploy (Supabase Cloud) |
| docs/VPS_HARDENING_REPORT.md | Post–Phase 1 security report |
| TASKS_STATUS.md | This file — complete vs remaining |

---

**Summary:** Release and VPS hardening complete. Staging tests, Supabase self-host stack (clone → env → start → verify → restore → frontend), and go-live steps remaining.
