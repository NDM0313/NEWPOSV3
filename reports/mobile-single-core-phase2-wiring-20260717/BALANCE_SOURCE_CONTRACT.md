# BALANCE_SOURCE_CONTRACT.md

| Surface | Source | Basis | Notes |
|---------|--------|-------|-------|
| Dashboard receivable/payable | Contact / party GL summary RPCs | GL-oriented | Not forced equal to statement closing without same scope/basis |
| Contact list balance | `get_contact_party_gl_balances` / contact.balance | GL list | May differ from statement period closing |
| Party Ledger closing | Unified party ledger when flags ON; else party GL | `official_gl` when unified | Opening + lines → closing |
| Receipt/payment pre-write | Contact / sheet balance helpers | Operational/GL mix | Do not force-match by sign flips |
| Account Ledger | Unified account / JE overlay | GL | List balances may overlay from journal |
| Aging | `due_amount` operational aging | **Operational** | Labelled “not official GL closing” |
| Roznamcha closing | Unified cash/bank opening/closing when unified | `official_gl` | Legacy payments cash book otherwise |
