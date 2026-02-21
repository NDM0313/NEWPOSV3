# Final Cutover Window Planning

**Status:** ✅ Pre-cutover complete – Ready for cutover window execution  
**Prerequisite:** Day 4 Certification ✅ → ERP Integration Test Block ✅ (all done)

---

## Pre-Cutover Checklist

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | Day 4 Certification complete | QA | [x] |
| 2 | ERP Integration Test Block complete | QA | [x] |
| 3 | RLS validated (all 5 steps) | Dev | [x] |
| 4 | Backup of current production data | Ops | [x] |
| 5 | Cutover window scheduled (date/time) | PM | [x] |
| 6 | Rollback plan documented | Dev | [x] |

---

## Cutover Window Steps

### Phase 1 – Freeze (T-30 min)

- [ ] Announce freeze to users
- [ ] No new transactions in legacy system (if applicable)
- [ ] Final data export from legacy (if migrating)

### Phase 2 – Data Sync (T-0 to T+2h)

- [ ] Run migration scripts (if any)
- [ ] Verify `public.users` ↔ `auth.users` mapping
- [ ] Verify `company_id` on all scoped tables
- [ ] Run `DAY4_QUICK_VERIFICATION.sql` (or equivalent)

### Phase 3 – Validation (T+2h to T+4h)

- [ ] Login as each company admin
- [ ] RLS Validation page – all steps pass
- [ ] Day 4 flows: Purchases, Rentals, Expenses
- [ ] ERP Integration: Sales, Accounting, Reports
- [ ] No console errors, no 500s

### Phase 4 – Go-Live (T+4h)

- [ ] Enable access for all users
- [ ] Monitor Supabase logs (first 24h)
- [ ] Support channel ready for issues

---

## Rollback Plan

If critical issues found during validation:

1. Revert to previous deployment (if app deploy)
2. Restore DB backup (if schema/data changed)
3. Communicate to users
4. Post-mortem and reschedule cutover

---

## Post-Cutover (First 7 Days)

- [ ] Daily log review (Supabase → Logs)
- [ ] Security advisors check (`mcp_supabase_get_advisors`)
- [ ] User feedback collection
- [ ] Performance baseline (response times, RLS overhead)

---

## Quick Reference

- **RLS Validation:** Test Pages → RLS Validation  
- **Day 4 Certification:** Test Pages → Day 4 Certification  
- **ERP Integration Test:** Test Pages → ERP Integration Test  
- **Cutover Prep:** Test Pages → Cutover Prep (pre-cutover checklist + phases)  
- **Supabase Logs:** Dashboard → Logs (api, auth, postgres)
