# ERP Commission — Settlement Workflow (Phase 5)

## Accounting entries

### At batch posting (Generate to Ledger)
- **Dr** Sales Commission Expense (5100) — total commission for the batch  
- **Cr** Salesman Payable (2040) — same amount  

This records the expense and the liability to the salesman(s).

### At payment (settlement)
When the business pays the salesman their commission (e.g. by bank or cash):

- **Dr** Salesman Payable (2040) — amount paid  
- **Cr** Cash / Bank (1000 / 1010) — same amount  

Payment is **separate** from commission posting. It can be:
- A manual journal entry (Dr 2040, Cr 1000/1010), or
- A dedicated “Commission payment” or “Worker payment” flow that creates the same entry and optionally logs against the employee/salesman.

## Workflow summary
1. **Sales**: Sales are created/finalized with salesman_id and commission_amount; commission_status = pending. No ledger entry for commission yet.
2. **Report**: Admin views Commission Report (filters: salesman, branch, date, status).
3. **Post Commission**: Admin clicks “Post Commission”. One batch and one JE (Dr 5100, Cr 2040) are created; selected sales marked posted.
4. **Payment**: Later, when paying the salesman, reduce Salesman Payable (2040) by debiting 2040 and crediting Cash/Bank. This can be done via Journal Entries or a future Commission Payment module.

## Notes
- Commission payment does **not** use employee_ledger for the main accounting; the primary record is journal_entries (5100, 2040, 1000/1010). employee_ledger can still be used for internal tracking of what is owed/paid per employee if desired.
- Keeping payment separate from generation ensures clean audit: first “we owe this” (batch post), then “we paid this” (payment entry).
