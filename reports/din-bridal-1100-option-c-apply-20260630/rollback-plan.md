# Rollback plan — DIN BRIDAL 1100 Option C apply

**Status:** Documented only — **not executed**. Rollback requires separate operator approval unless emergency verification failure.

## Correction JEs to reverse

| Entry | UUID |
|-------|------|
| JV-000209 | `97b8c7d0-8fa5-4c21-859f-781647c5097e` |
| JV-000210 | `374d57ad-a1b7-4f3c-8d23-6d7b70060ee3` |

## Safest reversal method

**Void correction JEs** (if void workflow supported and audited) **or** post additive reversal JEs with distinct fingerprints:

- `developer_repair:gl_correction:rollback:sale-reversal-1100-leakage:4dfdc6ba-f895-4efd-89c5-253a4429322f`
- `developer_repair:gl_correction:rollback:sale-reversal-1100-leakage:428ae1a5-2aea-4953-afc8-d93e372fc479`

### Reversal shape (per JE)

| Original | Reversal |
|----------|----------|
| Dr 1100 / Cr AR-CUS0056 (78,750) | Dr AR-CUS0056 / Cr 1100 (78,750) |
| Dr 1100 / Cr AR-CUS0012 (57,750) | Dr AR-CUS0012 / Cr 1100 (57,750) |

## Validation after rollback

1. Control 1100 JE net returns to **-136,500**
2. AR-CUS0056 balance returns to **113,750**
3. AR-CUS0012 balance returns to **72,750**
4. Run `npm run monitor:three-company-unified-ledger` — expect PASS
5. Source JE-0155 / JE-0157 remain unchanged throughout

## Warning

Do not execute rollback without explicit operator approval except on verification failure requiring emergency restore.
