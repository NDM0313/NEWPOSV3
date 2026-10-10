# SCE vs data integrity

Single Core Engine ensures **one unified GL loader / RPC surface** for Trial Balance, BS, P&L, Roznamcha, etc.

It does **not**:

- Auto-balance journal entries where Σdebit ≠ Σcredit
- Prevent sale edit / cancel posting bugs from leaving unbalanced lines
- Make “Sync account balances from journal” fix TB (that only refreshes `accounts.balance` cache)

```
TB difference = Σ(all non-void line debits) − Σ(all non-void line credits)
```

If any JE is unbalanced, company TB and usually BS A−(L+E) show the same difference.
