# ERP Commission — Final Verification (Issue 5)

## Cases to verify (local)

### Case A: Sale with salesman appears in Commission report
- Create and finalize a sale with a salesman selected and (optionally) commission % or amount.
- Open **Reports → Commission**; set date range to include the sale date; leave Branch / Salesman / Status as needed (e.g. All / Pending).
- **Expected**: The sale appears in the report (summary and detail table). If “Fully paid only” is selected, the sale appears only when it is fully paid (due = 0).

### Case B: Sale detail shows salesman name and commission info
- Open a sale that has a salesman and/or commission (e.g. from the list → view details).
- **Expected**: A “Salesman & Commission” section shows Salesman name, Commission %, Commission amount, Commission status (Pending/Posted).

### Case C: Pending sales can be posted
- With at least one **pending** commission sale in the report (and, if using “Fully paid only”, that sale fully paid), click **Post Commission**.
- **Expected**: A batch is created; totals and detail update; the sale(s) show as “Posted” and Commission status in sale detail is “Posted”.

### Case D: Posted sales do not appear again in pending generation
- After posting (Case C), run **Post Commission** again with the same period/filters.
- **Expected**: No duplicate batch for the same sales; either “No pending commission” or only other pending sales are posted. Already-posted sales are not included.

### Case E: Fully paid only excludes due-balance sales
- Have two sales with commission: one fully paid (due = 0), one with balance due &gt; 0.
- Set **Payment eligibility** to **Fully paid only**.
- **Expected**: Report and “Post Commission” include only the fully paid sale. The due-balance sale does not appear in the report (for that filter) and is not posted.

### Case F: Include due sales includes due-balance sales
- Same two sales as in E. Set **Payment eligibility** to **Include due sales**.
- **Expected**: Report shows both sales. “Post Commission” can post both (if pending).

### Case G: Mixed dataset with branch/date/salesman filters
- Multiple sales across branches, dates, and salesmen; some pending, some posted; some fully paid, some with due.
- **Expected**: Branch, date range, and salesman filters narrow the list correctly. Status (Pending/Posted) and Payment eligibility (Fully paid only / Include due) behave as above. Post Commission only affects the filtered pending set and does not repost already-posted sales.

## Checklist
- [ ] Migration `sales_ensure_invoice_date_for_commission.sql` (and commission batch migration) applied.
- [ ] Case A–G verified locally.
- [ ] Sale detail shows salesman and commission; report and post use payment eligibility and prevent repost.
