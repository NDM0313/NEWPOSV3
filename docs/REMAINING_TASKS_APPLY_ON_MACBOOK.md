# Remaining Tasks – Apply on MacBook / VPS

**Purpose:** Yeh file MacBook par clone/pull ke baad apply karne ke liye hai. Migrations ka order aur steps yahan likhe hain.

**Date:** 2026-02-26

---

## 1. Code Sync (MacBook par)

```bash
cd /path/to/NEWPOSV3   # ya jahan repo clone hai
git pull origin main   # ya jo branch use kar rahe ho
npm install            # agar new deps hon
```

---

## 2. Database Migrations – Run Order

**Important:** In migrations ko **is order** mein chalao. Pehle Supabase SQL Editor kholo (ya `psql $DATABASE_URL` / migration runner).

### 2.1 Identity & Document (pehle)

| Order | File | What it does |
|-------|------|--------------|
| 1 | `migrations/global_identity_and_received_by.sql` | created_by = auth.uid(), received_by, activity_logs FK |
| 2 | `migrations/global_document_sequences_company.sql` | document_sequences_global, get_next_document_number_global (SL, CUS, PAY, …) |
| 3 | `migrations/backfill_created_by_auth_user_id.sql` | Backfill sales/purchases/payments etc. created_by to auth_user_id |

### 2.2 Contacts & Walk-in

| Order | File | What it does |
|-------|------|--------------|
| 4 | `migrations/contacts_global_customer_code_and_walkin.sql` | contacts.code, CUS sequence, walk-in CUS-0000, RLS, backfill sales null customer_id |
| 5 | `migrations/walkin_consolidation_single_per_company.sql` | Merge duplicate walk-ins: one per company, reassign sales then delete extras |
| 6 | `migrations/walkin_strict_enforcement.sql` | Unique index + CHECK: one walk-in per company, code CUS-0000 |

**Optional (verify only):**  
`migrations/walkin_post_consolidation_audit.sql` – run SELECTs manually to verify walk-in count per company.

### 2.3 Accounts & Payments RLS

| Order | File | What it does |
|-------|------|--------------|
| 7 | `migrations/ensure_ar_1100_and_fix_payment_journal.sql` | AR account 1100, create_payment_journal_entry SECURITY DEFINER |
| 8 | `migrations/accounts_rls_allow_user_account_access.sql` | Accounts SELECT: admin/manager/accountant + user_account_access |
| 9 | `migrations/accounts_rls_allow_sale_accounting_codes.sql` | Accounts SELECT: AR (1100/2000), Sales (4000…) for sale journal entry (fix 403) |
| 10 | `migrations/payments_rls_allow_insert.sql` | Payments SELECT/INSERT/UPDATE/DELETE by company + branch access |

### 2.4 Other RLS & Fixes

| Order | File | What it does |
|-------|------|--------------|
| 11 | `migrations/fix_payment_journal_ar_account_code.sql` | Payment journal AR lookup fix |
| 12 | `migrations/fix_audit_logs_fk_and_document_sequences_rls.sql` | audit_logs FK, document_sequences RLS |
| 13 | `migrations/stock_movements_rls_branch_based.sql` | stock_movements RLS by company + branch |
| 14 | `migrations/rpc_user_branches_validate_auth_user.sql` | set_user_branches / set_user_account_access expect auth.users(id) |
| 15 | `migrations/erp_permission_architecture_global.sql` | **Global permission:** owner/admin = full company; user = branch-scoped; is_admin_or_owner(); sales, payments, journal_entries, contacts, rentals, stock_movements, ledger_master |

---

## 3. How to Run Migrations

### Option A – Supabase Dashboard (SQL Editor)

1. Supabase project → SQL Editor.
2. Har file ka content copy karo (order 1 se 15 tak).
3. Run (one by one recommended).

### Option B – Migration script (agar hai)

```bash
node scripts/run-migrations.js
# ya
npm run migrations
```

Agar script sirf kuch files uthata ho to upar wale order ke hisaab se baki files ko manually SQL Editor mein chalao.

### Option C – VPS / psql

```bash
# .env se DATABASE_URL use karo
export DATABASE_URL="postgresql://..."
for f in migrations/global_identity_and_received_by.sql migrations/global_document_sequences_company.sql ...; do
  psql "$DATABASE_URL" -f "$f"
done
```

---

## 4. Post-Migration Checks

- **Walk-in:**  
  `SELECT company_id, COUNT(*) FROM contacts WHERE system_type = 'walking_customer' GROUP BY company_id;`  
  Har company ke liye count = 1 hona chahiye.

- **Accounts 403 fix:**  
  Non-admin user se ek sale save karke dekho – “AR: MISSING, Sales: MISSING” / 403 nahi aana chahiye.

- **Ledger:**  
  Walk-in customer select karke ledger kholo – saari walk-in sales dikhni chahiye (same customer_id).

---

## 5. Docs Reference

| Doc | Content |
|-----|--------|
| `docs/USER_MANAGEMENT_ACCESS_FIX.md` | Identity, document numbers, contacts, walk-in strict enforcement, **Global ERP Permission Architecture** |
| `docs/MACBOOK_SETUP_AND_REMAINING_TASKS.md` | MacBook setup, mobile/POS tasks (sale save, PWA, etc.) |

---

## 6. Quick Checklist (MacBook)

- [ ] `git pull` + `npm install`
- [ ] Migrations 1–15 run kiye (order follow kiya)
- [ ] Walk-in count verify (1 per company)
- [ ] Sale create test (user + admin)
- [ ] Customer ledger (walk-in) test
- [ ] Agar mobile/POS tasks baaki hon to `docs/MACBOOK_SETUP_AND_REMAINING_TASKS.md` dekho
