# Walk-in Customer — Rs. 150 Trace (`a3c6ea52…`)

**Company:** DIN BRIDAL
**Contact:** Walk-in Customer (`a3c6ea52-a705-48c9-a3ac-e42e423526de`)

## Balances

| Lens | AR |
|------|-----|
| Legacy / official_gl / audit_full_history | **−150** |
| effective_party | **0** |
| Difference | **150** |

## Exact source

| Field | Value |
|-------|--------|
| Journal | **JV-000203** |
| reference_type | **`gl_correction`** |
| action_fingerprint | `developer_repair:gl_correction:hq-sl-0003-orphan-ar` |
| AR effect | Cr **AR-CUS0000** Rs. **150** (legacy lens shows −150 AR) |
| Counterpart | Dr **1100** Rs. 150 |
| Description | GL correction: JE-0161 credited 1100 not AR-CUS0000 for cancelled HQ-SL-0003 |

## Basis filter behavior

`_unified_ledger_basis_includes_row('effective_party', 'gl_correction', 'developer_repair:gl_correction:%orphan-ar', …)` → **FALSE**
Same call with `official_gl` → **TRUE**

Related cancelled-sale trail rows (`sale` / `sale_reversal` for HQ-SL-0003 etc.) are also filtered under EP for cancelled sales; the residual −150 visible in legacy comes from this **orphan-ar gl_correction**.

## Classification (independent of 80k)

**INTENTIONAL EFFECTIVE_PARTY EXCLUSION** of developer orphan-AR `gl_correction`.
Not a duplicate-contact bug; not branch mismatch.

## Accounting interpretation

EP treats the orphan-AR repair JE as non-effective noise for party balances. Legacy/Contacts RPC includes it → small credit AR (−150). EP at 0 is consistent with “cancelled sale trail cleaned.”
