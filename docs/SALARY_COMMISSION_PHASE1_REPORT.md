# Salary & Commission Approval Center — Phase 1 Report

**Date:** 2026-06-10  
**Scope:** Settings only — no payroll runs, GL posting, payments, or commission logic changes.

---

## 1. Files changed

### New

| File | Purpose |
|------|---------|
| `migrations/20260615120000_salary_settings_phase1.sql` | `salary_settings` table, RLS, migration backfill, RPC |
| `src/app/lib/payrollGenerationDate.ts` | Generation day 30 default; short months → last day |
| `src/app/types/payrollSettings.ts` | `DefaultPayrollSettings`, `SalarySettingsRow` types |
| `src/app/services/payrollSettingsService.ts` | CRUD for salary settings + default payroll settings |
| `src/app/components/settings/StaffAndPayrollTab.tsx` | Staff & Payroll settings UI |
| `docs/SALARY_COMMISSION_PHASE1_REPORT.md` | This report |

### Modified

| File | Change |
|------|--------|
| `src/app/components/settings/SettingsPageNew.tsx` | Renders `StaffAndPayrollTab`; header → “Staff & Payroll” |
| `src/app/components/settings/settingsNavigation.ts` | Nav label “Employees” → “Staff & Payroll” |
| `src/app/components/settings/EmployeesTab.tsx` | `phase1HidePaymentActions` prop; sync to `salary_settings` on add/update |

### Not touched (per scope)

- Commission posting (`commissionReportService`, `postCommissionBatch`)
- Commission batch payment (`commissionPaymentService`)
- Sales finalize commission capture
- GL / journal / payment posting
- Existing RLS on other tables
- Existing reports (except read-only account/user lookups in settings UI)

---

## 2. Migrations added

**`migrations/20260615120000_salary_settings_phase1.sql`**

- Creates `public.salary_settings` (additive, FK to `users`, `companies`, optional `branches` / `accounts`)
- RLS: SELECT for company members; INSERT/UPDATE/DELETE for `is_owner_or_admin()`
- Idempotent backfill: `INSERT … FROM employees JOIN users ON CONFLICT (user_id) DO NOTHING`
- RPC: `backfill_salary_settings_from_employees(p_company_id)` → `{ ok, company_id, inserted }`
- **No** `payroll_runs`, journal, payment, or commission table changes

Default payroll settings are stored in existing `settings` table under key `default_payroll_settings` (category `payroll`) — no new table required.

---

## 3. UI — Staff & Payroll settings

**Route:** Settings → Users & Access → **Staff & Payroll** (`#settings/usersAccess/employees`)

### Sections

1. **Phase 1 info banner** — explains settings-only scope; payroll runs disabled
2. **Default payroll settings** — generation day (default 30), payment account, GL codes (6110/5110/2040), approval toggles (future phases)
3. **Staff salary settings** — table + edit dialog; backfill button
4. **Legacy employee ledger** — embedded `EmployeesTab` with Run Payroll / Pay hidden

### Screenshots

Capture locally after `npm run dev` and applying migration:

- Default payroll settings card (generation day + GL codes)
- Staff salary settings table + backfill control

---

## 4. Default payroll settings

| Field | Default |
|-------|---------|
| `generationDay` | **30** |
| Short months | Uses **last day of month** (via `resolvePayrollGenerationDayForMonth`) |
| `salaryExpenseAccountCode` | 6110 |
| `commissionExpenseAccountCode` | 5110 |
| `commissionPayableAccountCode` | 2040 |
| `requireApprovalBeforeAccrual` | false (Phase 2+) |
| `requireApprovalBeforePayment` | false (Phase 2+) |

UI shows a live preview: e.g. “June 2026 → day 30”, “February 2026 → day 28”.

---

## 5. Backfill result

### Migration-time backfill (on apply)

```sql
INSERT INTO salary_settings (...)
SELECT ... FROM employees e
INNER JOIN users u ON u.id = e.user_id
WHERE u.company_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
```

- **Safe:** never overwrites existing rows
- Maps: `basic_salary` → `basic_monthly_salary`, `is_active` → `salary_enabled` / `is_active`
- `commission_enabled` = true if `commission_rate > 0` OR `can_be_assigned_as_salesman`

### Admin re-run (UI button)

Calls RPC `backfill_salary_settings_from_employees()`; toast shows `inserted` count.

### Employee add/update sync

`EmployeesTab` calls `payrollSettingsService.syncFromEmployeeRecord()` after successful employee save (upsert with same mapping, no delete).

---

## 6. RLS / permission summary

| Resource | SELECT | INSERT/UPDATE/DELETE |
|----------|--------|----------------------|
| `salary_settings` | Authenticated users in same company (`get_user_company_id()`) | Owner or admin only (`is_owner_or_admin()`) |
| `backfill_salary_settings_from_employees` | — | RPC checks `is_owner_or_admin()` |
| `default_payroll_settings` (settings row) | Existing settings RLS | Admin via settings UI (same as other company settings) |

No changes to commission, sales, journal, or payment RLS.

---

## 7. Build result

```
npm run build  →  exit 0 (Vite production build succeeded)
```

---

## 8. Confirmation — no payroll, payment, or GL posting

Phase 1 **does not** implement:

- Payroll run generation or `payroll_runs` tables
- Salary accrual or payment journal entries
- Commission reposting or batch changes
- `record_payment_with_accounting` or any payment RPC calls from new code

`EmployeesTab` Run Payroll / Pay actions are **hidden** when embedded in `StaffAndPayrollTab` (`phase1HidePaymentActions={true}`). Legacy code paths remain in file but are not exposed in Phase 1 UI.

---

## Next phases (not implemented)

- Phase 2: `payroll_runs`, prepare/recalculate, Approval Center list
- Phase 3: Approve/reject workflow, audit, locks
- Phase 4: GL accrual RPC
- Phase 5: Payment + vouchers
- Phase 6: Payroll reports
