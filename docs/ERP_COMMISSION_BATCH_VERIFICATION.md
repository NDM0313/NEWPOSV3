# ERP Commission Batch — Verification (Phase 6)

## Scenarios to verify (local)

### Case A: Admin creates sale and selects salesman
- Create a sale as admin; select a salesman and set commission % or fixed amount.
- Save/finalize. **Expected**: sale has salesman_id, commission_amount, commission_eligible_amount, commission_status = 'pending', commission_batch_id = null. No journal entry for commission.

### Case B: Salesman creates own sale
- Log in as a user who is a salesman (or assigned as salesman in the list). Create and finalize a sale.
- **Expected**: Sale has that user as salesman_id (auto-assigned). Commission stored; commission_status = pending. No commission JE.

### Case C: Multiple sales in selected period
- Create several final sales with commission in the same period (same date range). Open Commission Report for that range.
- **Expected**: Report shows all of them; totals and detail table match. Status = Pending for all.

### Case D: Commission report shows correct totals
- Apply filters (salesman, branch, status). **Expected**: Total sales, eligible, commission, posted, pending match the detail rows. Branch and status filters reduce the set correctly.

### Case E: Generate to Ledger posts one summarized batch
- With pending commission in the report, click **Post Commission**.
- **Expected**: One new row in commission_batches; one new journal entry (Dr 5100, Cr 2040) with total = sum of pending commission. All included sales get commission_status = 'posted', commission_batch_id = batch.id. Report refreshes; posted total increases, pending decreases.

### Case F: Posted sales are not reposted
- After posting, run Post Commission again for the same filters/period.
- **Expected**: No new batch; toast or message that there is no pending commission (or only new pending sales from other filters).

### Case G: Commission payment reduces payable
- After posting, create a manual journal entry (or use payment flow): Dr Salesman Payable (2040), Cr Cash (1000) for the paid amount.
- **Expected**: 2040 balance decreases; cash decreases. No change to commission_batches or sales.

## Quick checklist
- [ ] Sale form: salesman selection (admin) and auto-assign (salesman).
- [ ] Sale save: commission_amount, commission_eligible_amount, commission_percent, commission_status = pending stored; no commission JE.
- [ ] Report: filters (salesman, branch, status), summary totals, detail table with status and batch.
- [ ] Post Commission: one batch, one JE (Dr 5100, Cr 2040), sales updated to posted.
- [ ] No duplicate posting for same sales.
- [ ] Payment (Dr 2040, Cr 1000/1010) is separate and correct.
