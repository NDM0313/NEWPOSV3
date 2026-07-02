# Apply execution — DIN BRIDAL 1100 Option C

**Applied:** 2026-06-30  
**Mechanism:** Scoped additive `gl_correction` JEs mirroring rental 1100 leakage repair pattern (direct SQL transaction on production DB; `create_gl_correction_journal` RPC does not yet route `sale-reversal-1100-leakage` targets).

## Corrections posted

| Correction JE | Source JE | Invoice | Customer | Dr | Cr | Amount |
|---------------|-----------|---------|----------|----|----|--------|
| **JV-000209** | JE-0155 | HQ-SL-0001 | Miss NAGHMANA RAJA | 1100 | AR-CUS0056 | PKR 78,750 |
| **JV-000210** | JE-0157 | HQ-SL-0002 | ASIM | 1100 | AR-CUS0012 | PKR 57,750 |

**Total:** PKR 136,500 Dr to 1100 / PKR 136,500 Cr to party AR sub-ledgers.

## JE identifiers

| Entry | UUID | Fingerprint |
|-------|------|-------------|
| JV-000209 | `97b8c7d0-8fa5-4c21-859f-781647c5097e` | `developer_repair:gl_correction:sale-reversal-1100-leakage:4dfdc6ba-f895-4efd-89c5-253a4429322f` |
| JV-000210 | `374d57ad-a1b7-4f3c-8d23-6d7b70060ee3` | `developer_repair:gl_correction:sale-reversal-1100-leakage:428ae1a5-2aea-4953-afc8-d93e372fc479` |

## Unchanged

- JE-0155, JE-0157 (source mispost JEs)
- HQ-SL-0001, HQ-SL-0002 sales documents
- Payments, inventory, rentals, DIN CHINA, DIN COUTURE

## Post-apply control 1100 JE net

**0.00** (was -136,500)
