# Salary & Commission — Team SOP

Standard operating procedure for staff/salesman pay and commission in NEW POSV3. No separate payroll module is required for day-to-day use if these rules are followed.

## Who gets paid how

| Payee type | Use this flow | Do NOT use |
|------------|---------------|------------|
| Staff / Salesman / Operator (ERP **users**) | Expense → **Salaries** + **Pay to (user)** | Worker Ledger, Production pay |
| Production workers (tailor, dyer, etc.) | Studio → **Worker Ledger** / Pay Worker | Expense → Salaries |
| Salesman **commission** (earned on sales/rentals) | Reports → **Commission Report** → **Post Commission** | Expense (until settling cash) |

## Rule 1 — Salary / fixed pay (Expense)

1. Open **Expenses** → Add expense.
2. Category: **Salaries** (or a sub-category with `type = salary`).
3. **Pay to (staff user)** — required; pick the correct user (Owner, Staff, Salesman, etc.).
4. Set amount, payment account, date; mark **Paid** when money leaves the bank/cash.
5. GL: Dr **6110** Salaries / Cr Cash-Bank (posted with expense).

**Audit:** Expenses list → filter Category **Salaries** + **Pay to** filter. Each row must have `paid_to_user_id` set.

## Rule 2 — Commission earned (accrual)

1. Sales/rentals must have **Salesman** and commission fields on finalize.
2. **Reports → Commission Report** — filter by salesman and date.
3. Click **Post Commission** when ready to accrue in GL.
4. GL: Dr **5100/5110** Sales Commission Expense / Cr **2040** Salesman Payable.

Commission is **not** paid at post time — it records what the company owes.

## Rule 3 — Commission payment (settlement)

1. **Accounting → Ledgers → User** → select salesman → **Pay Commission** (or pay from User statement).
2. Enter amount, payment account, date.
3. GL: Dr **2040** Salesman Payable / Cr Cash-Bank.
4. `reference_type = commission_payment`, `reference_id = user id` — appears on **User Ledger (Operational)**.

Alternatively: manual journal Dr 2040 Cr Cash — but User Ledger will **not** link unless you use the commission payment flow.

## Checking one salesman’s full record

**Web (unified view):**

1. **Accounting → Ledgers → User** → select salesman → **Operational** tab.
2. Rows: salary debits, commission earned (credits), commission paid (debits).
3. Summary: Salary paid | Commission earned | Commission paid | Net.
4. Cross-check: **Commission Report** (posted totals) + **Expenses** (Salaries, filtered by payee).

**Mobile:**

- **Accounts → Reports → Staff statement** (admin) — same operational lines.
- Salesman role: **My Activity** shows own salary/commission timeline when scoped to their user.

## Net balance (User Ledger Operational)

- **Credit** = commission earned (company owes salesman).
- **Debit** = salary paid + commission paid to salesman.
- **Negative closing balance** = net amount still owed to salesman (commission minus settlements).
- **Positive** = company has paid more than earned commission in the period (advance / overpayment).

## Workers vs staff

- **Workers** (`contacts` / studio): paid via Production and Worker Payable **2010** — never Salaries expense.
- **Users** (login accounts): salary via Expense Salaries only.

## Optional: Settings → Employees

`employees` / `employee_ledger` can track internal accruals and bonuses. **Primary audit trail** remains Expense + User Ledger + Commission Report. Do not rely on Employees tab alone for salary paid via Expense unless entries are synced.

## Related docs

- [ERP_COMMISSION_SETTLEMENT_WORKFLOW.md](./ERP_COMMISSION_SETTLEMENT_WORKFLOW.md)
- [expense_categories_type_and_paid_to.sql](../migrations/expense_categories_type_and_paid_to.sql)
