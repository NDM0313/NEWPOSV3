# Report tie-out verification — DIN BRIDAL 1100 Option C apply

**Verified:** 2026-06-30

## Trial Balance alignment

After apply, AR sub-ledger account balances **match pre-apply customer party ledger values**:

| Customer | Party AR (pre-apply) | AR-CUS* TB (post-apply) | Match |
|----------|----------------------|-------------------------|-------|
| Miss NAGHMANA RAJA | 35,000 | AR-CUS0056 = 35,000 | Yes |
| ASIM | 15,000 | AR-CUS0012 = 15,000 | Yes |

The PKR 78,750 / 57,750 credits reclassed erroneous 1100 reversal credits onto the correct party AR sub-ledgers, clearing the control leakage without changing source sale reversals.

## Control 1100

| Metric | Value |
|--------|-------|
| Pre-apply JE net | -136,500 |
| Post-apply JE net | **0.00** |
| Expected | 0 |

## Balance Sheet AR

Party AR sub-ledgers now reflect customer-level receivable positions; control 1100 no longer carries orphan reversal credits.

## Monitoring

Pre-apply three-company monitoring PASS (Admin Compare 9/9). Post-apply monitoring recorded separately in `post-apply-monitoring.md`.

## Unexpected drift

None observed in scoped verification queries.
