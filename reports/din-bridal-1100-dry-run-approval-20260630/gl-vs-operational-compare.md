# GL vs operational / party sub-ledger compare

| Measure | Amount (PKR) |
|---------|--------------|
| GL control 1100 net (JE) | **-136,500** |
| Sum party AR (`get_contact_party_gl_balances`) | 2,151,800 |
| Control residual in sub-ledger sum | **0** (mis-post isolated on control) |

## Interpretation

The **-136,500 is not a real customer advance** on control 1100. It is an **orphaned credit** from two **cancelled sale reversals** that should have reduced:

- **Miss NAGHMANA RAJA** (`AR-CUS0056`) — HQ-SL-0001
- **ASIM** (`AR-CUS0012`) — HQ-SL-0002

Party sub-ledgers still reflect original sale balances; reversals did not hit the correct AR accounts.

## Recommended treatment

**Reclass** using the existing rental-1100 `gl_correction` pattern (JV entries mirroring source lines onto correct `AR-CUS*` accounts). **Not** an opening-balance accept scenario.
